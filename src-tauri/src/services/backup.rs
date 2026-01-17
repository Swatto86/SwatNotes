//! Backup service
//!
//! Creates consistent snapshots of the database and blob store.
//! Packages backups as ZIP files with manifest and checksums.

use crate::database::Repository;
use crate::error::{AppError, Result};
use crate::storage::BlobStore;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use zip::write::FileOptions;
use zip::ZipWriter;

const DEFAULT_RETENTION_COUNT: usize = 10;

/// Backup manifest structure
#[derive(Debug, Serialize, Deserialize)]
pub struct BackupManifest {
    pub version: String,
    pub timestamp: String,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub size: u64,
    pub checksum: String,
}

/// Backup service
#[derive(Clone)]
pub struct BackupService {
    repo: Repository,
    blob_store: BlobStore,
    app_data_dir: PathBuf,
    backups_dir: PathBuf,
}

impl BackupService {
    pub fn new(repo: Repository, blob_store: BlobStore, app_data_dir: PathBuf) -> Self {
        let backups_dir = app_data_dir.join("backups");
        Self {
            repo,
            blob_store,
            app_data_dir,
            backups_dir,
        }
    }

    /// Create a backup
    pub async fn create_backup(&self) -> Result<PathBuf> {
        tracing::info!("Creating backup");

        // Ensure backups directory exists
        fs::create_dir_all(&self.backups_dir).await?;

        // Generate backup filename with timestamp
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let backup_filename = format!("backup_{}.zip", timestamp);
        let backup_path = self.backups_dir.join(&backup_filename);

        // Create temporary file for atomic write
        let temp_path = self.backups_dir.join(format!("{}.tmp", backup_filename));

        // Build manifest
        let mut manifest = BackupManifest {
            version: env!("CARGO_PKG_VERSION").to_string(),
            timestamp: Utc::now().to_rfc3339(),
            files: Vec::new(),
        };

        // Create ZIP file
        let temp_file = std::fs::File::create(&temp_path)?;
        let mut zip = ZipWriter::new(temp_file);
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        // Add database file
        let db_path = self.app_data_dir.join("db.sqlite");
        if db_path.exists() {
            let db_data = fs::read(&db_path).await?;
            let db_checksum = calculate_checksum(&db_data);

            zip.start_file("db.sqlite", options)?;
            std::io::Write::write_all(&mut zip, &db_data)?;

            manifest.files.push(FileEntry {
                path: "db.sqlite".to_string(),
                size: db_data.len() as u64,
                checksum: db_checksum,
            });

            tracing::debug!("Added db.sqlite to backup");
        }

        // Add all blobs
        let blob_hashes = self.blob_store.list_all().await?;
        for hash in &blob_hashes {
            let blob_data = self.blob_store.read(hash).await?;
            let blob_checksum = calculate_checksum(&blob_data);

            // Store with directory structure: blobs/ab/cd/abcd123...
            let blob_rel_path = format!(
                "blobs/{}/{}/{}",
                &hash[0..2],
                &hash[2..4],
                hash
            );

            zip.start_file(&blob_rel_path, options)?;
            std::io::Write::write_all(&mut zip, &blob_data)?;

            manifest.files.push(FileEntry {
                path: blob_rel_path,
                size: blob_data.len() as u64,
                checksum: blob_checksum,
            });
        }

        tracing::debug!("Added {} blobs to backup", blob_hashes.len());

        // Add manifest
        let manifest_json = serde_json::to_string_pretty(&manifest)?;
        let manifest_checksum = calculate_checksum(manifest_json.as_bytes());

        zip.start_file("manifest.json", options)?;
        std::io::Write::write_all(&mut zip, manifest_json.as_bytes())?;

        // Finish ZIP
        zip.finish()?;

        // Atomic rename
        fs::rename(&temp_path, &backup_path).await?;

        // Get file size
        let metadata = fs::metadata(&backup_path).await?;
        let size = metadata.len() as i64;

        // Record backup in database
        self.repo
            .record_backup(
                backup_path.to_string_lossy().as_ref(),
                size,
                &manifest_checksum,
            )
            .await?;

        tracing::info!("Backup created: {:?} ({} bytes)", backup_path, size);

        // Apply retention policy
        self.apply_retention_policy().await?;

        Ok(backup_path)
    }

    /// Apply retention policy (keep only last N backups)
    async fn apply_retention_policy(&self) -> Result<()> {
        let retention_count = self.get_retention_count().await?;

        let backups = self.repo.list_backups().await?;

        if backups.len() <= retention_count {
            return Ok(());
        }

        // Sort by timestamp (newest first)
        let mut sorted_backups = backups;
        sorted_backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        // Delete old backups
        for backup in sorted_backups.iter().skip(retention_count) {
            tracing::info!("Deleting old backup: {}", backup.path);

            // Delete file
            if let Err(e) = fs::remove_file(&backup.path).await {
                tracing::warn!("Failed to delete backup file {}: {}", backup.path, e);
            }

            // Note: We keep the database record for history
        }

        Ok(())
    }

    /// Get retention count from settings
    async fn get_retention_count(&self) -> Result<usize> {
        match self.repo.get_setting("backup_retention_count").await? {
            Some(value) => value
                .parse()
                .map_err(|_| AppError::Generic("Invalid retention count".to_string())),
            None => Ok(DEFAULT_RETENTION_COUNT),
        }
    }

    /// List available backups
    pub async fn list_backups(&self) -> Result<Vec<crate::database::Backup>> {
        self.repo.list_backups().await
    }

    /// Get backup info from ZIP file
    pub async fn get_backup_info(&self, backup_path: &Path) -> Result<BackupManifest> {
        let data = fs::read(backup_path).await?;
        let cursor = std::io::Cursor::new(data);
        let mut archive = zip::ZipArchive::new(cursor)?;

        // Read manifest
        let mut manifest_file = archive.by_name("manifest.json")?;
        let mut manifest_data = String::new();
        std::io::Read::read_to_string(&mut manifest_file, &mut manifest_data)?;

        let manifest: BackupManifest = serde_json::from_str(&manifest_data)?;

        Ok(manifest)
    }
}

fn calculate_checksum(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{create_pool, initialize_database, CreateNoteRequest, Repository};
    use sqlx::sqlite::SqlitePoolOptions;
    use tempfile::TempDir;

    async fn create_test_service() -> (BackupService, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let app_data_dir = temp_dir.path().to_path_buf();

        let pool = SqlitePoolOptions::new()
            .connect(&format!("sqlite://{}/db.sqlite", app_data_dir.display()))
            .await
            .unwrap();

        initialize_database(&pool).await.unwrap();
        let repo = Repository::new(pool);

        let blob_store = BlobStore::new(app_data_dir.join("blobs"));
        blob_store.initialize().await.unwrap();

        let service = BackupService::new(repo, blob_store, app_data_dir);

        (service, temp_dir)
    }

    #[tokio::test]
    async fn test_create_backup() {
        let (service, _temp) = create_test_service().await;

        // Create some test data
        service
            .repo
            .create_note(CreateNoteRequest {
                title: "Test".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Create backup
        let backup_path = service.create_backup().await.unwrap();

        assert!(backup_path.exists());
        assert!(backup_path.to_string_lossy().contains("backup_"));
    }

    #[tokio::test]
    async fn test_backup_contains_manifest() {
        let (service, _temp) = create_test_service().await;

        let backup_path = service.create_backup().await.unwrap();

        let manifest = service.get_backup_info(&backup_path).await.unwrap();

        assert_eq!(manifest.version, env!("CARGO_PKG_VERSION"));
        assert!(!manifest.files.is_empty());
    }

    #[tokio::test]
    async fn test_retention_policy() {
        let (service, _temp) = create_test_service().await;

        // Set retention to 3
        service
            .repo
            .set_setting("backup_retention_count", "3")
            .await
            .unwrap();

        // Create 5 backups
        for _ in 0..5 {
            service.create_backup().await.unwrap();
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }

        // List backups
        let backups = service.list_backups().await.unwrap();

        // Should have 5 in DB (we keep records)
        assert_eq!(backups.len(), 5);

        // But only 3 files should exist
        let existing_files = backups
            .iter()
            .filter(|b| std::path::Path::new(&b.path).exists())
            .count();

        assert_eq!(existing_files, 3);
    }
}

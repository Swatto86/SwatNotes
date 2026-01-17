//! Content-addressed blob storage
//!
//! Stores binary data (images, attachments) using SHA-256 hash as key.
//! Files are organized in a two-level directory structure for performance.
//!
//! Example: hash "abcd1234..." is stored at "blobs/ab/cd/abcd1234..."

use crate::error::{AppError, Result};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Content-addressed blob store
#[derive(Clone)]
pub struct BlobStore {
    root: PathBuf,
}

impl BlobStore {
    /// Create a new blob store at the given root directory
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    /// Initialize the blob store (create directory if needed)
    pub async fn initialize(&self) -> Result<()> {
        fs::create_dir_all(&self.root).await?;
        tracing::info!("Blob store initialized at: {:?}", self.root);
        Ok(())
    }

    /// Write data to blob store, returns SHA-256 hash
    pub async fn write(&self, data: &[u8]) -> Result<String> {
        // Calculate hash
        let hash = self.calculate_hash(data);

        // Check if already exists
        if self.exists(&hash).await? {
            tracing::debug!("Blob already exists: {}", hash);
            return Ok(hash);
        }

        // Get path for this hash
        let path = self.get_path(&hash);

        // Create parent directories
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }

        // Write to temp file first (atomic write)
        let temp_path = path.with_extension("tmp");
        let mut file = fs::File::create(&temp_path).await?;
        file.write_all(data).await?;
        file.sync_all().await?;

        // Rename to final location
        fs::rename(temp_path, &path).await?;

        tracing::debug!("Wrote blob: {} ({} bytes)", hash, data.len());

        Ok(hash)
    }

    /// Read data from blob store
    pub async fn read(&self, hash: &str) -> Result<Vec<u8>> {
        let path = self.get_path(hash);

        if !path.exists() {
            return Err(AppError::BlobStore(format!("Blob not found: {}", hash)));
        }

        let mut file = fs::File::open(&path).await?;
        let mut data = Vec::new();
        file.read_to_end(&mut data).await?;

        tracing::debug!("Read blob: {} ({} bytes)", hash, data.len());

        Ok(data)
    }

    /// Check if a blob exists
    pub async fn exists(&self, hash: &str) -> Result<bool> {
        let path = self.get_path(hash);
        Ok(path.exists())
    }

    /// Delete a blob
    pub async fn delete(&self, hash: &str) -> Result<()> {
        let path = self.get_path(hash);

        if !path.exists() {
            return Ok(()); // Already deleted
        }

        fs::remove_file(&path).await?;

        tracing::debug!("Deleted blob: {}", hash);

        Ok(())
    }

    /// Get file path for a hash
    fn get_path(&self, hash: &str) -> PathBuf {
        // Two-level directory structure: blobs/ab/cd/abcd1234...
        let prefix1 = &hash[0..2];
        let prefix2 = &hash[2..4];
        self.root.join(prefix1).join(prefix2).join(hash)
    }

    /// Calculate SHA-256 hash of data
    fn calculate_hash(&self, data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    /// List all blobs (for backup purposes)
    pub async fn list_all(&self) -> Result<Vec<String>> {
        let mut hashes = Vec::new();
        self.scan_directory(&self.root, &mut hashes).await?;
        Ok(hashes)
    }

    fn scan_directory<'a>(
        &'a self,
        dir: &'a Path,
        hashes: &'a mut Vec<String>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + 'a>> {
        Box::pin(async move {
            if !dir.exists() {
                return Ok(());
            }

            let mut entries = fs::read_dir(dir).await?;

            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();

                if path.is_dir() {
                    self.scan_directory(&path, hashes).await?;
            } else if path.is_file() {
                // Extract hash from filename
                if let Some(filename) = path.file_name() {
                    if let Some(hash) = filename.to_str() {
                        // Validate it looks like a hash (64 hex chars)
                        if hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
                            hashes.push(hash.to_string());
                        }
                    }
                }
            }
        }

            Ok(())
        })
    }

    /// Get blob store root directory
    pub fn root(&self) -> &Path {
        &self.root
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn create_test_store() -> (BlobStore, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let store = BlobStore::new(temp_dir.path().join("blobs"));
        store.initialize().await.unwrap();
        (store, temp_dir)
    }

    #[tokio::test]
    async fn test_write_and_read() {
        let (store, _temp) = create_test_store().await;

        let data = b"Hello, World!";
        let hash = store.write(data).await.unwrap();

        let read_data = store.read(&hash).await.unwrap();
        assert_eq!(data, read_data.as_slice());
    }

    #[tokio::test]
    async fn test_hash_consistency() {
        let (store, _temp) = create_test_store().await;

        let data = b"Test data";
        let hash1 = store.write(data).await.unwrap();
        let hash2 = store.write(data).await.unwrap();

        assert_eq!(hash1, hash2);
    }

    #[tokio::test]
    async fn test_exists() {
        let (store, _temp) = create_test_store().await;

        let data = b"Exists test";
        let hash = store.write(data).await.unwrap();

        assert!(store.exists(&hash).await.unwrap());
        assert!(!store.exists("nonexistent").await.unwrap());
    }

    #[tokio::test]
    async fn test_delete() {
        let (store, _temp) = create_test_store().await;

        let data = b"Delete test";
        let hash = store.write(data).await.unwrap();

        assert!(store.exists(&hash).await.unwrap());

        store.delete(&hash).await.unwrap();

        assert!(!store.exists(&hash).await.unwrap());
    }

    #[tokio::test]
    async fn test_directory_structure() {
        let (store, _temp) = create_test_store().await;

        let data = b"Directory test";
        let hash = store.write(data).await.unwrap();

        let path = store.get_path(&hash);
        assert!(path.exists());

        // Check two-level structure
        let parent = path.parent().unwrap();
        let grandparent = parent.parent().unwrap();

        assert_eq!(parent.file_name().unwrap(), &hash[2..4]);
        assert_eq!(grandparent.file_name().unwrap(), &hash[0..2]);
    }

    #[tokio::test]
    async fn test_list_all() {
        let (store, _temp) = create_test_store().await;

        let hash1 = store.write(b"Data 1").await.unwrap();
        let hash2 = store.write(b"Data 2").await.unwrap();
        let hash3 = store.write(b"Data 3").await.unwrap();

        let all_hashes = store.list_all().await.unwrap();

        assert_eq!(all_hashes.len(), 3);
        assert!(all_hashes.contains(&hash1));
        assert!(all_hashes.contains(&hash2));
        assert!(all_hashes.contains(&hash3));
    }
}

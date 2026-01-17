//! Attachments service
//!
//! Handles file attachments and image storage for notes.
//! Integrates Repository and BlobStore.

use crate::database::{Attachment, Repository};
use crate::error::{AppError, Result};
use crate::storage::BlobStore;

/// Service for managing attachments
#[derive(Clone)]
pub struct AttachmentsService {
    repo: Repository,
    blob_store: BlobStore,
}

impl AttachmentsService {
    pub fn new(repo: Repository, blob_store: BlobStore) -> Self {
        Self { repo, blob_store }
    }

    /// Create an attachment from binary data
    pub async fn create_attachment(
        &self,
        note_id: &str,
        filename: &str,
        mime_type: &str,
        data: &[u8],
    ) -> Result<Attachment> {
        tracing::info!(
            "Creating attachment: {} for note: {} (size: {} bytes)",
            filename,
            note_id,
            data.len()
        );

        // Validate filename (prevent path traversal)
        let safe_filename = sanitize_filename(filename);

        // Write to blob store
        let hash = self.blob_store.write(data).await?;

        // Create attachment record
        let attachment = self
            .repo
            .create_attachment(note_id, &hash, &safe_filename, mime_type, data.len() as i64)
            .await?;

        tracing::info!("Attachment created: {}", attachment.id);

        Ok(attachment)
    }

    /// Get attachment data by ID (alternative to get_attachment_by_hash)
    #[allow(dead_code)]
    pub async fn get_attachment_data(&self, attachment_id: &str) -> Result<Vec<u8>> {
        // Get attachment metadata
        let attachments = self.repo.list_attachments(attachment_id).await?;
        let attachment = attachments
            .first()
            .ok_or_else(|| AppError::Generic("Attachment not found".to_string()))?;

        // Read from blob store
        let data = self.blob_store.read(&attachment.blob_hash).await?;

        Ok(data)
    }

    /// Get attachment by blob hash
    pub async fn get_attachment_by_hash(&self, hash: &str) -> Result<Vec<u8>> {
        self.blob_store.read(hash).await
    }

    /// List attachments for a note
    pub async fn list_attachments(&self, note_id: &str) -> Result<Vec<Attachment>> {
        self.repo.list_attachments(note_id).await
    }

    /// Delete an attachment
    pub async fn delete_attachment(&self, attachment_id: &str) -> Result<()> {
        tracing::info!("Deleting attachment: {}", attachment_id);

        // Get blob hash before deleting
        let _blob_hash = self.repo.delete_attachment(attachment_id).await?;

        // Check if blob is still referenced by other attachments
        // For simplicity, we'll keep blobs even if unreferenced (garbage collection is future work)
        // In production, you'd implement reference counting

        tracing::info!("Attachment deleted: {}", attachment_id);

        Ok(())
    }
}

/// Sanitize filename to prevent path traversal attacks
fn sanitize_filename(filename: &str) -> String {
    // Remove path separators and null bytes
    filename
        .chars()
        .filter(|c| *c != '/' && *c != '\\' && *c != '\0')
        .collect::<String>()
        .chars()
        .take(255) // Limit length
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{initialize_database, CreateNoteRequest, Repository};
    use crate::storage::BlobStore;
    use sqlx::sqlite::SqlitePoolOptions;
    use tempfile::TempDir;

    async fn create_test_service() -> (AttachmentsService, TempDir) {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        initialize_database(&pool).await.unwrap();

        let repo = Repository::new(pool);

        let temp_dir = TempDir::new().unwrap();
        let blob_store = BlobStore::new(temp_dir.path().join("blobs"));
        blob_store.initialize().await.unwrap();

        (AttachmentsService::new(repo, blob_store), temp_dir)
    }

    #[tokio::test]
    async fn test_create_and_get_attachment() {
        let (service, _temp) = create_test_service().await;

        // Create a test note
        let note = service
            .repo
            .create_note(CreateNoteRequest {
                title: "Test".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Create attachment
        let data = b"Hello, World!";
        let attachment = service
            .create_attachment(&note.id, "test.txt", "text/plain", data)
            .await
            .unwrap();

        assert_eq!(attachment.filename, "test.txt");
        assert_eq!(attachment.size, 13);

        // Get attachment data
        let retrieved_data = service.get_attachment_by_hash(&attachment.blob_hash).await.unwrap();
        assert_eq!(retrieved_data, data);
    }

    #[tokio::test]
    async fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("normal.txt"), "normal.txt");
        assert_eq!(sanitize_filename("../../../etc/passwd"), "..etcpasswd");
        assert_eq!(sanitize_filename("file\\name.txt"), "filename.txt");
    }

    #[tokio::test]
    async fn test_list_attachments() {
        let (service, _temp) = create_test_service().await;

        let note = service
            .repo
            .create_note(CreateNoteRequest {
                title: "Test".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Create multiple attachments
        service
            .create_attachment(&note.id, "file1.txt", "text/plain", b"data1")
            .await
            .unwrap();
        service
            .create_attachment(&note.id, "file2.txt", "text/plain", b"data2")
            .await
            .unwrap();

        let attachments = service.list_attachments(&note.id).await.unwrap();
        assert_eq!(attachments.len(), 2);
    }
}

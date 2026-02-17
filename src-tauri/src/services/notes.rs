//! Notes service
//!
//! High-level business logic for notes operations.
//! Handles autosave coordination and note lifecycle.

use crate::database::{CreateNoteRequest, Note, Repository, UpdateNoteRequest};
use crate::error::Result;

/// Service for managing notes
#[derive(Clone)]
pub struct NotesService {
    repo: Repository,
}

impl NotesService {
    pub fn new(repo: Repository) -> Self {
        Self { repo }
    }

    /// Create a new note
    pub async fn create_note(&self, title: String, content_json: String) -> Result<Note> {
        tracing::info!("Creating new note: {}", title);

        let req = CreateNoteRequest {
            title: title.clone(),
            content_json: content_json.clone(),
        };

        let note = self.repo.create_note(req).await?;

        // Sync to FTS index
        if let Err(e) = self
            .repo
            .insert_note_fts(&note.id, &title, &content_json)
            .await
        {
            tracing::warn!("Failed to insert note into FTS index: {}", e);
            // Don't fail the whole operation if FTS fails
        }

        tracing::info!("Note created successfully: {}", note.id);

        Ok(note)
    }

    /// Get a note by ID
    pub async fn get_note(&self, id: &str) -> Result<Note> {
        self.repo.get_note(id).await
    }

    /// List all notes
    pub async fn list_notes(&self) -> Result<Vec<Note>> {
        self.repo.list_notes().await
    }

    /// Update a note
    pub async fn update_note(
        &self,
        id: String,
        title: Option<String>,
        content_json: Option<String>,
        title_modified: Option<bool>,
    ) -> Result<Note> {
        tracing::debug!("Updating note: {}", id);

        let req = UpdateNoteRequest {
            id: id.clone(),
            title: title.clone(),
            content_json: content_json.clone(),
            title_modified,
        };

        let note = self.repo.update_note(req).await?;

        // Sync to FTS index if title or content changed
        if title.is_some() || content_json.is_some() {
            if let Err(e) = self
                .repo
                .update_note_fts(&id, title.as_deref(), content_json.as_deref())
                .await
            {
                tracing::warn!("Failed to update note in FTS index: {}", e);
                // Don't fail the whole operation if FTS fails
            }
        }

        tracing::debug!("Note updated successfully: {}", note.id);

        Ok(note)
    }

    /// Delete a note (soft delete)
    pub async fn delete_note(&self, id: &str) -> Result<()> {
        tracing::info!("Deleting note: {}", id);

        self.repo.delete_note(id).await?;

        // Remove from FTS index
        if let Err(e) = self.repo.delete_note_fts(id).await {
            tracing::warn!("Failed to delete note from FTS index: {}", e);
            // Don't fail the whole operation if FTS fails
        }

        tracing::info!("Note deleted successfully: {}", id);

        Ok(())
    }

    /// Search notes by title, content, or attachment filenames
    /// Uses FTS5 full-text search for fast server-side searching
    pub async fn search_notes(&self, query: &str) -> Result<Vec<Note>> {
        use std::collections::HashSet;

        if query.trim().is_empty() {
            return self.list_notes().await;
        }

        // Search using FTS5 for title and content
        let mut results = self.repo.search_notes_fts(query).await?;
        let seen_ids: HashSet<String> = results.iter().map(|n| n.id.clone()).collect();

        // Also search attachment filenames (not in FTS index)
        match self.repo.search_notes_by_attachment(query).await {
            Ok(attachment_note_ids) => {
                // Filter to only IDs we haven't seen yet
                let new_ids: Vec<String> = attachment_note_ids
                    .into_iter()
                    .filter(|id| !seen_ids.contains(id))
                    .collect();

                // Batch fetch all new notes in a single query (avoids N+1)
                if !new_ids.is_empty() {
                    match self.repo.get_notes_by_ids(&new_ids).await {
                        Ok(notes) => {
                            results.extend(notes);
                        }
                        Err(e) => {
                            tracing::warn!(
                                "Failed to batch fetch notes for attachment search: {}",
                                e
                            );
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to search attachments: {}", e);
                // Continue with FTS results even if attachment search fails
            }
        }

        Ok(results)
    }

    /// Count soft-deleted notes
    pub async fn count_deleted_notes(&self) -> Result<i64> {
        self.repo.count_deleted_notes().await
    }

    /// Permanently delete all soft-deleted notes (prune database)
    /// Returns the number of notes permanently deleted
    pub async fn prune_deleted_notes(&self) -> Result<i64> {
        tracing::info!("Pruning deleted notes from database");
        let count = self.repo.prune_deleted_notes().await?;
        tracing::info!("Pruned {} deleted notes", count);
        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{initialize_database, Repository};
    use sqlx::sqlite::SqlitePoolOptions;

    async fn create_test_service() -> NotesService {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        initialize_database(&pool).await.unwrap();

        let repo = Repository::new(pool);
        NotesService::new(repo)
    }

    #[tokio::test]
    async fn test_create_and_get_note() {
        let service = create_test_service().await;

        let note = service
            .create_note("Test".to_string(), "{}".to_string())
            .await
            .unwrap();

        let fetched = service.get_note(&note.id).await.unwrap();

        assert_eq!(fetched.id, note.id);
        assert_eq!(fetched.title, "Test");
    }

    #[tokio::test]
    async fn test_search_notes() {
        let service = create_test_service().await;

        service
            .create_note("Apple".to_string(), "{}".to_string())
            .await
            .unwrap();
        service
            .create_note("Banana".to_string(), "{}".to_string())
            .await
            .unwrap();
        service
            .create_note("Cherry".to_string(), "{}".to_string())
            .await
            .unwrap();

        let results = service.search_notes("an").await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Banana");
    }

    #[tokio::test]
    async fn test_update_note() {
        let service = create_test_service().await;

        let note = service
            .create_note("Original".to_string(), r#"{"ops":[]}"#.to_string())
            .await
            .unwrap();

        // Update title only
        let updated = service
            .update_note(
                note.id.clone(),
                Some("Updated Title".to_string()),
                None,
                None,
            )
            .await
            .unwrap();

        assert_eq!(updated.title, "Updated Title");
        assert_eq!(updated.content_json, r#"{"ops":[]}"#);

        // Update content only
        let updated2 = service
            .update_note(
                note.id.clone(),
                None,
                Some(r#"{"ops":[{"insert":"Hello"}]}"#.to_string()),
                None,
            )
            .await
            .unwrap();

        assert_eq!(updated2.title, "Updated Title");
        assert_eq!(updated2.content_json, r#"{"ops":[{"insert":"Hello"}]}"#);
    }

    #[tokio::test]
    async fn test_delete_note() {
        let service = create_test_service().await;

        let note = service
            .create_note("To Delete".to_string(), "{}".to_string())
            .await
            .unwrap();

        // Delete the note
        service.delete_note(&note.id).await.unwrap();

        // Note should still exist but with deleted_at set
        let deleted_note = service.get_note(&note.id).await.unwrap();
        assert!(deleted_note.deleted_at.is_some());

        // Deleted notes should not appear in list
        let notes = service.list_notes().await.unwrap();
        assert!(!notes.iter().any(|n| n.id == note.id));
    }

    #[tokio::test]
    async fn test_list_notes() {
        let service = create_test_service().await;

        // Empty list initially
        let notes = service.list_notes().await.unwrap();
        assert_eq!(notes.len(), 0);

        // Create some notes
        service
            .create_note("Note 1".to_string(), "{}".to_string())
            .await
            .unwrap();
        service
            .create_note("Note 2".to_string(), "{}".to_string())
            .await
            .unwrap();
        service
            .create_note("Note 3".to_string(), "{}".to_string())
            .await
            .unwrap();

        let notes = service.list_notes().await.unwrap();
        assert_eq!(notes.len(), 3);
    }

    #[tokio::test]
    async fn test_search_notes_by_content() {
        let service = create_test_service().await;

        service
            .create_note(
                "Title A".to_string(),
                r#"{"ops":[{"insert":"Hello World"}]}"#.to_string(),
            )
            .await
            .unwrap();
        service
            .create_note(
                "Title B".to_string(),
                r#"{"ops":[{"insert":"Goodbye"}]}"#.to_string(),
            )
            .await
            .unwrap();

        // Search by content
        let results = service.search_notes("Hello").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Title A");
    }

    #[tokio::test]
    async fn test_search_notes_case_insensitive() {
        let service = create_test_service().await;

        service
            .create_note("UPPERCASE".to_string(), "{}".to_string())
            .await
            .unwrap();
        service
            .create_note("lowercase".to_string(), "{}".to_string())
            .await
            .unwrap();

        // Search should be case-insensitive
        let results = service.search_notes("upper").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "UPPERCASE");
    }
}

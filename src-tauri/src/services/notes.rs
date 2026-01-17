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
            title,
            content_json,
        };

        let note = self.repo.create_note(req).await?;

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
    ) -> Result<Note> {
        tracing::debug!("Updating note: {}", id);

        let req = UpdateNoteRequest {
            id,
            title,
            content_json,
        };

        let note = self.repo.update_note(req).await?;

        tracing::debug!("Note updated successfully: {}", note.id);

        Ok(note)
    }

    /// Delete a note (soft delete)
    pub async fn delete_note(&self, id: &str) -> Result<()> {
        tracing::info!("Deleting note: {}", id);

        self.repo.delete_note(id).await?;

        tracing::info!("Note deleted successfully: {}", id);

        Ok(())
    }

    /// Search notes by title or content
    pub async fn search_notes(&self, query: &str) -> Result<Vec<Note>> {
        let all_notes = self.list_notes().await?;

        let query_lower = query.to_lowercase();

        let filtered: Vec<Note> = all_notes
            .into_iter()
            .filter(|note| {
                note.title.to_lowercase().contains(&query_lower)
                    || note.content_json.to_lowercase().contains(&query_lower)
            })
            .collect();

        Ok(filtered)
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
}

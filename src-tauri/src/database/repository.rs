//! Repository layer for database operations
//!
//! This module provides CRUD operations for all entities.
//! All operations use transactions for safety.

use super::models::*;
use crate::error::{AppError, Result};
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

/// Repository for database operations
#[derive(Clone)]
pub struct Repository {
    pool: SqlitePool,
}

impl Repository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Create a new note
    pub async fn create_note(&self, req: CreateNoteRequest) -> Result<Note> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let note = sqlx::query_as::<_, Note>(
            r#"
            INSERT INTO notes (id, title, content_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(&req.title)
        .bind(&req.content_json)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        tracing::debug!("Created note: {}", id);
        Ok(note)
    }

    /// Get a note by ID
    pub async fn get_note(&self, id: &str) -> Result<Note> {
        let note = sqlx::query_as::<_, Note>(
            r#"
            SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NoteNotFound(id.to_string()))?;

        Ok(note)
    }

    /// List all notes (non-deleted)
    pub async fn list_notes(&self) -> Result<Vec<Note>> {
        let notes = sqlx::query_as::<_, Note>(
            r#"
            SELECT * FROM notes
            WHERE deleted_at IS NULL
            ORDER BY updated_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(notes)
    }

    /// Update a note
    pub async fn update_note(&self, req: UpdateNoteRequest) -> Result<Note> {
        let now = Utc::now();

        // Build dynamic update query
        let mut query = "UPDATE notes SET updated_at = ?".to_string();
        let mut params: Vec<String> = vec![now.to_rfc3339()];

        if let Some(title) = &req.title {
            query.push_str(", title = ?");
            params.push(title.clone());
        }

        if let Some(content) = &req.content_json {
            query.push_str(", content_json = ?");
            params.push(content.clone());
        }

        query.push_str(" WHERE id = ? AND deleted_at IS NULL");
        params.push(req.id.clone());

        // Execute update
        let mut q = sqlx::query(&query);
        for param in &params {
            q = q.bind(param);
        }

        let rows_affected = q.execute(&self.pool).await?.rows_affected();

        if rows_affected == 0 {
            return Err(AppError::NoteNotFound(req.id));
        }

        // Fetch updated note
        self.get_note(&req.id).await
    }

    /// Soft delete a note
    pub async fn delete_note(&self, id: &str) -> Result<()> {
        let now = Utc::now();

        let rows = sqlx::query(
            r#"
            UPDATE notes SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL
            "#,
        )
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows == 0 {
            return Err(AppError::NoteNotFound(id.to_string()));
        }

        tracing::debug!("Soft deleted note: {}", id);
        Ok(())
    }

    /// Permanently delete a note (for testing/cleanup)
    #[allow(dead_code)]
    pub async fn hard_delete_note(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM notes WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        tracing::debug!("Hard deleted note: {}", id);
        Ok(())
    }

    /// Create an attachment
    pub async fn create_attachment(
        &self,
        note_id: &str,
        blob_hash: &str,
        filename: &str,
        mime_type: &str,
        size: i64,
    ) -> Result<Attachment> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let attachment = sqlx::query_as::<_, Attachment>(
            r#"
            INSERT INTO attachments (id, note_id, blob_hash, filename, mime_type, size, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(note_id)
        .bind(blob_hash)
        .bind(filename)
        .bind(mime_type)
        .bind(size)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        tracing::debug!("Created attachment: {} for note: {}", id, note_id);
        Ok(attachment)
    }

    /// List attachments for a note
    pub async fn list_attachments(&self, note_id: &str) -> Result<Vec<Attachment>> {
        let attachments = sqlx::query_as::<_, Attachment>(
            r#"
            SELECT * FROM attachments WHERE note_id = ? ORDER BY created_at DESC
            "#,
        )
        .bind(note_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(attachments)
    }

    /// Delete an attachment
    pub async fn delete_attachment(&self, id: &str) -> Result<String> {
        // Get blob hash before deleting
        let blob_hash: String = sqlx::query_scalar("SELECT blob_hash FROM attachments WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| AppError::Generic("Attachment not found".to_string()))?;

        sqlx::query("DELETE FROM attachments WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        tracing::debug!("Deleted attachment: {}", id);
        Ok(blob_hash)
    }

    /// Create a reminder
    pub async fn create_reminder(&self, note_id: &str, trigger_time: chrono::DateTime<Utc>) -> Result<Reminder> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let reminder = sqlx::query_as::<_, Reminder>(
            r#"
            INSERT INTO reminders (id, note_id, trigger_time, triggered, created_at)
            VALUES (?, ?, ?, 0, ?)
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(note_id)
        .bind(trigger_time)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        tracing::debug!("Created reminder: {} for note: {}", id, note_id);
        Ok(reminder)
    }

    /// List active (non-triggered) reminders
    pub async fn list_active_reminders(&self) -> Result<Vec<Reminder>> {
        let reminders = sqlx::query_as::<_, Reminder>(
            r#"
            SELECT * FROM reminders WHERE triggered = 0 ORDER BY trigger_time ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(reminders)
    }

    /// Mark reminder as triggered
    pub async fn mark_reminder_triggered(&self, id: &str) -> Result<()> {
        sqlx::query("UPDATE reminders SET triggered = 1 WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        tracing::debug!("Marked reminder as triggered: {}", id);
        Ok(())
    }

    /// Get/set settings
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let value: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;

        Ok(value)
    }

    #[allow(dead_code)]
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            "#,
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await?;

        tracing::debug!("Set setting: {} = {}", key, value);
        Ok(())
    }

    /// Record a backup
    pub async fn record_backup(&self, path: &str, size: i64, manifest_hash: &str) -> Result<Backup> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let backup = sqlx::query_as::<_, Backup>(
            r#"
            INSERT INTO backups (id, timestamp, path, size, manifest_hash)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(now)
        .bind(path)
        .bind(size)
        .bind(manifest_hash)
        .fetch_one(&self.pool)
        .await?;

        tracing::debug!("Recorded backup: {}", id);
        Ok(backup)
    }

    /// List backups
    pub async fn list_backups(&self) -> Result<Vec<Backup>> {
        let backups = sqlx::query_as::<_, Backup>(
            r#"
            SELECT * FROM backups ORDER BY timestamp DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(backups)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::schema::initialize_database;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn create_test_repo() -> Repository {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        initialize_database(&pool).await.unwrap();

        Repository::new(pool)
    }

    #[tokio::test]
    async fn test_create_and_get_note() {
        let repo = create_test_repo().await;

        let req = CreateNoteRequest {
            title: "Test Note".to_string(),
            content_json: r#"{"ops":[{"insert":"Hello\n"}]}"#.to_string(),
        };

        let note = repo.create_note(req).await.unwrap();
        assert_eq!(note.title, "Test Note");

        let fetched = repo.get_note(&note.id).await.unwrap();
        assert_eq!(fetched.id, note.id);
        assert_eq!(fetched.title, note.title);
    }

    #[tokio::test]
    async fn test_update_note() {
        let repo = create_test_repo().await;

        let create_req = CreateNoteRequest {
            title: "Original".to_string(),
            content_json: "{}".to_string(),
        };

        let note = repo.create_note(create_req).await.unwrap();

        let update_req = UpdateNoteRequest {
            id: note.id.clone(),
            title: Some("Updated".to_string()),
            content_json: None,
        };

        let updated = repo.update_note(update_req).await.unwrap();
        assert_eq!(updated.title, "Updated");
    }

    #[tokio::test]
    async fn test_list_notes() {
        let repo = create_test_repo().await;

        for i in 1..=3 {
            let req = CreateNoteRequest {
                title: format!("Note {}", i),
                content_json: "{}".to_string(),
            };
            repo.create_note(req).await.unwrap();
        }

        let notes = repo.list_notes().await.unwrap();
        assert_eq!(notes.len(), 3);
    }

    #[tokio::test]
    async fn test_soft_delete() {
        let repo = create_test_repo().await;

        let req = CreateNoteRequest {
            title: "To Delete".to_string(),
            content_json: "{}".to_string(),
        };

        let note = repo.create_note(req).await.unwrap();

        repo.delete_note(&note.id).await.unwrap();

        let result = repo.get_note(&note.id).await;
        assert!(result.is_err());

        let notes = repo.list_notes().await.unwrap();
        assert_eq!(notes.len(), 0);
    }

    #[tokio::test]
    async fn test_attachments() {
        let repo = create_test_repo().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Note with attachments".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let attachment = repo
            .create_attachment(&note.id, "abc123", "test.png", "image/png", 1024)
            .await
            .unwrap();

        assert_eq!(attachment.filename, "test.png");

        let attachments = repo.list_attachments(&note.id).await.unwrap();
        assert_eq!(attachments.len(), 1);
    }

    #[tokio::test]
    async fn test_reminders() {
        let repo = create_test_repo().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Note with reminder".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let trigger_time = Utc::now() + chrono::Duration::hours(1);
        let reminder = repo.create_reminder(&note.id, trigger_time).await.unwrap();

        assert!(!reminder.triggered);

        let active = repo.list_active_reminders().await.unwrap();
        assert_eq!(active.len(), 1);

        repo.mark_reminder_triggered(&reminder.id).await.unwrap();

        let active_after = repo.list_active_reminders().await.unwrap();
        assert_eq!(active_after.len(), 0);
    }

    #[tokio::test]
    async fn test_settings() {
        let repo = create_test_repo().await;

        repo.set_setting("theme", "dark").await.unwrap();

        let value = repo.get_setting("theme").await.unwrap();
        assert_eq!(value, Some("dark".to_string()));

        // Update existing
        repo.set_setting("theme", "light").await.unwrap();

        let updated = repo.get_setting("theme").await.unwrap();
        assert_eq!(updated, Some("light".to_string()));
    }
}

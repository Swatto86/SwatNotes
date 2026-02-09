//! Repository layer for database operations
//!
//! This module provides CRUD operations for all entities.
//! All operations use transactions for safety.

use super::models::*;
use crate::error::{AppError, Result};
use chrono::Utc;
use serde_json::Value;
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

    /// Close the database connection pool
    /// This releases all file handles, allowing file operations on the database
    pub async fn close(&self) {
        tracing::info!("Closing database connection pool");
        self.pool.close().await;
        tracing::info!("Database connection pool closed");
    }

    /// Create a new note
    pub async fn create_note(&self, req: CreateNoteRequest) -> Result<Note> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let note = sqlx::query_as::<_, Note>(
            r#"
            INSERT INTO notes (id, title, content_json, created_at, updated_at, title_modified)
            VALUES (?, ?, ?, ?, ?, 0)
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

    /// Get multiple notes by IDs (batch query to avoid N+1)
    pub async fn get_notes_by_ids(&self, ids: &[String]) -> Result<Vec<Note>> {
        use sqlx::QueryBuilder;

        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let mut builder: QueryBuilder<sqlx::Sqlite> =
            QueryBuilder::new("SELECT * FROM notes WHERE deleted_at IS NULL AND id IN (");

        let mut separated = builder.separated(", ");
        for id in ids {
            separated.push_bind(id.clone());
        }
        separated.push_unseparated(")");

        let notes = builder
            .build_query_as::<Note>()
            .fetch_all(&self.pool)
            .await?;

        Ok(notes)
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
        use sqlx::QueryBuilder;

        let now = Utc::now();

        // Use QueryBuilder for type-safe dynamic query construction
        let mut builder: QueryBuilder<sqlx::Sqlite> =
            QueryBuilder::new("UPDATE notes SET updated_at = ");
        builder.push_bind(now.to_rfc3339());

        if let Some(title) = &req.title {
            builder.push(", title = ");
            builder.push_bind(title.clone());
        }

        if let Some(content) = &req.content_json {
            builder.push(", content_json = ");
            builder.push_bind(content.clone());
        }

        if let Some(title_modified) = req.title_modified {
            builder.push(", title_modified = ");
            builder.push_bind(if title_modified { 1i32 } else { 0i32 });
        }

        builder.push(" WHERE id = ");
        builder.push_bind(req.id.clone());
        builder.push(" AND deleted_at IS NULL");

        // Execute update
        let rows_affected = builder.build().execute(&self.pool).await?.rows_affected();

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

        // Delete all reminders for this note (soft-deleted notes shouldn't have active reminders)
        sqlx::query("DELETE FROM reminders WHERE note_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        tracing::debug!("Soft deleted note and removed reminders: {}", id);
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
        let blob_hash: String =
            sqlx::query_scalar("SELECT blob_hash FROM attachments WHERE id = ?")
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
    pub async fn create_reminder(
        &self,
        note_id: &str,
        trigger_time: chrono::DateTime<Utc>,
        sound_enabled: Option<bool>,
        sound_type: Option<String>,
        shake_enabled: Option<bool>,
        glow_enabled: Option<bool>,
    ) -> Result<Reminder> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let reminder = sqlx::query_as::<_, Reminder>(
            r#"
            INSERT INTO reminders (id, note_id, trigger_time, triggered, created_at, sound_enabled, sound_type, shake_enabled, glow_enabled)
            VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(note_id)
        .bind(trigger_time)
        .bind(now)
        .bind(sound_enabled)
        .bind(&sound_type)
        .bind(shake_enabled)
        .bind(glow_enabled)
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

    /// Delete a reminder
    pub async fn delete_reminder(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM reminders WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        tracing::debug!("Deleted reminder: {}", id);
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
    pub async fn record_backup(
        &self,
        path: &str,
        size: i64,
        manifest_hash: &str,
    ) -> Result<Backup> {
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

    /// Delete a backup record
    pub async fn delete_backup(&self, id: &str) -> Result<()> {
        sqlx::query(
            r#"
            DELETE FROM backups WHERE id = ?
            "#,
        )
        .bind(id)
        .execute(&self.pool)
        .await?;

        tracing::debug!("Deleted backup record: {}", id);
        Ok(())
    }

    /// Delete multiple backup records atomically in a single transaction
    pub async fn delete_backups_batch(&self, ids: &[String]) -> Result<()> {
        use sqlx::QueryBuilder;

        if ids.is_empty() {
            return Ok(());
        }

        // Use a transaction for atomic deletion
        let mut tx = self.pool.begin().await?;

        let mut builder: QueryBuilder<sqlx::Sqlite> =
            QueryBuilder::new("DELETE FROM backups WHERE id IN (");

        let mut separated = builder.separated(", ");
        for id in ids {
            separated.push_bind(id.clone());
        }
        separated.push_unseparated(")");

        builder.build().execute(&mut *tx).await?;

        tx.commit().await?;

        tracing::debug!("Deleted {} backup records atomically", ids.len());
        Ok(())
    }

    // ===== Full-Text Search (FTS5) Methods =====

    /// Extract plain text from Quill Delta JSON format
    /// Returns the concatenated text content from all insert operations
    pub fn extract_text_from_delta(content_json: &str) -> String {
        let parsed: std::result::Result<Value, _> = serde_json::from_str(content_json);

        match parsed {
            Ok(json) => {
                if let Some(ops) = json.get("ops").and_then(|o| o.as_array()) {
                    ops.iter()
                        .filter_map(|op| op.get("insert").and_then(|insert| insert.as_str()))
                        .collect::<Vec<&str>>()
                        .join("")
                } else {
                    String::new()
                }
            }
            Err(_) => String::new(),
        }
    }

    /// Insert a note into the FTS index
    pub async fn insert_note_fts(
        &self,
        note_id: &str,
        title: &str,
        content_json: &str,
    ) -> Result<()> {
        let content_text = Self::extract_text_from_delta(content_json);

        sqlx::query(
            r#"
            INSERT INTO notes_fts (note_id, title, content_text)
            VALUES (?, ?, ?)
            "#,
        )
        .bind(note_id)
        .bind(title)
        .bind(&content_text)
        .execute(&self.pool)
        .await?;

        tracing::debug!("Inserted note into FTS index: {}", note_id);
        Ok(())
    }

    /// Update a note in the FTS index
    pub async fn update_note_fts(
        &self,
        note_id: &str,
        title: Option<&str>,
        content_json: Option<&str>,
    ) -> Result<()> {
        // FTS5 doesn't support partial updates, so we need to delete and re-insert
        // First, get the current values if not provided
        let current = self.get_note(note_id).await?;

        let final_title = title.unwrap_or(&current.title);
        let final_content = content_json.unwrap_or(&current.content_json);
        let content_text = Self::extract_text_from_delta(final_content);

        // Delete existing entry
        sqlx::query("DELETE FROM notes_fts WHERE note_id = ?")
            .bind(note_id)
            .execute(&self.pool)
            .await?;

        // Insert updated entry
        sqlx::query(
            r#"
            INSERT INTO notes_fts (note_id, title, content_text)
            VALUES (?, ?, ?)
            "#,
        )
        .bind(note_id)
        .bind(final_title)
        .bind(&content_text)
        .execute(&self.pool)
        .await?;

        tracing::debug!("Updated note in FTS index: {}", note_id);
        Ok(())
    }

    /// Delete a note from the FTS index
    pub async fn delete_note_fts(&self, note_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM notes_fts WHERE note_id = ?")
            .bind(note_id)
            .execute(&self.pool)
            .await?;

        tracing::debug!("Deleted note from FTS index: {}", note_id);
        Ok(())
    }

    /// Search notes using FTS5 full-text search
    /// Returns notes matching the query, ordered by relevance
    pub async fn search_notes_fts(&self, query: &str) -> Result<Vec<Note>> {
        // Escape special FTS5 characters and prepare query
        // FTS5 uses MATCH for searching
        let search_query = format!("{}*", query.replace('"', "\"\""));

        let notes = sqlx::query_as::<_, Note>(
            r#"
            SELECT n.* FROM notes n
            INNER JOIN notes_fts fts ON n.id = fts.note_id
            WHERE notes_fts MATCH ?
            AND n.deleted_at IS NULL
            ORDER BY bm25(notes_fts)
            "#,
        )
        .bind(&search_query)
        .fetch_all(&self.pool)
        .await?;

        Ok(notes)
    }

    /// Search notes by attachment filename using LIKE (for attachment search)
    pub async fn search_notes_by_attachment(&self, query: &str) -> Result<Vec<String>> {
        let pattern = format!("%{}%", query.to_lowercase());

        let note_ids: Vec<String> = sqlx::query_scalar(
            r#"
            SELECT DISTINCT note_id FROM attachments
            WHERE LOWER(filename) LIKE ?
            "#,
        )
        .bind(&pattern)
        .fetch_all(&self.pool)
        .await?;

        Ok(note_ids)
    }

    /// Rebuild the FTS index for all existing notes
    /// This is called after migrations to properly populate the index with content
    pub async fn rebuild_fts_index(&self) -> Result<()> {
        tracing::info!("Rebuilding FTS index for all notes");

        // Get all non-deleted notes
        let notes = self.list_notes().await?;
        let total = notes.len();

        for (i, note) in notes.iter().enumerate() {
            let content_text = Self::extract_text_from_delta(&note.content_json);

            // Delete existing entry if any
            sqlx::query("DELETE FROM notes_fts WHERE note_id = ?")
                .bind(&note.id)
                .execute(&self.pool)
                .await?;

            // Insert with proper content
            sqlx::query(
                r#"
                INSERT INTO notes_fts (note_id, title, content_text)
                VALUES (?, ?, ?)
                "#,
            )
            .bind(&note.id)
            .bind(&note.title)
            .bind(&content_text)
            .execute(&self.pool)
            .await?;

            if (i + 1) % 100 == 0 || i + 1 == total {
                tracing::info!("FTS index rebuilt for {}/{} notes", i + 1, total);
            }
        }

        tracing::info!("FTS index rebuild complete");
        Ok(())
    }

    /// Count soft-deleted notes
    pub async fn count_deleted_notes(&self) -> Result<i64> {
        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM notes WHERE deleted_at IS NOT NULL
            "#,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(count.0)
    }

    /// Permanently delete all soft-deleted notes and their associated data
    /// Returns the number of notes permanently deleted
    pub async fn prune_deleted_notes(&self) -> Result<i64> {
        // Get list of soft-deleted note IDs
        let deleted_note_ids: Vec<(String,)> = sqlx::query_as(
            r#"
            SELECT id FROM notes WHERE deleted_at IS NOT NULL
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let count = deleted_note_ids.len() as i64;

        if count == 0 {
            tracing::debug!("No deleted notes to prune");
            return Ok(0);
        }

        tracing::info!("Pruning {} soft-deleted notes", count);

        for (note_id,) in &deleted_note_ids {
            // Delete FTS entries
            sqlx::query("DELETE FROM notes_fts WHERE note_id = ?")
                .bind(note_id)
                .execute(&self.pool)
                .await?;

            // Delete attachments metadata (blobs are handled separately)
            sqlx::query("DELETE FROM attachments WHERE note_id = ?")
                .bind(note_id)
                .execute(&self.pool)
                .await?;

            // Delete reminders (should already be deleted during soft-delete, but ensure cleanup)
            sqlx::query("DELETE FROM reminders WHERE note_id = ?")
                .bind(note_id)
                .execute(&self.pool)
                .await?;
        }

        // Finally delete all soft-deleted notes
        sqlx::query("DELETE FROM notes WHERE deleted_at IS NOT NULL")
            .execute(&self.pool)
            .await?;

        tracing::info!("Successfully pruned {} notes", count);
        Ok(count)
    }

    // ===== Collections Methods =====

    /// Create a new collection
    pub async fn create_collection(&self, req: CreateCollectionRequest) -> Result<Collection> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Get the highest sort order and add 1
        let max_sort: Option<i32> = sqlx::query_scalar("SELECT MAX(sort_order) FROM collections")
            .fetch_optional(&self.pool)
            .await?
            .flatten();
        let sort_order = max_sort.unwrap_or(0) + 1;

        let color = req.color.unwrap_or_else(|| "#6B7280".to_string());
        let icon = req.icon.unwrap_or_else(|| "folder".to_string());

        let collection = sqlx::query_as::<_, Collection>(
            r#"
            INSERT INTO collections (id, name, description, color, icon, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&color)
        .bind(&icon)
        .bind(sort_order)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        tracing::debug!("Created collection: {}", id);
        Ok(collection)
    }

    /// Get a collection by ID
    pub async fn get_collection(&self, id: &str) -> Result<Collection> {
        let collection = sqlx::query_as::<_, Collection>(
            r#"
            SELECT * FROM collections WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::Generic(format!("Collection not found: {}", id)))?;

        Ok(collection)
    }

    /// Get a collection by name (case-insensitive)
    /// Useful for importing data where section/folder names should map to existing collections
    #[allow(dead_code)]
    pub async fn get_collection_by_name(&self, name: &str) -> Result<Option<Collection>> {
        let collection = sqlx::query_as::<_, Collection>(
            r#"
            SELECT * FROM collections WHERE LOWER(name) = LOWER(?)
            "#,
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await?;

        Ok(collection)
    }

    /// List all collections ordered by sort_order
    pub async fn list_collections(&self) -> Result<Vec<Collection>> {
        let collections = sqlx::query_as::<_, Collection>(
            r#"
            SELECT * FROM collections ORDER BY sort_order ASC, created_at ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(collections)
    }

    /// Update a collection
    pub async fn update_collection(&self, req: UpdateCollectionRequest) -> Result<Collection> {
        use sqlx::QueryBuilder;

        let now = Utc::now();

        let mut builder: QueryBuilder<sqlx::Sqlite> =
            QueryBuilder::new("UPDATE collections SET updated_at = ");
        builder.push_bind(now.to_rfc3339());

        if let Some(name) = &req.name {
            builder.push(", name = ");
            builder.push_bind(name.clone());
        }

        if let Some(description) = &req.description {
            builder.push(", description = ");
            builder.push_bind(description.clone());
        }

        if let Some(color) = &req.color {
            builder.push(", color = ");
            builder.push_bind(color.clone());
        }

        if let Some(icon) = &req.icon {
            builder.push(", icon = ");
            builder.push_bind(icon.clone());
        }

        if let Some(sort_order) = req.sort_order {
            builder.push(", sort_order = ");
            builder.push_bind(sort_order);
        }

        builder.push(" WHERE id = ");
        builder.push_bind(req.id.clone());

        let rows_affected = builder.build().execute(&self.pool).await?.rows_affected();

        if rows_affected == 0 {
            return Err(AppError::Generic(format!(
                "Collection not found: {}",
                req.id
            )));
        }

        self.get_collection(&req.id).await
    }

    /// Delete a collection (notes in this collection will have collection_id set to NULL)
    pub async fn delete_collection(&self, id: &str) -> Result<()> {
        let rows = sqlx::query("DELETE FROM collections WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?
            .rows_affected();

        if rows == 0 {
            return Err(AppError::Generic(format!("Collection not found: {}", id)));
        }

        tracing::debug!("Deleted collection: {}", id);
        Ok(())
    }

    /// Update a note's collection
    pub async fn update_note_collection(
        &self,
        note_id: &str,
        collection_id: Option<&str>,
    ) -> Result<Note> {
        let now = Utc::now();

        let rows = sqlx::query(
            r#"
            UPDATE notes SET collection_id = ?, updated_at = ?
            WHERE id = ? AND deleted_at IS NULL
            "#,
        )
        .bind(collection_id)
        .bind(now)
        .bind(note_id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows == 0 {
            return Err(AppError::NoteNotFound(note_id.to_string()));
        }

        self.get_note(note_id).await
    }

    /// List notes in a collection
    pub async fn list_notes_in_collection(&self, collection_id: &str) -> Result<Vec<Note>> {
        let notes = sqlx::query_as::<_, Note>(
            r#"
            SELECT * FROM notes
            WHERE collection_id = ? AND deleted_at IS NULL
            ORDER BY updated_at DESC
            "#,
        )
        .bind(collection_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(notes)
    }

    /// List notes without a collection (uncategorized)
    pub async fn list_uncategorized_notes(&self) -> Result<Vec<Note>> {
        let notes = sqlx::query_as::<_, Note>(
            r#"
            SELECT * FROM notes
            WHERE collection_id IS NULL AND deleted_at IS NULL
            ORDER BY updated_at DESC
            "#,
        )
        .bind::<Option<String>>(None)
        .fetch_all(&self.pool)
        .await?;

        Ok(notes)
    }

    /// Count notes in a collection
    pub async fn count_notes_in_collection(&self, collection_id: &str) -> Result<i64> {
        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM notes
            WHERE collection_id = ? AND deleted_at IS NULL
            "#,
        )
        .bind(collection_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count.0)
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
            title_modified: None,
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
        let reminder = repo
            .create_reminder(&note.id, trigger_time, None, None, None, None)
            .await
            .unwrap();

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

    // ===== FTS (Full-Text Search) Tests =====

    #[tokio::test]
    async fn test_fts_search() {
        let repo = create_test_repo().await;

        // Create notes with FTS indexing
        let note1 = repo
            .create_note(CreateNoteRequest {
                title: "Meeting Notes".to_string(),
                content_json: r#"{"ops":[{"insert":"Discuss project timeline\n"}]}"#.to_string(),
            })
            .await
            .unwrap();

        repo.insert_note_fts(&note1.id, &note1.title, &note1.content_json)
            .await
            .unwrap();

        let note2 = repo
            .create_note(CreateNoteRequest {
                title: "Shopping List".to_string(),
                content_json: r#"{"ops":[{"insert":"Buy groceries\n"}]}"#.to_string(),
            })
            .await
            .unwrap();

        repo.insert_note_fts(&note2.id, &note2.title, &note2.content_json)
            .await
            .unwrap();

        // Search by title
        let results = repo.search_notes_fts("meeting").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Meeting Notes");

        // Search by content
        let results = repo.search_notes_fts("groceries").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Shopping List");
    }

    #[tokio::test]
    async fn test_fts_update() {
        let repo = create_test_repo().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Original Title".to_string(),
                content_json: r#"{"ops":[{"insert":"Original content\n"}]}"#.to_string(),
            })
            .await
            .unwrap();

        repo.insert_note_fts(&note.id, &note.title, &note.content_json)
            .await
            .unwrap();

        // Update note
        let _updated = repo
            .update_note(UpdateNoteRequest {
                id: note.id.clone(),
                title: Some("Updated Title".to_string()),
                content_json: Some(r#"{"ops":[{"insert":"Updated content\n"}]}"#.to_string()),
                title_modified: None,
            })
            .await
            .unwrap();

        // Update FTS index
        repo.update_note_fts(
            &note.id,
            Some("Updated Title"),
            Some(r#"{"ops":[{"insert":"Updated content\n"}]}"#),
        )
        .await
        .unwrap();

        // Search should find updated content
        let results = repo.search_notes_fts("Updated").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Updated Title");

        // Original content should not be found
        let results = repo.search_notes_fts("Original").await.unwrap();
        assert_eq!(results.len(), 0);
    }

    #[tokio::test]
    async fn test_fts_delete() {
        let repo = create_test_repo().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Deletable Note".to_string(),
                content_json: r#"{"ops":[{"insert":"Will be deleted\n"}]}"#.to_string(),
            })
            .await
            .unwrap();

        repo.insert_note_fts(&note.id, &note.title, &note.content_json)
            .await
            .unwrap();

        // Verify it's searchable
        let results = repo.search_notes_fts("Deletable").await.unwrap();
        assert_eq!(results.len(), 1);

        // Delete from FTS
        repo.delete_note_fts(&note.id).await.unwrap();

        // Should not be found anymore
        let results = repo.search_notes_fts("Deletable").await.unwrap();
        assert_eq!(results.len(), 0);
    }

    #[tokio::test]
    async fn test_extract_text_from_delta() {
        // Valid delta with text
        let delta = r#"{"ops":[{"insert":"Hello "},{"insert":"World","attributes":{"bold":true}},{"insert":"\n"}]}"#;
        let text = Repository::extract_text_from_delta(delta);
        assert_eq!(text, "Hello World\n");

        // Empty delta
        let empty = r#"{"ops":[{"insert":"\n"}]}"#;
        let text = Repository::extract_text_from_delta(empty);
        assert_eq!(text, "\n");

        // Invalid JSON
        let invalid = "not valid json";
        let text = Repository::extract_text_from_delta(invalid);
        assert_eq!(text, "");

        // Delta with embeds (images)
        let embed = r#"{"ops":[{"insert":"Before "},{"insert":{"image":"data:..."}},{"insert":" After\n"}]}"#;
        let text = Repository::extract_text_from_delta(embed);
        assert_eq!(text, "Before  After\n");
    }

    // ===== Collections Tests =====

    #[tokio::test]
    async fn test_create_collection() {
        let repo = create_test_repo().await;

        let req = CreateCollectionRequest {
            name: "Work".to_string(),
            description: Some("Work-related notes".to_string()),
            color: Some("#3B82F6".to_string()),
            icon: Some("briefcase".to_string()),
        };

        let collection = repo.create_collection(req).await.unwrap();

        assert_eq!(collection.name, "Work");
        assert_eq!(
            collection.description,
            Some("Work-related notes".to_string())
        );
        assert_eq!(collection.color, "#3B82F6");
        assert_eq!(collection.icon, Some("briefcase".to_string()));
        assert_eq!(collection.sort_order, 1);
    }

    #[tokio::test]
    async fn test_collection_sort_order() {
        let repo = create_test_repo().await;

        // Create multiple collections
        let c1 = repo
            .create_collection(CreateCollectionRequest {
                name: "First".to_string(),
                description: None,
                color: None,
                icon: None,
            })
            .await
            .unwrap();

        let c2 = repo
            .create_collection(CreateCollectionRequest {
                name: "Second".to_string(),
                description: None,
                color: None,
                icon: None,
            })
            .await
            .unwrap();

        let c3 = repo
            .create_collection(CreateCollectionRequest {
                name: "Third".to_string(),
                description: None,
                color: None,
                icon: None,
            })
            .await
            .unwrap();

        assert_eq!(c1.sort_order, 1);
        assert_eq!(c2.sort_order, 2);
        assert_eq!(c3.sort_order, 3);
    }

    #[tokio::test]
    async fn test_update_collection() {
        let repo = create_test_repo().await;

        let collection = repo
            .create_collection(CreateCollectionRequest {
                name: "Original".to_string(),
                description: None,
                color: None,
                icon: None,
            })
            .await
            .unwrap();

        let updated = repo
            .update_collection(UpdateCollectionRequest {
                id: collection.id.clone(),
                name: Some("Updated".to_string()),
                description: Some("New description".to_string()),
                color: Some("#EF4444".to_string()),
                icon: Some("star".to_string()),
                sort_order: Some(5),
            })
            .await
            .unwrap();

        assert_eq!(updated.name, "Updated");
        assert_eq!(updated.description, Some("New description".to_string()));
        assert_eq!(updated.color, "#EF4444");
        assert_eq!(updated.icon, Some("star".to_string()));
        assert_eq!(updated.sort_order, 5);
    }

    #[tokio::test]
    async fn test_delete_collection() {
        let repo = create_test_repo().await;

        let collection = repo
            .create_collection(CreateCollectionRequest {
                name: "To Delete".to_string(),
                description: None,
                color: None,
                icon: None,
            })
            .await
            .unwrap();

        repo.delete_collection(&collection.id).await.unwrap();

        let result = repo.get_collection(&collection.id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_notes_in_collection() {
        let repo = create_test_repo().await;

        // Create a collection
        let collection = repo
            .create_collection(CreateCollectionRequest {
                name: "Work".to_string(),
                description: None,
                color: None,
                icon: None,
            })
            .await
            .unwrap();

        // Create notes
        let note1 = repo
            .create_note(CreateNoteRequest {
                title: "Work Note 1".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let note2 = repo
            .create_note(CreateNoteRequest {
                title: "Work Note 2".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let _note3 = repo
            .create_note(CreateNoteRequest {
                title: "Personal Note".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Move notes to collection
        repo.update_note_collection(&note1.id, Some(&collection.id))
            .await
            .unwrap();
        repo.update_note_collection(&note2.id, Some(&collection.id))
            .await
            .unwrap();

        // List notes in collection
        let notes = repo.list_notes_in_collection(&collection.id).await.unwrap();
        assert_eq!(notes.len(), 2);

        // List uncategorized notes
        let uncategorized = repo.list_uncategorized_notes().await.unwrap();
        assert_eq!(uncategorized.len(), 1);
        assert_eq!(uncategorized[0].title, "Personal Note");

        // Count notes in collection
        let count = repo
            .count_notes_in_collection(&collection.id)
            .await
            .unwrap();
        assert_eq!(count, 2);
    }

    #[tokio::test]
    async fn test_remove_note_from_collection() {
        let repo = create_test_repo().await;

        let collection = repo
            .create_collection(CreateCollectionRequest {
                name: "Test".to_string(),
                description: None,
                color: None,
                icon: None,
            })
            .await
            .unwrap();

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Movable Note".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Add to collection
        repo.update_note_collection(&note.id, Some(&collection.id))
            .await
            .unwrap();

        let count = repo
            .count_notes_in_collection(&collection.id)
            .await
            .unwrap();
        assert_eq!(count, 1);

        // Remove from collection
        repo.update_note_collection(&note.id, None).await.unwrap();

        let count = repo
            .count_notes_in_collection(&collection.id)
            .await
            .unwrap();
        assert_eq!(count, 0);

        let uncategorized = repo.list_uncategorized_notes().await.unwrap();
        assert_eq!(uncategorized.len(), 1);
    }

    // ===== Batch Operations Tests =====

    #[tokio::test]
    async fn test_get_notes_by_ids() {
        let repo = create_test_repo().await;

        let note1 = repo
            .create_note(CreateNoteRequest {
                title: "Note 1".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let note2 = repo
            .create_note(CreateNoteRequest {
                title: "Note 2".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let _note3 = repo
            .create_note(CreateNoteRequest {
                title: "Note 3".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Get specific notes
        let ids = vec![note1.id.clone(), note2.id.clone()];
        let notes = repo.get_notes_by_ids(&ids).await.unwrap();
        assert_eq!(notes.len(), 2);

        // Empty list
        let empty: Vec<String> = vec![];
        let notes = repo.get_notes_by_ids(&empty).await.unwrap();
        assert_eq!(notes.len(), 0);
    }

    #[tokio::test]
    async fn test_delete_backups_batch() {
        let repo = create_test_repo().await;

        // Create some backups
        let backup1 = repo
            .record_backup("/path/backup1.zip", 1000, "hash1")
            .await
            .unwrap();
        let backup2 = repo
            .record_backup("/path/backup2.zip", 2000, "hash2")
            .await
            .unwrap();
        let backup3 = repo
            .record_backup("/path/backup3.zip", 3000, "hash3")
            .await
            .unwrap();

        // Delete batch
        let ids = vec![backup1.id.clone(), backup2.id.clone()];
        repo.delete_backups_batch(&ids).await.unwrap();

        // Verify only backup3 remains
        let backups = repo.list_backups().await.unwrap();
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].id, backup3.id);
    }

    // ===== Edge Cases & Error Handling Tests =====

    #[tokio::test]
    async fn test_get_nonexistent_note() {
        let repo = create_test_repo().await;

        let result = repo.get_note("nonexistent-id").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_nonexistent_note() {
        let repo = create_test_repo().await;

        let result = repo
            .update_note(UpdateNoteRequest {
                id: "nonexistent-id".to_string(),
                title: Some("New Title".to_string()),
                content_json: None,
                title_modified: None,
            })
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_nonexistent_note() {
        let repo = create_test_repo().await;

        let result = repo.delete_note("nonexistent-id").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_already_deleted_note() {
        let repo = create_test_repo().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Test".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // First delete
        repo.delete_note(&note.id).await.unwrap();

        // Second delete should fail
        let result = repo.delete_note(&note.id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_setting_nonexistent() {
        let repo = create_test_repo().await;

        let value = repo.get_setting("nonexistent_key").await.unwrap();
        assert_eq!(value, None);
    }

    #[tokio::test]
    async fn test_prune_deleted_notes() {
        let repo = create_test_repo().await;

        // Create notes
        let _note1 = repo
            .create_note(CreateNoteRequest {
                title: "Active Note".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let note2 = repo
            .create_note(CreateNoteRequest {
                title: "To Delete 1".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let note3 = repo
            .create_note(CreateNoteRequest {
                title: "To Delete 2".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Soft delete some notes
        repo.delete_note(&note2.id).await.unwrap();
        repo.delete_note(&note3.id).await.unwrap();

        // Count deleted
        let count = repo.count_deleted_notes().await.unwrap();
        assert_eq!(count, 2);

        // Prune
        let pruned = repo.prune_deleted_notes().await.unwrap();
        assert_eq!(pruned, 2);

        // Verify deleted notes are gone
        let count = repo.count_deleted_notes().await.unwrap();
        assert_eq!(count, 0);

        // Active note should still exist
        let notes = repo.list_notes().await.unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].title, "Active Note");
    }

    #[tokio::test]
    async fn test_search_by_attachment() {
        let repo = create_test_repo().await;

        let note1 = repo
            .create_note(CreateNoteRequest {
                title: "Note with image".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let note2 = repo
            .create_note(CreateNoteRequest {
                title: "Note with document".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Add attachments
        repo.create_attachment(&note1.id, "hash1", "vacation_photo.jpg", "image/jpeg", 1000)
            .await
            .unwrap();

        repo.create_attachment(&note2.id, "hash2", "report.pdf", "application/pdf", 2000)
            .await
            .unwrap();

        // Search by filename
        let results = repo.search_notes_by_attachment("vacation").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], note1.id);

        let results = repo.search_notes_by_attachment("report").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], note2.id);

        // Case insensitive search
        let results = repo.search_notes_by_attachment("VACATION").await.unwrap();
        assert_eq!(results.len(), 1);
    }

    #[tokio::test]
    async fn test_update_note_title_modified() {
        let repo = create_test_repo().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Auto Title".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        assert!(!note.title_modified);

        // Update with title_modified flag
        let updated = repo
            .update_note(UpdateNoteRequest {
                id: note.id.clone(),
                title: Some("Manual Title".to_string()),
                content_json: None,
                title_modified: Some(true),
            })
            .await
            .unwrap();

        assert!(updated.title_modified);
    }

    #[tokio::test]
    async fn test_delete_attachment() {
        let repo = create_test_repo().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Note".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let attachment = repo
            .create_attachment(&note.id, "hash123", "file.txt", "text/plain", 100)
            .await
            .unwrap();

        // Delete attachment
        let blob_hash = repo.delete_attachment(&attachment.id).await.unwrap();
        assert_eq!(blob_hash, "hash123");

        // Verify it's deleted
        let attachments = repo.list_attachments(&note.id).await.unwrap();
        assert_eq!(attachments.len(), 0);
    }

    #[tokio::test]
    async fn test_delete_reminder() {
        let repo = create_test_repo().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Note".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        let trigger_time = Utc::now() + chrono::Duration::hours(1);
        let reminder = repo
            .create_reminder(&note.id, trigger_time, None, None, None, None)
            .await
            .unwrap();

        // Delete reminder
        repo.delete_reminder(&reminder.id).await.unwrap();

        // Verify it's deleted
        let reminders = repo.list_active_reminders().await.unwrap();
        assert_eq!(reminders.len(), 0);
    }

    #[tokio::test]
    async fn test_list_collections() {
        let repo = create_test_repo().await;

        repo.create_collection(CreateCollectionRequest {
            name: "A".to_string(),
            description: None,
            color: None,
            icon: None,
        })
        .await
        .unwrap();

        repo.create_collection(CreateCollectionRequest {
            name: "B".to_string(),
            description: None,
            color: None,
            icon: None,
        })
        .await
        .unwrap();

        repo.create_collection(CreateCollectionRequest {
            name: "C".to_string(),
            description: None,
            color: None,
            icon: None,
        })
        .await
        .unwrap();

        let collections = repo.list_collections().await.unwrap();
        assert_eq!(collections.len(), 3);

        // Should be ordered by sort_order
        assert_eq!(collections[0].name, "A");
        assert_eq!(collections[1].name, "B");
        assert_eq!(collections[2].name, "C");
    }
}

//! Database models
//!
//! Rust structs representing database entities.
//! All models use serde for serialization to frontend.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// A note with rich text content
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Note {
    pub id: String,
    pub title: String,
    /// JSON-encoded Quill Delta format
    pub content_json: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Create note request
#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content_json: String,
}

/// Update note request
#[derive(Debug, Deserialize)]
pub struct UpdateNoteRequest {
    pub id: String,
    pub title: Option<String>,
    pub content_json: Option<String>,
}

/// File attachment linked to a note
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attachment {
    pub id: String,
    pub note_id: String,
    /// SHA-256 hash of the file content
    pub blob_hash: String,
    pub filename: String,
    pub mime_type: String,
    pub size: i64,
    pub created_at: DateTime<Utc>,
}

/// Reminder for a note
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Reminder {
    pub id: String,
    pub note_id: String,
    pub trigger_time: DateTime<Utc>,
    pub triggered: bool,
    pub created_at: DateTime<Utc>,
}

/// Backup record
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Backup {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub path: String,
    pub size: i64,
    pub manifest_hash: String,
}

/// Application setting
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

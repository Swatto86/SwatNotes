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
    /// Whether the title was manually modified (vs auto-generated from content)
    pub title_modified: bool,
    /// Optional collection/folder this note belongs to
    #[serde(default)]
    pub collection_id: Option<String>,
}

/// A collection/folder for organizing notes
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub icon: Option<String>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create collection request
#[derive(Debug, Deserialize)]
pub struct CreateCollectionRequest {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

/// Update collection request
#[derive(Debug, Deserialize)]
pub struct UpdateCollectionRequest {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: Option<i32>,
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
    /// Whether the title was manually modified (vs auto-generated from content)
    pub title_modified: Option<bool>,
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
    /// Per-reminder sound setting (None = use global default)
    pub sound_enabled: Option<bool>,
    /// Per-reminder sound type (None = use global default)
    pub sound_type: Option<String>,
    /// Per-reminder shake animation setting (None = use global default)
    pub shake_enabled: Option<bool>,
    /// Per-reminder glow effect setting (None = use global default)
    pub glow_enabled: Option<bool>,
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

/// Application setting (reserved for future use)
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

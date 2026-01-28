//! Attachment-related commands
//!
//! CRUD operations for note attachments.

use crate::app::AppState;
use crate::database::Attachment;
use crate::error::Result;
use tauri::State;

/// Create a new attachment for a note
#[tauri::command]
pub async fn create_attachment(
    state: State<'_, AppState>,
    note_id: String,
    filename: String,
    mime_type: String,
    data: Vec<u8>,
) -> Result<Attachment> {
    state
        .attachments_service
        .create_attachment(&note_id, &filename, &mime_type, &data)
        .await
}

/// List all attachments for a note
#[tauri::command]
pub async fn list_attachments(
    state: State<'_, AppState>,
    note_id: String,
) -> Result<Vec<Attachment>> {
    state.attachments_service.list_attachments(&note_id).await
}

/// Get attachment data by blob hash
#[tauri::command]
pub async fn get_attachment_data(state: State<'_, AppState>, blob_hash: String) -> Result<Vec<u8>> {
    state
        .attachments_service
        .get_attachment_by_hash(&blob_hash)
        .await
}

/// Delete an attachment
#[tauri::command]
pub async fn delete_attachment(state: State<'_, AppState>, attachment_id: String) -> Result<()> {
    state
        .attachments_service
        .delete_attachment(&attachment_id)
        .await
}

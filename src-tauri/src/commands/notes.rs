//! Note-related commands
//!
//! CRUD operations and search for notes.

use crate::app::AppState;
use crate::database::Note;
use crate::error::Result;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Create a new note
#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    title: String,
    content_json: String,
) -> Result<Note> {
    state.notes_service.create_note(title, content_json).await
}

/// Get a note by ID
#[tauri::command]
pub async fn get_note(state: State<'_, AppState>, id: String) -> Result<Note> {
    state.notes_service.get_note(&id).await
}

/// List all non-deleted notes
#[tauri::command]
pub async fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>> {
    state.notes_service.list_notes().await
}

/// Update a note
#[tauri::command]
pub async fn update_note(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content_json: Option<String>,
    title_modified: Option<bool>,
) -> Result<Note> {
    state
        .notes_service
        .update_note(id, title, content_json, title_modified)
        .await
}

/// Soft delete a note
#[tauri::command]
pub async fn delete_note(state: State<'_, AppState>, id: String) -> Result<()> {
    state.notes_service.delete_note(&id).await
}

/// Search notes using full-text search
#[tauri::command]
pub async fn search_notes(state: State<'_, AppState>, query: String) -> Result<Vec<Note>> {
    state.notes_service.search_notes(&query).await
}

/// Get count of soft-deleted notes (in trash)
#[tauri::command]
pub async fn count_deleted_notes(state: State<'_, AppState>) -> Result<i64> {
    state.notes_service.count_deleted_notes().await
}

/// Permanently delete all soft-deleted notes
#[tauri::command]
pub async fn prune_deleted_notes(state: State<'_, AppState>) -> Result<i64> {
    state.notes_service.prune_deleted_notes().await
}

/// Quick capture from clipboard - creates a new note from clipboard text
#[tauri::command]
pub async fn quick_capture_from_clipboard(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Note> {
    tracing::info!("Quick capture from clipboard");

    // Read text from clipboard
    let clipboard_text = app
        .clipboard()
        .read_text()
        .map_err(|e| crate::error::AppError::Generic(format!("Failed to read clipboard: {}", e)))?;

    if clipboard_text.trim().is_empty() {
        return Err(crate::error::AppError::Generic(
            "Clipboard is empty or contains no text".to_string(),
        ));
    }

    // Generate title from first line or first 50 chars
    let title = clipboard_text
        .lines()
        .next()
        .unwrap_or(&clipboard_text)
        .chars()
        .take(50)
        .collect::<String>()
        .trim()
        .to_string();

    let title = if title.is_empty() {
        "Quick Capture".to_string()
    } else {
        title
    };

    // Convert plain text to Quill Delta JSON format
    let content_json = serde_json::json!({
        "ops": [
            { "insert": format!("{}\n", clipboard_text) }
        ]
    })
    .to_string();

    // Create the note
    let note = state.notes_service.create_note(title, content_json).await?;

    // Open in sticky note window
    if let Err(e) =
        crate::commands::open_note_window(app.clone(), state.clone(), note.id.clone()).await
    {
        tracing::warn!("Failed to open note window after quick capture: {}", e);
    }

    // Emit refresh event for main window
    let _ = app.emit("refresh-notes", ());

    tracing::info!("Quick capture completed: {}", note.id);
    Ok(note)
}

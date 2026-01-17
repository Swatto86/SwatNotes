//! Tauri commands exposed to the frontend
//!
//! All commands follow the pattern:
//! - Take AppState as first parameter
//! - Return Result<T, AppError>
//! - Are async when performing I/O

use crate::app::AppState;
use crate::database::Note;
use crate::error::Result;
use tauri::State;

#[tauri::command]
pub async fn greet(name: String) -> Result<String> {
    tracing::info!("Greet command called with name: {}", name);
    Ok(format!("Hello, {}! Welcome to QuickNotes.", name))
}

#[tauri::command]
pub async fn get_app_info(state: State<'_, AppState>) -> Result<AppInfo> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        app_data_dir: state.app_data_dir.to_string_lossy().to_string(),
    })
}

#[derive(serde::Serialize)]
pub struct AppInfo {
    pub version: String,
    pub app_data_dir: String,
}

// ===== Note Commands =====

#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    title: String,
    content_json: String,
) -> Result<Note> {
    state.notes_service.create_note(title, content_json).await
}

#[tauri::command]
pub async fn get_note(state: State<'_, AppState>, id: String) -> Result<Note> {
    state.notes_service.get_note(&id).await
}

#[tauri::command]
pub async fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>> {
    state.notes_service.list_notes().await
}

#[tauri::command]
pub async fn update_note(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content_json: Option<String>,
) -> Result<Note> {
    state
        .notes_service
        .update_note(id, title, content_json)
        .await
}

#[tauri::command]
pub async fn delete_note(state: State<'_, AppState>, id: String) -> Result<()> {
    state.notes_service.delete_note(&id).await
}

#[tauri::command]
pub async fn search_notes(state: State<'_, AppState>, query: String) -> Result<Vec<Note>> {
    state.notes_service.search_notes(&query).await
}

#[tauri::command]
pub async fn open_note_window(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    note_id: String,
) -> Result<()> {
    use tauri::Manager;
    use tauri::WebviewUrl;
    use tauri::WebviewWindowBuilder;

    // Get note to set window title
    let note = state.notes_service.get_note(&note_id).await?;

    // Create unique window label
    let window_label = format!("note-{}", note_id);

    // Check if window already exists
    if let Some(window) = app.get_webview_window(&window_label) {
        // If it exists, just focus it
        let _ = window.set_focus();
        return Ok(());
    }

    // Create new sticky note window
    let _window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App("sticky-note.html".into()),
    )
    .title(&note.title)
    .inner_size(350.0, 400.0)
    .min_inner_size(250.0, 300.0)
    .resizable(true)
    .decorations(true)
    .always_on_top(false)
    .skip_taskbar(false)
    .build()?;

    Ok(())
}

// ===== Attachment Commands =====

use crate::database::Attachment;

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

#[tauri::command]
pub async fn list_attachments(
    state: State<'_, AppState>,
    note_id: String,
) -> Result<Vec<Attachment>> {
    state.attachments_service.list_attachments(&note_id).await
}

#[tauri::command]
pub async fn get_attachment_data(
    state: State<'_, AppState>,
    blob_hash: String,
) -> Result<Vec<u8>> {
    state
        .attachments_service
        .get_attachment_by_hash(&blob_hash)
        .await
}

#[tauri::command]
pub async fn delete_attachment(state: State<'_, AppState>, attachment_id: String) -> Result<()> {
    state
        .attachments_service
        .delete_attachment(&attachment_id)
        .await
}

// ===== Backup Commands =====

use crate::database::Backup;

#[tauri::command]
pub async fn create_backup(state: State<'_, AppState>, password: String) -> Result<String> {
    let backup_path = state.backup_service.create_backup(&password).await?;
    Ok(backup_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn list_backups(state: State<'_, AppState>) -> Result<Vec<Backup>> {
    state.backup_service.list_backups().await
}

#[tauri::command]
pub async fn restore_backup(
    state: State<'_, AppState>,
    backup_path: String,
    password: String,
) -> Result<()> {
    use std::path::Path;
    state
        .backup_service
        .restore_backup(Path::new(&backup_path), &password)
        .await
}

// ===== Reminder Commands =====

use crate::database::Reminder;

#[tauri::command]
pub async fn create_reminder(
    state: State<'_, AppState>,
    note_id: String,
    trigger_time: String,
) -> Result<Reminder> {
    use chrono::DateTime;
    let trigger_dt = DateTime::parse_from_rfc3339(&trigger_time)
        .map_err(|e| crate::error::AppError::Generic(format!("Invalid datetime: {}", e)))?
        .with_timezone(&chrono::Utc);

    state
        .reminders_service
        .create_reminder(&note_id, trigger_dt)
        .await
}

#[tauri::command]
pub async fn list_active_reminders(state: State<'_, AppState>) -> Result<Vec<Reminder>> {
    state.reminders_service.list_active_reminders().await
}

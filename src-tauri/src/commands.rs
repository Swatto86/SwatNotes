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

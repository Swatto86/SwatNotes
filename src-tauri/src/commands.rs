//! Tauri commands exposed to the frontend
//!
//! All commands follow the pattern:
//! - Take AppState as first parameter
//! - Return Result<T, AppError>
//! - Are async when performing I/O

use crate::app::AppState;
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

//! Tauri commands exposed to the frontend
//!
//! This module organizes commands into logical submodules:
//! - `notes`: Note CRUD operations and search
//! - `windows`: Window management (sticky notes, settings)
//! - `attachments`: Attachment operations
//! - `backup`: Backup and restore operations
//! - `reminders`: Reminder operations
//! - `settings`: Application settings
//! - `updater`: Auto-update functionality
//! - `collections`: Collection/folder operations

pub mod attachments;
pub mod backup;
pub mod collections;
pub mod notes;
pub mod onenote;
pub mod reminders;
pub mod settings;
pub mod updater;
pub mod windows;

use crate::app::AppState;
use crate::error::Result;
use tauri::State;

// Re-export all commands for convenient registration in main.rs
pub use attachments::*;
pub use backup::*;
pub use collections::*;
pub use notes::*;
pub use onenote::*;
pub use reminders::*;
pub use settings::*;
pub use updater::*;
pub use windows::*;

// ===== General Commands =====

/// Simple greeting command for testing
#[tauri::command]
pub async fn greet(name: String) -> Result<String> {
    tracing::info!("Greet command called with name: {:?}", name);
    Ok(format!("Hello, {}! Welcome to SwatNotes.", name))
}

/// Get application information
#[tauri::command]
pub async fn get_app_info(state: State<'_, AppState>) -> Result<AppInfo> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        app_data_dir: state.app_data_dir.to_string_lossy().to_string(),
    })
}

/// Application information structure
#[derive(serde::Serialize)]
pub struct AppInfo {
    pub version: String,
    pub app_data_dir: String,
}

/// Restart the application
#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) {
    tracing::info!("Restarting application...");
    app.restart();
}

//! Backup-related commands
//!
//! Commands for creating, listing, restoring, and deleting backups.

use crate::app::AppState;
use crate::database::Backup;
use crate::error::{AppError, Result};
use crate::services::CredentialManager;
use std::path::Path;
use tauri::{Emitter, State};

/// Create an encrypted backup
/// If password is None, uses the stored auto-backup password
#[tauri::command]
pub async fn create_backup(state: State<'_, AppState>, password: Option<String>) -> Result<String> {
    // Use provided password or retrieve from credential manager
    let backup_password = match password {
        Some(pwd) if !pwd.is_empty() => pwd,
        _ => CredentialManager::get_auto_backup_password().map_err(|_| {
            AppError::Backup(
                "No password provided and no auto-backup password is set. \
                Please set an auto-backup password in Settings first."
                    .to_string(),
            )
        })?,
    };

    let backup_path = state.backup_service.create_backup(&backup_password).await?;
    Ok(backup_path.to_string_lossy().to_string())
}

/// List all available backups
#[tauri::command]
pub async fn list_backups(state: State<'_, AppState>) -> Result<Vec<Backup>> {
    state.backup_service.list_backups().await
}

/// Restore from an encrypted backup
///
/// Security: Validates that the backup path is within the allowed backups directory
/// to prevent path traversal attacks.
#[tauri::command]
pub async fn restore_backup(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    backup_path: String,
    password: String,
) -> Result<()> {
    let path = Path::new(&backup_path);

    // Security: Validate that the backup path is within the allowed backups directory
    let backup_dir = state.backup_service.get_backup_directory()?;

    // Canonicalize paths for proper comparison (resolves symlinks, .., etc.)
    let canonical_backup_dir = backup_dir
        .canonicalize()
        .map_err(|e| AppError::Backup(format!("Failed to resolve backup directory: {}", e)))?;

    let canonical_path = path
        .canonicalize()
        .map_err(|e| AppError::Backup(format!("Invalid backup path: {}", e)))?;

    if !canonical_path.starts_with(&canonical_backup_dir) {
        tracing::warn!(
            "Path traversal attempt blocked: {} is outside {}",
            backup_path,
            backup_dir.display()
        );
        return Err(AppError::Backup(
            "Invalid backup path: must be within the backups directory".to_string(),
        ));
    }

    state
        .backup_service
        .restore_backup(&canonical_path, &password)
        .await?;

    // Emit event to notify frontend that restore completed
    // Frontend should handle reconnection or app restart
    if let Err(e) = app.emit("backup-restored", ()) {
        tracing::warn!("Failed to emit backup-restored event: {}", e);
    }

    Ok(())
}

/// Delete a backup (both file and database record)
#[tauri::command]
pub async fn delete_backup(
    state: State<'_, AppState>,
    backup_id: String,
    backup_path: String,
) -> Result<()> {
    state
        .backup_service
        .delete_backup(&backup_id, &backup_path)
        .await
}

/// Pick a backup directory using folder picker dialog
/// Note: This is a placeholder - actual dialog is opened from frontend
#[tauri::command]
pub async fn pick_backup_directory() -> Result<Option<String>> {
    Ok(None)
}

/// Get current backup directory path
#[tauri::command]
pub async fn get_backup_directory(state: State<'_, AppState>) -> Result<String> {
    let settings = state.settings_service.get_auto_backup().await?;

    let backup_dir = if let Some(location) = settings.backup_location {
        location
    } else {
        state
            .app_data_dir
            .join("backups")
            .to_string_lossy()
            .to_string()
    };

    Ok(backup_dir)
}

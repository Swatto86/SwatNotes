//! Settings-related commands
//!
//! Commands for managing application settings including hotkeys, autostart,
//! auto-backup configuration, and reminder settings.

use crate::app::AppState;
use crate::error::{AppError, Result};
use crate::services::{AutoBackupSettings, CredentialManager, HotkeySettings, ReminderSettings};
use std::path::PathBuf;
use tauri::State;

// ===== Hotkey Settings =====

/// Get current hotkey settings
#[tauri::command]
pub async fn get_hotkey_settings(state: State<'_, AppState>) -> Result<HotkeySettings> {
    state.settings_service.get_hotkeys().await
}

/// Update hotkey settings
/// Note: Application restart required for changes to take effect
#[tauri::command]
pub async fn update_hotkey_settings(
    state: State<'_, AppState>,
    _app: tauri::AppHandle,
    hotkeys: HotkeySettings,
) -> Result<()> {
    state.settings_service.update_hotkeys(hotkeys).await?;

    tracing::warn!(
        "Hotkey settings updated. Application restart required for changes to take effect."
    );

    Ok(())
}

// ===== Autostart Settings =====

/// Enable or disable application autostart (Windows only)
#[tauri::command]
pub async fn set_autostart(_app: tauri::AppHandle, enabled: bool) -> Result<()> {
    use std::process::Command;

    let app_path = std::env::current_exe()
        .map_err(|e| AppError::Generic(format!("Failed to get executable path: {}", e)))?;
    let app_name = "SwatNotes";

    if enabled {
        // Add to Windows startup registry
        let output = Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                app_name,
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", app_path.display()),
                "/f",
            ])
            .output()
            .map_err(|e| AppError::Generic(format!("Failed to execute reg command: {}", e)))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Generic(format!(
                "Failed to enable autostart: {}",
                error_msg
            )));
        }

        tracing::info!("Autostart enabled for SwatNotes");
    } else {
        // Remove from Windows startup registry
        let output = Command::new("reg")
            .args([
                "delete",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                app_name,
                "/f",
            ])
            .output()
            .map_err(|e| AppError::Generic(format!("Failed to execute reg command: {}", e)))?;

        // Don't fail if the key doesn't exist
        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            if !error_msg.contains("unable to find") {
                tracing::warn!("Failed to disable autostart: {}", error_msg);
            }
        }

        tracing::info!("Autostart disabled for SwatNotes");
    }

    Ok(())
}

// ===== Auto-Backup Settings =====

/// Store auto-backup password in OS credential manager
#[tauri::command]
pub fn store_auto_backup_password(password: String) -> Result<()> {
    CredentialManager::store_auto_backup_password(&password)?;
    tracing::info!("Auto-backup password stored successfully");
    Ok(())
}

/// Check if auto-backup password is stored
#[tauri::command]
pub fn has_auto_backup_password() -> Result<bool> {
    Ok(CredentialManager::has_auto_backup_password())
}

/// Delete auto-backup password from OS credential manager
#[tauri::command]
pub fn delete_auto_backup_password() -> Result<()> {
    CredentialManager::delete_auto_backup_password()?;
    tracing::info!("Auto-backup password deleted successfully");
    Ok(())
}

/// Get auto-backup settings
#[tauri::command]
pub async fn get_auto_backup_settings(state: State<'_, AppState>) -> Result<AutoBackupSettings> {
    state.settings_service.get_auto_backup().await
}

/// Update auto-backup settings and reschedule
#[tauri::command]
pub async fn update_auto_backup_settings(
    state: State<'_, AppState>,
    settings: AutoBackupSettings,
) -> Result<()> {
    // Save settings to disk
    state
        .settings_service
        .update_auto_backup(settings.clone())
        .await?;

    // Update backup service directory if location changed
    if let Some(location) = &settings.backup_location {
        state
            .backup_service
            .set_backup_dir(PathBuf::from(location))?;
    } else {
        // Reset to default location
        let default_dir = state.app_data_dir.join("backups");
        state.backup_service.set_backup_dir(default_dir)?;
    }

    // Update scheduler
    if let Some(scheduler) = &state.scheduler_service {
        use crate::services::scheduler::BackupFrequency;
        let frequency = settings
            .frequency
            .parse::<BackupFrequency>()
            .unwrap_or(BackupFrequency::Days(7));
        scheduler
            .schedule_backup(frequency, settings.enabled)
            .await?;
        tracing::info!(
            "Auto-backup schedule updated: enabled={}, frequency={}",
            settings.enabled,
            settings.frequency
        );
    }

    Ok(())
}

// ===== Reminder Settings =====

/// Get reminder notification settings
#[tauri::command]
pub async fn get_reminder_settings(state: State<'_, AppState>) -> Result<ReminderSettings> {
    state.settings_service.get_reminders().await
}

/// Update reminder notification settings
#[tauri::command]
pub async fn update_reminder_settings(
    state: State<'_, AppState>,
    settings: ReminderSettings,
) -> Result<()> {
    state.settings_service.update_reminders(settings).await?;
    tracing::info!("Reminder settings updated");
    Ok(())
}

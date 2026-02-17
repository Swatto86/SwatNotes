//! Settings-related commands
//!
//! Commands for managing application settings including hotkeys, autostart,
//! auto-backup configuration, behavior settings, and reminder settings.
//!
//! All update commands validate input against limits defined in `config.rs`
//! before persisting (Rule 11b — Input Validation & Boundary Enforcement).

use crate::app::AppState;
use crate::config;
use crate::error::{AppError, Result};
use crate::services::{
    AutoBackupSettings, BehaviorSettings, CredentialManager, HotkeySettings, ReminderSettings,
};
use std::path::PathBuf;
use tauri::State;

// ===== Validation Helpers =====

/// Validate hotkey settings against configured limits.
/// Accumulates all errors before returning (Rule 11b batch feedback).
fn validate_hotkey_settings(hotkeys: &HotkeySettings) -> Result<()> {
    let mut errors: Vec<String> = Vec::new();

    let fields = [
        ("new_note", &hotkeys.new_note),
        ("toggle_note", &hotkeys.toggle_note),
        ("open_search", &hotkeys.open_search),
        ("open_settings", &hotkeys.open_settings),
        ("toggle_all_notes", &hotkeys.toggle_all_notes),
        ("quick_capture", &hotkeys.quick_capture),
    ];

    for (name, value) in &fields {
        if value.trim().is_empty() {
            errors.push(format!("Hotkey '{}' must not be empty", name));
        } else if value.len() > config::MAX_HOTKEY_LENGTH {
            errors.push(format!(
                "Hotkey '{}' exceeds maximum length of {} characters (got {})",
                name,
                config::MAX_HOTKEY_LENGTH,
                value.len()
            ));
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Generic(format!(
            "Hotkey validation failed:\n- {}",
            errors.join("\n- ")
        )))
    }
}

/// Validate reminder settings against configured limits.
/// Accumulates all errors before returning (Rule 11b batch feedback).
fn validate_reminder_settings(settings: &ReminderSettings) -> Result<()> {
    let mut errors: Vec<String> = Vec::new();

    if settings.sound_frequency < config::MIN_SOUND_FREQUENCY_HZ
        || settings.sound_frequency > config::MAX_SOUND_FREQUENCY_HZ
    {
        errors.push(format!(
            "Sound frequency must be between {} and {} Hz (got {})",
            config::MIN_SOUND_FREQUENCY_HZ,
            config::MAX_SOUND_FREQUENCY_HZ,
            settings.sound_frequency
        ));
    }

    if settings.sound_duration < config::MIN_SOUND_DURATION_MS
        || settings.sound_duration > config::MAX_SOUND_DURATION_MS
    {
        errors.push(format!(
            "Sound duration must be between {} and {} ms (got {})",
            config::MIN_SOUND_DURATION_MS,
            config::MAX_SOUND_DURATION_MS,
            settings.sound_duration
        ));
    }

    if settings.shake_duration < config::MIN_SHAKE_DURATION_MS
        || settings.shake_duration > config::MAX_SHAKE_DURATION_MS
    {
        errors.push(format!(
            "Shake duration must be between {} and {} ms (got {})",
            config::MIN_SHAKE_DURATION_MS,
            config::MAX_SHAKE_DURATION_MS,
            settings.shake_duration
        ));
    }

    if !config::VALID_SOUND_TYPES.contains(&settings.sound_type.as_str()) {
        errors.push(format!(
            "Invalid sound type '{}'. Valid types: {}",
            settings.sound_type,
            config::VALID_SOUND_TYPES.join(", ")
        ));
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Generic(format!(
            "Reminder settings validation failed:\n- {}",
            errors.join("\n- ")
        )))
    }
}

/// Validate behavior settings against configured limits.
/// Accumulates all errors before returning (Rule 11b batch feedback).
fn validate_behavior_settings(settings: &BehaviorSettings) -> Result<()> {
    let mut errors: Vec<String> = Vec::new();

    if settings.auto_save_delay < config::MIN_AUTO_SAVE_DELAY_MS
        || settings.auto_save_delay > config::MAX_AUTO_SAVE_DELAY_MS
    {
        errors.push(format!(
            "Auto-save delay must be between {} and {} ms (got {}). \
             Values below {}ms cause excessive disk I/O; values above {}ms risk data loss.",
            config::MIN_AUTO_SAVE_DELAY_MS,
            config::MAX_AUTO_SAVE_DELAY_MS,
            settings.auto_save_delay,
            config::MIN_AUTO_SAVE_DELAY_MS,
            config::MAX_AUTO_SAVE_DELAY_MS
        ));
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Generic(format!(
            "Behavior settings validation failed:\n- {}",
            errors.join("\n- ")
        )))
    }
}

/// Validate auto-backup settings against configured limits.
/// Accumulates all errors before returning (Rule 11b batch feedback).
fn validate_auto_backup_settings(settings: &AutoBackupSettings) -> Result<()> {
    let mut errors: Vec<String> = Vec::new();

    if settings.retention_days < config::MIN_BACKUP_RETENTION_DAYS
        || settings.retention_days > config::MAX_BACKUP_RETENTION_DAYS
    {
        errors.push(format!(
            "Backup retention must be between {} and {} days (got {})",
            config::MIN_BACKUP_RETENTION_DAYS,
            config::MAX_BACKUP_RETENTION_DAYS,
            settings.retention_days
        ));
    }

    let valid_frequencies = ["daily", "weekly", "monthly"];
    let is_numeric_freq = {
        let s = &settings.frequency;
        if s.len() >= 2 {
            let (num_part, unit) = s.split_at(s.len() - 1);
            matches!(unit, "m" | "h" | "d") && num_part.parse::<u32>().is_ok()
        } else {
            false
        }
    };

    if !valid_frequencies.contains(&settings.frequency.as_str()) && !is_numeric_freq {
        errors.push(format!(
            "Invalid backup frequency '{}'. Use formats: daily, weekly, monthly, or a number followed by m/h/d (e.g., 12h, 30m, 7d)",
            settings.frequency
        ));
    }

    if let Some(location) = &settings.backup_location {
        let path = PathBuf::from(location);
        if !path.exists() {
            errors.push(format!(
                "Backup location '{}' does not exist. Create the directory first.",
                location
            ));
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Generic(format!(
            "Auto-backup settings validation failed:\n- {}",
            errors.join("\n- ")
        )))
    }
}

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
    validate_hotkey_settings(&hotkeys)?;

    state.settings_service.update_hotkeys(hotkeys).await?;

    tracing::warn!(
        "Hotkey settings updated. Application restart required for changes to take effect."
    );

    Ok(())
}

// ===== Autostart Settings =====

/// Check if application autostart is enabled (Windows only)
#[tauri::command]
pub fn get_autostart_state() -> Result<bool> {
    #[cfg(target_os = "windows")]
    {
        crate::platform::check_autostart_state()
            .map_err(|e| AppError::Generic(format!("Failed to check autostart state: {}", e)))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

/// Enable or disable application autostart (Windows only)
#[tauri::command]
pub async fn set_autostart(_app: tauri::AppHandle, enabled: bool) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        if enabled {
            crate::platform::enable_autostart()
                .map_err(|e| AppError::Generic(format!("Failed to enable autostart: {}", e)))?;
        } else {
            crate::platform::disable_autostart()
                .map_err(|e| AppError::Generic(format!("Failed to disable autostart: {}", e)))?;
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enabled;
        Err(AppError::Generic(
            "Autostart is only supported on Windows".to_string(),
        ))
    }
}

/// Toggle application autostart and return new state (Windows only)
#[tauri::command]
pub fn toggle_autostart() -> Result<bool> {
    #[cfg(target_os = "windows")]
    {
        crate::platform::toggle_autostart()
            .map_err(|e| AppError::Generic(format!("Failed to toggle autostart: {}", e)))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err(AppError::Generic(
            "Autostart is only supported on Windows".to_string(),
        ))
    }
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
    validate_auto_backup_settings(&settings)?;

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
    validate_reminder_settings(&settings)?;

    state
        .settings_service
        .update_reminders(settings.clone())
        .await?;
    tracing::info!(
        sound_enabled = settings.sound_enabled,
        shake_enabled = settings.shake_enabled,
        glow_enabled = settings.glow_enabled,
        sound_type = %settings.sound_type,
        "Reminder settings updated"
    );
    Ok(())
}

// ===== Behavior Settings =====

/// Get behavior settings (minimize/close to tray, auto-save delay)
#[tauri::command]
pub async fn get_behavior_settings(state: State<'_, AppState>) -> Result<BehaviorSettings> {
    state.settings_service.get_behavior().await
}

/// Update behavior settings
#[tauri::command]
pub async fn update_behavior_settings(
    state: State<'_, AppState>,
    settings: BehaviorSettings,
) -> Result<()> {
    validate_behavior_settings(&settings)?;

    state
        .settings_service
        .update_behavior(settings.clone())
        .await?;
    tracing::info!(
        minimize_to_tray = settings.minimize_to_tray,
        close_to_tray = settings.close_to_tray,
        auto_save_delay = settings.auto_save_delay,
        "Behavior settings updated"
    );
    Ok(())
}

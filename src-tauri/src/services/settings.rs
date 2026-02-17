//! Settings service
//!
//! Manages application settings persistence using JSON file storage.

use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

/// Global hotkey configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeySettings {
    pub new_note: String,
    pub toggle_note: String,
    pub open_search: String,
    #[serde(default = "default_open_settings_hotkey")]
    pub open_settings: String,
    #[serde(default = "default_toggle_all_notes_hotkey")]
    pub toggle_all_notes: String,
    #[serde(default = "default_quick_capture_hotkey")]
    pub quick_capture: String,
}

fn default_open_settings_hotkey() -> String {
    "Ctrl+Shift+,".to_string()
}

fn default_toggle_all_notes_hotkey() -> String {
    "Ctrl+Shift+A".to_string()
}

fn default_quick_capture_hotkey() -> String {
    "Ctrl+Shift+V".to_string()
}

impl Default for HotkeySettings {
    fn default() -> Self {
        Self {
            new_note: "Ctrl+Shift+N".to_string(),
            toggle_note: "Ctrl+Shift+H".to_string(),
            open_search: "Ctrl+Shift+F".to_string(),
            open_settings: "Ctrl+Shift+,".to_string(),
            toggle_all_notes: "Ctrl+Shift+A".to_string(),
            quick_capture: "Ctrl+Shift+V".to_string(),
        }
    }
}

/// Auto-backup configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoBackupSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_backup_frequency")]
    pub frequency: String, // "daily", "weekly", "monthly"
    #[serde(default = "default_backup_retention")]
    pub retention_days: u32,
    /// Custom backup location (if None, uses default app_data_dir/backups)
    #[serde(default)]
    pub backup_location: Option<String>,
}

fn default_backup_frequency() -> String {
    "weekly".to_string()
}

fn default_backup_retention() -> u32 {
    30
}

impl Default for AutoBackupSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            frequency: default_backup_frequency(),
            retention_days: default_backup_retention(),
            backup_location: None,
        }
    }
}

/// Reminder notification settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderSettings {
    /// Whether to play sound when reminder triggers
    #[serde(default = "default_reminder_sound_enabled")]
    pub sound_enabled: bool,
    /// Sound frequency in Hz (default 880 = A5 note)
    #[serde(default = "default_reminder_sound_frequency")]
    pub sound_frequency: u32,
    /// Sound duration in milliseconds
    #[serde(default = "default_reminder_sound_duration")]
    pub sound_duration: u32,
    /// Whether to show the shake animation
    #[serde(default = "default_reminder_shake_enabled")]
    pub shake_enabled: bool,
    /// Shake animation duration in milliseconds
    #[serde(default = "default_reminder_shake_duration")]
    pub shake_duration: u32,
    /// Whether to show the glow border effect
    #[serde(default = "default_reminder_glow_enabled")]
    pub glow_enabled: bool,
    /// Sound preset type: "whoosh", "chime", "bell", "gentle", "alert"
    #[serde(default = "default_reminder_sound_type")]
    pub sound_type: String,
}

fn default_reminder_sound_enabled() -> bool {
    true
}

fn default_reminder_sound_frequency() -> u32 {
    880 // A5 note
}

fn default_reminder_sound_duration() -> u32 {
    500 // 500ms
}

fn default_reminder_shake_enabled() -> bool {
    true
}

fn default_reminder_shake_duration() -> u32 {
    600 // 600ms
}

fn default_reminder_glow_enabled() -> bool {
    true
}

fn default_reminder_sound_type() -> String {
    "whoosh".to_string()
}

impl Default for ReminderSettings {
    fn default() -> Self {
        Self {
            sound_enabled: default_reminder_sound_enabled(),
            sound_frequency: default_reminder_sound_frequency(),
            sound_duration: default_reminder_sound_duration(),
            shake_enabled: default_reminder_shake_enabled(),
            shake_duration: default_reminder_shake_duration(),
            glow_enabled: default_reminder_glow_enabled(),
            sound_type: default_reminder_sound_type(),
        }
    }
}

/// Behavior settings for window management and auto-save
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorSettings {
    /// Whether to minimize to system tray instead of taskbar
    #[serde(default = "default_true")]
    pub minimize_to_tray: bool,
    /// Whether to close to system tray instead of quitting
    #[serde(default = "default_true")]
    pub close_to_tray: bool,
    /// Auto-save delay in milliseconds (minimum 100ms)
    #[serde(default = "default_auto_save_delay")]
    pub auto_save_delay: u32,
}

fn default_true() -> bool {
    true
}

fn default_auto_save_delay() -> u32 {
    1000 // 1 second debounce
}

impl Default for BehaviorSettings {
    fn default() -> Self {
        Self {
            minimize_to_tray: true,
            close_to_tray: true,
            auto_save_delay: default_auto_save_delay(),
        }
    }
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    #[serde(default)]
    pub hotkeys: HotkeySettings,
    #[serde(default)]
    pub start_with_windows: bool,
    #[serde(default)]
    pub auto_backup: AutoBackupSettings,
    #[serde(default)]
    pub reminders: ReminderSettings,
    #[serde(default)]
    pub behavior: BehaviorSettings,
}

/// Service for managing application settings
#[derive(Clone)]
pub struct SettingsService {
    settings_path: PathBuf,
}

impl SettingsService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            settings_path: app_data_dir.join("settings.json"),
        }
    }

    /// Load settings from disk or create default if not exists
    pub async fn load(&self) -> Result<AppSettings> {
        if !self.settings_path.exists() {
            tracing::info!("Settings file not found, creating default settings");
            let default = AppSettings::default();
            self.save(&default).await?;
            return Ok(default);
        }

        let content = fs::read_to_string(&self.settings_path).await?;
        let settings: AppSettings = serde_json::from_str(&content)
            .map_err(|e| AppError::Generic(format!("Failed to parse settings: {}", e)))?;

        Ok(settings)
    }

    /// Save settings to disk
    pub async fn save(&self, settings: &AppSettings) -> Result<()> {
        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| AppError::Generic(format!("Failed to serialize settings: {}", e)))?;

        fs::write(&self.settings_path, content).await?;
        tracing::info!("Settings saved to {:?}", self.settings_path);

        Ok(())
    }

    /// Get hotkey settings
    pub async fn get_hotkeys(&self) -> Result<HotkeySettings> {
        let settings = self.load().await?;
        Ok(settings.hotkeys)
    }

    /// Update hotkey settings
    pub async fn update_hotkeys(&self, hotkeys: HotkeySettings) -> Result<()> {
        let mut settings = self.load().await?;
        settings.hotkeys = hotkeys;
        self.save(&settings).await?;
        Ok(())
    }

    /// Get auto-backup settings
    pub async fn get_auto_backup(&self) -> Result<AutoBackupSettings> {
        let settings = self.load().await?;
        Ok(settings.auto_backup)
    }

    /// Update auto-backup settings
    pub async fn update_auto_backup(&self, auto_backup: AutoBackupSettings) -> Result<()> {
        let mut settings = self.load().await?;
        settings.auto_backup = auto_backup;
        self.save(&settings).await?;
        Ok(())
    }

    /// Get reminder settings
    pub async fn get_reminders(&self) -> Result<ReminderSettings> {
        let settings = self.load().await?;
        Ok(settings.reminders)
    }

    /// Update reminder settings
    pub async fn update_reminders(&self, reminders: ReminderSettings) -> Result<()> {
        let mut settings = self.load().await?;
        settings.reminders = reminders;
        self.save(&settings).await?;
        Ok(())
    }

    /// Get behavior settings (minimize/close to tray, auto-save delay)
    pub async fn get_behavior(&self) -> Result<BehaviorSettings> {
        let settings = self.load().await?;
        Ok(settings.behavior)
    }

    /// Update behavior settings
    pub async fn update_behavior(&self, behavior: BehaviorSettings) -> Result<()> {
        let mut settings = self.load().await?;
        settings.behavior = behavior;
        self.save(&settings).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_service() -> (SettingsService, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let service = SettingsService::new(temp_dir.path().to_path_buf());
        (service, temp_dir)
    }

    #[tokio::test]
    async fn test_default_settings_created_on_load() {
        let (service, _temp) = create_test_service();

        let settings = service.load().await.unwrap();

        // Verify default hotkeys
        assert_eq!(settings.hotkeys.new_note, "Ctrl+Shift+N");
        assert_eq!(settings.hotkeys.toggle_note, "Ctrl+Shift+H");

        // Verify default reminder settings
        assert!(settings.reminders.sound_enabled);
        assert_eq!(settings.reminders.sound_frequency, 880);
        assert_eq!(settings.reminders.sound_duration, 500);
        assert!(settings.reminders.shake_enabled);
        assert_eq!(settings.reminders.shake_duration, 600);
        assert!(settings.reminders.glow_enabled);
        assert_eq!(settings.reminders.sound_type, "whoosh");
    }

    #[tokio::test]
    async fn test_reminder_settings_get_and_update() {
        let (service, _temp) = create_test_service();

        // Get default reminder settings
        let reminders = service.get_reminders().await.unwrap();
        assert!(reminders.sound_enabled);
        assert_eq!(reminders.sound_frequency, 880);

        // Update reminder settings
        let updated = ReminderSettings {
            sound_enabled: false,
            sound_frequency: 440,
            sound_duration: 1000,
            shake_enabled: false,
            shake_duration: 800,
            glow_enabled: true,
            sound_type: "chime".to_string(),
        };

        service.update_reminders(updated.clone()).await.unwrap();

        // Verify updated settings
        let loaded = service.get_reminders().await.unwrap();
        assert!(!loaded.sound_enabled);
        assert_eq!(loaded.sound_frequency, 440);
        assert_eq!(loaded.sound_duration, 1000);
        assert!(!loaded.shake_enabled);
        assert_eq!(loaded.shake_duration, 800);
        assert!(loaded.glow_enabled);
        assert_eq!(loaded.sound_type, "chime");
    }

    #[tokio::test]
    async fn test_settings_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().to_path_buf();

        // Create service, update settings, drop it
        {
            let service = SettingsService::new(settings_path.clone());
            let updated = ReminderSettings {
                sound_enabled: false,
                sound_frequency: 660,
                sound_duration: 750,
                shake_enabled: true,
                shake_duration: 400,
                glow_enabled: false,
                sound_type: "bell".to_string(),
            };
            service.update_reminders(updated).await.unwrap();
        }

        // Create new service, verify settings were persisted
        {
            let service = SettingsService::new(settings_path);
            let loaded = service.get_reminders().await.unwrap();
            assert!(!loaded.sound_enabled);
            assert_eq!(loaded.sound_frequency, 660);
            assert_eq!(loaded.sound_duration, 750);
            assert!(loaded.shake_enabled);
            assert_eq!(loaded.shake_duration, 400);
            assert!(!loaded.glow_enabled);
            assert_eq!(loaded.sound_type, "bell");
        }
    }

    #[tokio::test]
    async fn test_reminder_settings_default_values() {
        let settings = ReminderSettings::default();

        assert!(settings.sound_enabled);
        assert_eq!(settings.sound_frequency, 880);
        assert_eq!(settings.sound_duration, 500);
        assert!(settings.shake_enabled);
        assert_eq!(settings.shake_duration, 600);
        assert!(settings.glow_enabled);
        assert_eq!(settings.sound_type, "whoosh");
    }

    #[tokio::test]
    async fn test_hotkeys_preserved_after_reminder_update() {
        let (service, _temp) = create_test_service();

        // Load initial settings
        let initial = service.load().await.unwrap();
        let initial_new_note = initial.hotkeys.new_note.clone();

        // Update reminder settings
        let updated_reminders = ReminderSettings {
            sound_enabled: false,
            ..ReminderSettings::default()
        };
        service.update_reminders(updated_reminders).await.unwrap();

        // Verify hotkeys are preserved
        let settings = service.load().await.unwrap();
        assert_eq!(settings.hotkeys.new_note, initial_new_note);
    }
}

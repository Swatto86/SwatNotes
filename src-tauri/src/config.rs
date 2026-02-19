//! Application configuration constants
//!
//! Central location for all configuration constants, resource limits,
//! and validation boundaries used throughout the application.

// ===== Window Dimensions =====

/// Default width for sticky note windows in logical pixels
pub const STICKY_NOTE_DEFAULT_WIDTH: f64 = 420.0;
/// Default height for sticky note windows in logical pixels
pub const STICKY_NOTE_DEFAULT_HEIGHT: f64 = 450.0;
/// Minimum width for sticky note windows in logical pixels
pub const STICKY_NOTE_MIN_WIDTH: f64 = 350.0;
/// Minimum height for sticky note windows in logical pixels
pub const STICKY_NOTE_MIN_HEIGHT: f64 = 300.0;

// ===== Behavior Settings Limits =====

/// Minimum auto-save delay in milliseconds.
/// Values below this cause excessive disk I/O and degrade performance.
pub const MIN_AUTO_SAVE_DELAY_MS: u32 = 100;

/// Maximum auto-save delay in milliseconds (5 minutes).
/// Values above this risk data loss on unexpected shutdown.
pub const MAX_AUTO_SAVE_DELAY_MS: u32 = 300_000;

// ===== Hotkey Settings Limits =====

/// Maximum length for a hotkey string (e.g., "Ctrl+Shift+Alt+N").
/// Prevents excessively long values from being stored.
pub const MAX_HOTKEY_LENGTH: usize = 50;

// ===== Reminder Settings Limits =====

/// Minimum sound frequency in Hz (sub-audible values are pointless)
pub const MIN_SOUND_FREQUENCY_HZ: u32 = 20;

/// Maximum sound frequency in Hz (beyond human hearing range)
pub const MAX_SOUND_FREQUENCY_HZ: u32 = 20_000;

/// Minimum sound duration in milliseconds (too short to hear)
pub const MIN_SOUND_DURATION_MS: u32 = 50;

/// Maximum sound duration in milliseconds (10 seconds — avoids annoyance)
pub const MAX_SOUND_DURATION_MS: u32 = 10_000;

/// Minimum shake animation duration in milliseconds
pub const MIN_SHAKE_DURATION_MS: u32 = 100;

/// Maximum shake animation duration in milliseconds (5 seconds)
pub const MAX_SHAKE_DURATION_MS: u32 = 5_000;

/// Valid sound type presets for reminder notifications
pub const VALID_SOUND_TYPES: &[&str] = &["whoosh", "chime", "bell", "gentle", "alert"];

// ===== Auto-Backup Settings Limits =====

/// Minimum backup retention in days (at least 1 day)
pub const MIN_BACKUP_RETENTION_DAYS: u32 = 1;

/// Maximum backup retention in days (1 year — prevents unbounded growth)
pub const MAX_BACKUP_RETENTION_DAYS: u32 = 365;

/// Valid backup frequency pattern (e.g., "daily", "weekly", "monthly", "12h", "30m", "7d")
/// Documented for reference; validation logic uses manual parsing instead of regex
/// to avoid adding the `regex` crate dependency.
#[allow(dead_code)]
pub const BACKUP_FREQUENCY_PATTERN: &str = r"^(\d+[mhd]|daily|weekly|monthly)$";

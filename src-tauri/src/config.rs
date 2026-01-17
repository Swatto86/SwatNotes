//! Application configuration constants
//!
//! Central location for all hard-coded values and configuration

/// Window dimensions for sticky notes
pub const STICKY_NOTE_DEFAULT_WIDTH: f64 = 350.0;
pub const STICKY_NOTE_DEFAULT_HEIGHT: f64 = 400.0;
pub const STICKY_NOTE_MIN_WIDTH: f64 = 250.0;
pub const STICKY_NOTE_MIN_HEIGHT: f64 = 300.0;

/// Window background color (RGB)
pub const WINDOW_BACKGROUND_COLOR: (u8, u8, u8, u8) = (255, 255, 255, 255);

/// Global hotkey for creating new notes
pub const GLOBAL_HOTKEY_NEW_NOTE: &str = "Ctrl+Shift+N";

/// Application metadata
#[allow(dead_code)]
pub const APP_NAME: &str = "QuickNotes";
#[allow(dead_code)]
pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

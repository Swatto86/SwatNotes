//! Window management commands
//!
//! Commands for creating and managing application windows.

use crate::app::AppState;
use crate::config;
use crate::error::{AppError, Result};
use tauri::webview::Color;
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// Dark background color to prevent white flash when opening windows
/// This matches the dark theme background (#1a1a1a)
const WINDOW_BACKGROUND_COLOR: Color = Color(26, 26, 26, 255);

/// Configuration for creating a new window
pub struct WindowConfig {
    pub label: String,
    pub url: &'static str,
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub min_width: f64,
    pub min_height: f64,
}

/// Create a new window with the given configuration
/// Returns Ok(true) if a new window was created, Ok(false) if existing window was focused
pub fn create_or_focus_window(app: &tauri::AppHandle, config: WindowConfig) -> Result<bool> {
    // Check if window already exists and is valid
    if let Some(window) = app.get_webview_window(&config.label) {
        match window.is_visible() {
            Ok(_) => {
                tracing::debug!(
                    "Window already exists and is valid, showing and focusing: {}",
                    config.label
                );
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
                return Ok(false);
            }
            Err(_) => {
                tracing::debug!(
                    "Window exists but is invalid, will create new one: {}",
                    config.label
                );
            }
        }
    }

    // Create new window
    tracing::debug!("Creating new window: {}", config.label);
    let _window = WebviewWindowBuilder::new(app, &config.label, WebviewUrl::App(config.url.into()))
        .title(&config.title)
        .inner_size(config.width, config.height)
        .min_inner_size(config.min_width, config.min_height)
        .resizable(true)
        .decorations(true)
        .center()
        .visible(false) // Hidden until content loads to prevent flash
        .background_color(WINDOW_BACKGROUND_COLOR) // Dark background to prevent white flash
        .build()?;

    tracing::info!("Window created successfully: {}", config.label);
    Ok(true)
}

/// Delete a note and close its window if open
#[tauri::command]
pub async fn delete_note_and_close_window(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<()> {
    tracing::info!("Deleting note and closing window: {}", id);

    // Delete the note first
    state.notes_service.delete_note(&id).await?;

    // Close the window if it exists
    let window_label = format!("note-{}", id);
    if let Some(window) = app.get_webview_window(&window_label) {
        tracing::debug!("Closing window: {}", window_label);
        let _ = window.close();
    }

    // Emit event to notify main window to refresh notes list
    if let Err(e) = app.emit("notes-list-changed", ()) {
        tracing::warn!("Failed to emit notes-list-changed event: {}", e);
    }

    Ok(())
}

/// Open a note in a floating sticky note window
#[tauri::command]
pub async fn open_note_window(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    note_id: String,
) -> Result<()> {
    tracing::info!("Opening note window for note: {}", note_id);

    // Get note to set window title
    let note = state.notes_service.get_note(&note_id).await?;
    let window_label = format!("note-{}", note_id);

    // Check if window already exists and is valid
    if let Some(window) = app.get_webview_window(&window_label) {
        match window.is_visible() {
            Ok(_) => {
                tracing::debug!(
                    "Window already exists and is valid, showing and focusing: {}",
                    window_label
                );
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
                tracing::info!("Existing window shown: {}", window_label);
                return Ok(());
            }
            Err(_) => {
                tracing::debug!(
                    "Window exists but is invalid, will create new one: {}",
                    window_label
                );
            }
        }
    }

    // Create new sticky note window
    tracing::debug!("Creating new sticky note window: {}", window_label);
    let _window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App("pages/sticky-note.html".into()),
    )
    .title(&note.title)
    .inner_size(
        config::STICKY_NOTE_DEFAULT_WIDTH,
        config::STICKY_NOTE_DEFAULT_HEIGHT,
    )
    .min_inner_size(
        config::STICKY_NOTE_MIN_WIDTH,
        config::STICKY_NOTE_MIN_HEIGHT,
    )
    .resizable(true)
    .decorations(true)
    .always_on_top(false)
    .skip_taskbar(false)
    .center()
    .visible(false)
    .background_color(WINDOW_BACKGROUND_COLOR) // Dark background to prevent white flash
    .build()?;

    tracing::info!("Sticky note window created successfully: {}", window_label);
    Ok(())
}

/// Create a new note and open it in a floating window
#[tauri::command]
pub async fn create_new_sticky_note(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    tracing::info!("Creating new sticky note");

    // Create a new note with default content
    let note = state
        .notes_service
        .create_note(
            "Untitled".to_string(),
            r#"{"ops":[{"insert":"\n"}]}"#.to_string(),
            None, // No collection by default
        )
        .await?;

    tracing::info!("Created new note: {}, opening window", note.id);

    // Emit event to refresh notes list in main window
    if let Err(e) = app.emit("notes-list-changed", ()) {
        tracing::warn!("Failed to emit notes-list-changed event: {}", e);
    }

    // Open it in a floating window
    open_note_window(app, state, note.id).await?;

    Ok(())
}

/// Set the last focused note window (called when a note window gains focus)
#[tauri::command]
pub fn set_last_focused_note_window(
    state: State<'_, AppState>,
    window_label: String,
) -> Result<()> {
    tracing::info!("Setting last focused note window: {}", window_label);

    if let Ok(mut last_focused) = state.last_focused_note_window.lock() {
        *last_focused = Some(window_label.clone());
        tracing::info!(
            "Successfully set last focused note window to: {}",
            window_label
        );
    } else {
        tracing::error!("Failed to acquire lock on last_focused_note_window");
    }

    Ok(())
}

/// Toggle the last focused note window visibility
#[tauri::command]
pub fn toggle_last_focused_note_window(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let window_label = {
        let last_focused = state
            .last_focused_note_window
            .lock()
            .map_err(|e| AppError::Generic(format!("Lock error: {}", e)))?;

        match last_focused.as_ref() {
            Some(label) => label.clone(),
            None => {
                tracing::warn!("No note window has been focused yet");
                return Ok(());
            }
        }
    };

    tracing::info!("Toggling note window: {}", window_label);

    if let Some(window) = app.get_webview_window(&window_label) {
        match window.is_visible() {
            Ok(true) => {
                tracing::debug!(
                    "Window is visible, emitting toggle event to: {}",
                    window_label
                );
                let _ = window.emit("toggle-note-window", ());
            }
            Ok(false) => {
                tracing::debug!("Showing window: {}", window_label);
                let _ = window.show();
                let _ = window.set_focus();
            }
            Err(e) => {
                tracing::error!("Failed to check window visibility: {}", e);
            }
        }
    } else {
        tracing::warn!("Window not found: {}", window_label);
    }

    Ok(())
}

/// Open the settings window
#[tauri::command]
pub fn open_settings_window(app: tauri::AppHandle) -> Result<()> {
    tracing::info!("Opening settings window");

    let config = WindowConfig {
        label: "settings".to_string(),
        url: "pages/settings.html",
        title: "Settings - SwatNotes".to_string(),
        width: 700.0,
        height: 1000.0,
        min_width: 650.0,
        min_height: 600.0,
    };

    create_or_focus_window(&app, config)?;
    tracing::info!("Settings window ready");
    Ok(())
}

/// Open main window and focus search bar
#[tauri::command]
pub fn open_main_window_and_focus_search(app: tauri::AppHandle) -> Result<()> {
    tracing::info!("Opening main window and focusing search");

    if let Some(window) = app.get_webview_window("main") {
        // Emit refresh event before showing so notes are up to date
        let _ = window.emit("refresh-notes", ());
        tracing::debug!("Refresh notes event emitted");

        let _ = window.show();
        let _ = window.set_focus();

        // Emit event to focus search bar
        let _ = window.emit("focus-search", ());

        tracing::info!("Main window shown and search focus event emitted");
    } else {
        tracing::warn!("Main window not found");
    }

    Ok(())
}

/// Toggle main window visibility (show/hide)
#[tauri::command]
pub fn toggle_main_window(app: tauri::AppHandle) -> Result<()> {
    tracing::info!("Toggling main window");

    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                // Window is visible, hide it
                tracing::debug!("Main window is visible, hiding");
                let _ = window.hide();
            }
            Ok(false) => {
                // Window is hidden, show it and focus search
                tracing::debug!("Main window is hidden, showing and focusing search");
                // Emit refresh event before showing so notes are up to date
                let _ = window.emit("refresh-notes", ());
                let _ = window.show();
                let _ = window.set_focus();
                // Emit event to focus search bar
                let _ = window.emit("focus-search", ());
            }
            Err(e) => {
                tracing::error!("Failed to check main window visibility: {}", e);
            }
        }
    } else {
        tracing::warn!("Main window not found");
    }

    Ok(())
}

/// Toggle settings window visibility (show/hide)
#[tauri::command]
pub fn toggle_settings_window(app: tauri::AppHandle) -> Result<()> {
    tracing::info!("Toggling settings window");

    if let Some(window) = app.get_webview_window("settings") {
        match window.is_visible() {
            Ok(true) => {
                // Window is visible, hide it
                tracing::debug!("Settings window is visible, hiding");
                let _ = window.hide();
            }
            Ok(false) => {
                // Window is hidden, show it
                tracing::debug!("Settings window is hidden, showing");
                let _ = window.show();
                let _ = window.set_focus();
            }
            Err(e) => {
                tracing::error!("Failed to check settings window visibility: {}", e);
            }
        }
    } else {
        // Settings window doesn't exist, create it
        tracing::debug!("Settings window doesn't exist, creating");
        open_settings_window(app)?;
    }

    Ok(())
}

/// Open the about window
#[tauri::command]
pub fn open_about_window(app: tauri::AppHandle) -> Result<()> {
    tracing::info!("Opening about window");

    let config = WindowConfig {
        label: "about".to_string(),
        url: "pages/about.html",
        title: "About - SwatNotes".to_string(),
        width: 400.0,
        height: 500.0,
        min_width: 350.0,
        min_height: 400.0,
    };

    let created = create_or_focus_window(&app, config)?;

    // If we just created a new window, show it immediately
    // (the window is created hidden to prevent white flash, but About is simple enough)
    if created {
        if let Some(window) = app.get_webview_window("about") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }

    tracing::info!("About window ready");
    Ok(())
}

/// Toggle about window visibility (show/hide)
#[tauri::command]
pub fn toggle_about_window(app: tauri::AppHandle) -> Result<()> {
    tracing::info!("Toggling about window");

    if let Some(window) = app.get_webview_window("about") {
        match window.is_visible() {
            Ok(true) => {
                // Window is visible, hide it
                tracing::debug!("About window is visible, hiding");
                let _ = window.hide();
            }
            Ok(false) => {
                // Window is hidden, show it
                tracing::debug!("About window is hidden, showing");
                let _ = window.show();
                let _ = window.set_focus();
            }
            Err(e) => {
                tracing::error!("Failed to check about window visibility: {}", e);
            }
        }
    } else {
        // About window doesn't exist, create it
        tracing::debug!("About window doesn't exist, creating");
        open_about_window(app)?;
    }

    Ok(())
}

/// Toggle all note windows visibility (show/hide all at once)
#[tauri::command]
pub async fn toggle_all_note_windows(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    tracing::info!("Toggling all note windows");

    // Get all notes from database
    let notes = state.notes_service.list_notes().await?;

    if notes.is_empty() {
        tracing::info!("No notes found to toggle");
        return Ok(());
    }

    // Collect existing note windows and their visibility status
    let mut visible_windows: Vec<String> = Vec::new();
    let mut hidden_windows: Vec<String> = Vec::new();
    let mut notes_without_windows: Vec<String> = Vec::new();

    for note in &notes {
        let window_label = format!("note-{}", note.id);
        if let Some(window) = app.get_webview_window(&window_label) {
            match window.is_visible() {
                Ok(true) => visible_windows.push(window_label),
                Ok(false) => hidden_windows.push(window_label),
                Err(_) => notes_without_windows.push(note.id.clone()),
            }
        } else {
            notes_without_windows.push(note.id.clone());
        }
    }

    // Determine action: if any windows are visible, hide all; otherwise show all
    let should_show = visible_windows.is_empty();

    if should_show {
        tracing::info!(
            "Showing all notes: {} existing hidden windows, {} notes without windows",
            hidden_windows.len(),
            notes_without_windows.len()
        );

        // Get screen dimensions for positioning windows
        let monitor = app.primary_monitor().ok().flatten().or_else(|| {
            app.available_monitors()
                .ok()
                .and_then(|m| m.into_iter().next())
        });

        let (screen_width, screen_height) = monitor
            .map(|m| {
                let size = m.size();
                (size.width as i32, size.height as i32)
            })
            .unwrap_or((1920, 1080));

        // Calculate grid positions for windows
        let window_width = config::STICKY_NOTE_DEFAULT_WIDTH as i32;
        let window_height = config::STICKY_NOTE_DEFAULT_HEIGHT as i32;
        let padding = 30;
        let total_notes = notes.len();

        // Calculate how many windows fit per row
        let cols = ((screen_width - padding) / (window_width + padding)).max(1) as usize;

        // Show existing hidden windows
        for (i, window_label) in hidden_windows.iter().enumerate() {
            if let Some(window) = app.get_webview_window(window_label) {
                // Calculate position in grid
                let col = i % cols;
                let row = i / cols;
                let x = padding + (col as i32) * (window_width + padding);
                let y = padding + (row as i32) * (window_height + padding);

                // Keep within screen bounds
                let x = x.min(screen_width - window_width - padding);
                let y = y.min(screen_height - window_height - padding);

                let _ = window.set_position(tauri::Position::Physical(
                    tauri::PhysicalPosition::new(x, y),
                ));
                let _ = window.show();
            }
        }

        // Create and show windows for notes that don't have one
        let start_index = hidden_windows.len();
        for (i, note_id) in notes_without_windows.iter().enumerate() {
            let idx = start_index + i;
            let col = idx % cols;
            let row = idx / cols;
            let x = padding + (col as i32) * (window_width + padding);
            let y = padding + (row as i32) * (window_height + padding);

            // Keep within screen bounds
            let x = x.min(screen_width - window_width - padding);
            let y = y.min(screen_height - window_height - padding);

            // Get note details
            if let Ok(note) = state.notes_service.get_note(note_id).await {
                let window_label = format!("note-{}", note_id);

                // Create the window
                let window = WebviewWindowBuilder::new(
                    &app,
                    &window_label,
                    WebviewUrl::App("pages/sticky-note.html".into()),
                )
                .title(&note.title)
                .inner_size(
                    config::STICKY_NOTE_DEFAULT_WIDTH,
                    config::STICKY_NOTE_DEFAULT_HEIGHT,
                )
                .min_inner_size(
                    config::STICKY_NOTE_MIN_WIDTH,
                    config::STICKY_NOTE_MIN_HEIGHT,
                )
                .resizable(true)
                .decorations(true)
                .always_on_top(false)
                .skip_taskbar(false)
                .position(x as f64, y as f64)
                .visible(false)
                .background_color(WINDOW_BACKGROUND_COLOR) // Dark background to prevent white flash
                .build();

                if let Ok(_win) = window {
                    // Window will show itself after loading via sticky-note.ts
                    tracing::debug!("Created note window at position ({}, {})", x, y);
                } else {
                    tracing::error!("Failed to create window for note {}", note_id);
                }
            }
        }

        tracing::info!("Showed {} note windows", total_notes);
    } else {
        tracing::info!("Hiding all {} visible note windows", visible_windows.len());

        // Hide all visible windows
        for window_label in &visible_windows {
            if let Some(window) = app.get_webview_window(window_label) {
                let _ = window.hide();
            }
        }

        // Also hide any hidden windows that might exist
        for window_label in &hidden_windows {
            if let Some(window) = app.get_webview_window(window_label) {
                let _ = window.hide();
            }
        }
    }

    Ok(())
}

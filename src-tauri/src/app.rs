//! Application state and initialization
//!
//! This module manages the central application state and lifecycle.
//! All services are initialized here and made available through AppState.

use crate::database::{create_pool, Repository};
use crate::error::Result;
use crate::services::{AttachmentsService, BackupService, NotesService, RemindersService};
use crate::storage::BlobStore;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{App, Emitter, Manager};

/// Central application state holding all services
#[derive(Clone)]
pub struct AppState {
    pub app_data_dir: PathBuf,
    /// Direct database access (use services instead when possible)
    #[allow(dead_code)]
    pub db: Repository,
    /// Direct blob store access (use services instead when possible)
    #[allow(dead_code)]
    pub blob_store: BlobStore,
    pub notes_service: NotesService,
    pub attachments_service: AttachmentsService,
    pub backup_service: BackupService,
    pub reminders_service: RemindersService,
    /// Last focused note window label for toggle hotkey
    pub last_focused_note_window: Arc<Mutex<Option<String>>>,
}

impl AppState {
    pub async fn new(app_data_dir: PathBuf) -> Result<Self> {
        // Initialize database
        let db_path = app_data_dir.join("db.sqlite");
        let pool = create_pool(&db_path).await?;
        let db = Repository::new(pool);

        // Initialize blob store
        let blob_store = BlobStore::new(app_data_dir.join("blobs"));
        blob_store.initialize().await?;

        // Initialize services
        let notes_service = NotesService::new(db.clone());
        let attachments_service = AttachmentsService::new(db.clone(), blob_store.clone());
        let backup_service = BackupService::new(db.clone(), blob_store.clone(), app_data_dir.clone());
        let reminders_service = RemindersService::new(db.clone());

        Ok(Self {
            app_data_dir,
            db,
            blob_store,
            notes_service,
            attachments_service,
            backup_service,
            reminders_service,
            last_focused_note_window: Arc::new(Mutex::new(None)),
        })
    }
}

/// Application setup - called once on startup
pub fn setup(app: &mut App) -> Result<()> {
    tracing::info!("Initializing application");

    // Get app data directory
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| crate::error::AppError::Generic(format!("Failed to get app data dir: {}", e)))?;

    tracing::info!("App data directory: {:?}", app_data_dir);

    // Create necessary directories
    std::fs::create_dir_all(&app_data_dir)?;
    std::fs::create_dir_all(app_data_dir.join("blobs"))?;
    std::fs::create_dir_all(app_data_dir.join("backups"))?;
    std::fs::create_dir_all(app_data_dir.join("logs"))?;

    // Initialize application state asynchronously
    let runtime = tokio::runtime::Runtime::new()?;
    let state = runtime.block_on(AppState::new(app_data_dir))?;

    // Start reminders scheduler
    let scheduler_service = state.reminders_service.clone();
    let app_handle = app.handle().clone();
    runtime.spawn(async move {
        scheduler_service.set_app_handle(app_handle).await;
        scheduler_service.start_scheduler();
    });

    // Setup system tray
    setup_tray(app)?;

    // Register global hotkeys
    setup_global_hotkeys(app)?;

    // Setup window close handler to hide to tray instead of closing
    if let Some(window) = app.get_webview_window("main") {
        let window_clone = window.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Prevent window from closing
                api.prevent_close();
                // Hide window instead
                let _ = window_clone.hide();
            }
        });
    }

    app.manage(state);

    tracing::info!("Application initialized successfully");

    Ok(())
}

/// Setup system tray with menu
fn setup_tray(app: &mut App) -> Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    tracing::info!("Setting up system tray");

    let show_item = MenuItem::with_id(app, "show", "Show SwatNotes", true, None::<&str>)?;
    let new_note_item = MenuItem::with_id(app, "new_note", "New Note", true, Some("Ctrl+Shift+N"))?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show_item, &new_note_item, &settings_item, &separator, &quit_item],
    )?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "new_note" => {
                    // Create a new sticky note window
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = crate::commands::create_new_sticky_note(
                            app_handle.clone(),
                            app_handle.state(),
                        ).await {
                            tracing::error!("Failed to create sticky note from tray menu: {}", e);
                        }
                    });
                }
                "settings" => {
                    // Open settings window
                    if let Err(e) = crate::commands::open_settings_window(app.clone()) {
                        tracing::error!("Failed to open settings window: {}", e);
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    tracing::info!("System tray setup complete");

    Ok(())
}

/// Setup global hotkeys
fn setup_global_hotkeys(app: &mut App) -> Result<()> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    tracing::info!("Setting up global hotkeys");

    // Unregister if already registered (from previous instance or crash)
    if app.global_shortcut().is_registered(crate::config::GLOBAL_HOTKEY_NEW_NOTE) {
        tracing::warn!("Hotkey {} already registered, unregistering first", crate::config::GLOBAL_HOTKEY_NEW_NOTE);
        if let Err(e) = app.global_shortcut().unregister(crate::config::GLOBAL_HOTKEY_NEW_NOTE) {
            tracing::error!("Failed to unregister existing hotkey: {}", e);
        }
    }

    // Register global hotkey for creating new sticky notes
    app.global_shortcut().on_shortcut(crate::config::GLOBAL_HOTKEY_NEW_NOTE, move |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            tracing::info!("Global hotkey triggered: {}", crate::config::GLOBAL_HOTKEY_NEW_NOTE);

            // Create a new sticky note window directly
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = crate::commands::create_new_sticky_note(
                    app_handle.clone(),
                    app_handle.state(),
                ).await {
                    tracing::error!("Failed to create sticky note from hotkey: {}", e);
                }
            });
        }
    })
    .map_err(|e| crate::error::AppError::Generic(format!("Failed to register shortcut handler: {}", e)))?;

    // Register the hotkey
    match app.global_shortcut().register(crate::config::GLOBAL_HOTKEY_NEW_NOTE) {
        Ok(_) => {
            tracing::info!("Global hotkey {} registered successfully", crate::config::GLOBAL_HOTKEY_NEW_NOTE);
        }
        Err(e) => {
            tracing::warn!("Failed to register global hotkey {}: {}. The app will work but the global hotkey won't be available.",
                crate::config::GLOBAL_HOTKEY_NEW_NOTE, e);
            // Don't fail the entire app setup just because hotkey registration failed
        }
    }

    // Register global hotkey for toggling the last focused note window
    // Unregister if already registered
    if app.global_shortcut().is_registered(crate::config::GLOBAL_HOTKEY_TOGGLE_NOTE) {
        tracing::warn!("Hotkey {} already registered, unregistering first", crate::config::GLOBAL_HOTKEY_TOGGLE_NOTE);
        if let Err(e) = app.global_shortcut().unregister(crate::config::GLOBAL_HOTKEY_TOGGLE_NOTE) {
            tracing::error!("Failed to unregister existing hotkey: {}", e);
        }
    }

    app.global_shortcut().on_shortcut(crate::config::GLOBAL_HOTKEY_TOGGLE_NOTE, move |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            tracing::info!("Toggle hotkey triggered: {}", crate::config::GLOBAL_HOTKEY_TOGGLE_NOTE);

            // Toggle the last focused note window
            if let Err(e) = crate::commands::toggle_last_focused_note_window(
                app.clone(),
                app.state(),
            ) {
                tracing::error!("Failed to toggle note window from hotkey: {}", e);
            }
        }
    })
    .map_err(|e| crate::error::AppError::Generic(format!("Failed to register toggle shortcut handler: {}", e)))?;

    match app.global_shortcut().register(crate::config::GLOBAL_HOTKEY_TOGGLE_NOTE) {
        Ok(_) => {
            tracing::info!("Global hotkey {} registered successfully", crate::config::GLOBAL_HOTKEY_TOGGLE_NOTE);
        }
        Err(e) => {
            tracing::warn!("Failed to register global hotkey {}: {}. The app will work but the global hotkey won't be available.",
                crate::config::GLOBAL_HOTKEY_TOGGLE_NOTE, e);
        }
    }

    tracing::info!("Global hotkeys setup complete");

    Ok(())
}

//! Application state and initialization
//!
//! This module manages the central application state and lifecycle.
//! All services are initialized here and made available through AppState.

use crate::database::{create_pool, Repository};
use crate::error::Result;
use crate::services::{AttachmentsService, BackupService, NotesService, RemindersService};
use crate::storage::BlobStore;
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{App, Manager};
use tokio::sync::Mutex;

/// Central application state holding all services
#[derive(Clone)]
pub struct AppState {
    pub app_data_dir: PathBuf,
    pub db: Repository,
    pub blob_store: BlobStore,
    pub notes_service: NotesService,
    pub attachments_service: AttachmentsService,
    pub backup_service: BackupService,
    pub reminders_service: RemindersService,
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

    app.manage(state);

    tracing::info!("Application initialized successfully");

    Ok(())
}

/// Setup system tray with menu
fn setup_tray(app: &mut App) -> Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    tracing::info!("Setting up system tray");

    let show_item = MenuItem::with_id(app, "show", "Show QuickNotes", true, None::<&str>)?;
    let new_note_item = MenuItem::with_id(app, "new_note", "New Note", true, Some("Ctrl+Shift+N"))?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show_item, &new_note_item, &separator, &quit_item],
    )?;

    let _tray = TrayIconBuilder::new()
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
                    // Emit event to frontend to create new note
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("create-new-note", ());
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
    use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

    tracing::info!("Setting up global hotkeys");

    let handle = app.handle().clone();

    // Register Ctrl+Shift+N for new note
    app.handle()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["Ctrl+Shift+N"])?
                .with_handler(move |_app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        tracing::info!("Global hotkey triggered: {}", shortcut);

                        // Show window and emit event to create new note
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("create-new-note", ());
                        }
                    }
                })
                .build(),
        )
        .map_err(|e| crate::error::AppError::Generic(format!("Failed to setup hotkeys: {}", e)))?;

    tracing::info!("Global hotkeys setup complete");

    Ok(())
}

//! Application state and initialization
//!
//! This module manages the central application state and lifecycle.
//! All services are initialized here and made available through AppState.

use crate::database::{create_pool, Repository};
use crate::error::Result;
use crate::services::{
    AttachmentsService, BackupService, NotesService, RemindersService, SchedulerService,
    SettingsService,
};
use crate::storage::BlobStore;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::webview::Color;
use tauri::{App, Manager, WebviewUrl, WebviewWindowBuilder};

/// Dark background color to prevent white flash when opening windows
const WINDOW_BACKGROUND_COLOR: Color = Color(26, 26, 26, 255);

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
    pub settings_service: SettingsService,
    pub scheduler_service: Option<Arc<SchedulerService>>,
    /// Last focused note window label for toggle hotkey
    pub last_focused_note_window: Arc<Mutex<Option<String>>>,
}

impl AppState {
    pub async fn new(app_data_dir: PathBuf) -> Result<Self> {
        // Initialize database
        let db_path = app_data_dir.join("db.sqlite");
        let pool = create_pool(&db_path).await?;
        let db = Repository::new(pool);

        // Rebuild FTS index to ensure all notes are properly indexed
        // This handles cases where the migration couldn't parse JSON content
        if let Err(e) = db.rebuild_fts_index().await {
            tracing::warn!("Failed to rebuild FTS index: {}", e);
            // Don't fail startup if FTS rebuild fails
        }

        // Initialize blob store
        let blob_store = BlobStore::new(app_data_dir.join("blobs"));
        blob_store.initialize().await?;

        // Initialize services
        let notes_service = NotesService::new(db.clone());
        let attachments_service = AttachmentsService::new(db.clone(), blob_store.clone());
        let backup_service =
            BackupService::new(db.clone(), blob_store.clone(), app_data_dir.clone());
        let reminders_service = RemindersService::new(db.clone());
        let settings_service = SettingsService::new(app_data_dir.clone());

        // Load backup directory from settings and apply it
        if let Ok(auto_backup_settings) = settings_service.get_auto_backup().await {
            if let Some(backup_location) = auto_backup_settings.backup_location {
                if let Err(e) = backup_service.set_backup_dir(PathBuf::from(backup_location)) {
                    tracing::error!("Failed to set custom backup directory: {}", e);
                }
            }
        }

        // Initialize scheduler service for automatic backups
        let scheduler_service = match SchedulerService::new(backup_service.clone()).await {
            Ok(scheduler) => {
                tracing::info!("Scheduler service initialized successfully");
                Some(Arc::new(scheduler))
            }
            Err(e) => {
                tracing::error!("Failed to initialize scheduler service: {}", e);
                None
            }
        };

        Ok(Self {
            app_data_dir,
            db,
            blob_store,
            notes_service,
            attachments_service,
            backup_service,
            reminders_service,
            settings_service,
            scheduler_service,
            last_focused_note_window: Arc::new(Mutex::new(None)),
        })
    }
}

/// Application setup - called once on startup
pub fn setup(app: &mut App) -> Result<()> {
    tracing::info!("Initializing application");

    // Get app data directory
    let app_data_dir = app.path().app_data_dir().map_err(|e| {
        crate::error::AppError::Generic(format!("Failed to get app data dir: {}", e))
    })?;

    tracing::info!("App data directory: {:?}", app_data_dir);

    // Create necessary directories
    std::fs::create_dir_all(&app_data_dir)?;
    std::fs::create_dir_all(app_data_dir.join("blobs"))?;
    std::fs::create_dir_all(app_data_dir.join("backups"))?;
    std::fs::create_dir_all(app_data_dir.join("logs"))?;

    // Initialize application state asynchronously
    let runtime = tokio::runtime::Runtime::new()?;
    let state = runtime.block_on(AppState::new(app_data_dir))?;

    // Manage state early so it's available for other setup functions
    app.manage(state.clone());

    // Start reminders scheduler
    tracing::info!("Spawning reminders scheduler task");
    let scheduler_service = state.reminders_service.clone();
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        tracing::info!("Reminders scheduler task started, setting app handle");
        scheduler_service.set_app_handle(app_handle).await;
        tracing::info!("Starting reminders scheduler");
        scheduler_service.start_scheduler();
        tracing::info!("Reminders scheduler started");
    });

    // Start auto-backup scheduler
    if let Some(backup_scheduler) = state.scheduler_service.clone() {
        let settings_service = state.settings_service.clone();
        tauri::async_runtime::spawn(async move {
            // Start scheduler
            if let Err(e) = backup_scheduler.start().await {
                tracing::error!("Failed to start backup scheduler: {}", e);
                return;
            }

            // Load auto-backup settings and schedule if enabled
            match settings_service.get_auto_backup().await {
                Ok(settings) if settings.enabled => {
                    use crate::services::scheduler::BackupFrequency;
                    let frequency = settings
                        .frequency
                        .parse::<BackupFrequency>()
                        .unwrap_or(BackupFrequency::Days(7));
                    if let Err(e) = backup_scheduler.schedule_backup(frequency, true).await {
                        tracing::error!("Failed to schedule automatic backup: {}", e);
                    } else {
                        tracing::info!("Automatic backup scheduled: {:?}", frequency);
                    }
                }
                Ok(_) => {
                    tracing::info!("Automatic backups disabled");
                }
                Err(e) => {
                    tracing::error!("Failed to load auto-backup settings: {}", e);
                }
            }
        });
    }

    // Setup system tray
    setup_tray(app)?;

    // Register global hotkeys (state is now available via app.state())
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

    // Check for updates on startup
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        check_for_update_on_startup(app_handle).await;
    });

    tracing::info!("Application initialized successfully");

    Ok(())
}

/// Check for updates on application startup
/// If an update is available, show the update-required window and hide the main window
async fn check_for_update_on_startup(app: tauri::AppHandle) {
    tracing::info!("Checking for updates on startup...");

    // Check for updates using the existing command
    match crate::commands::check_for_update(app.clone()).await {
        Ok(update_info) => {
            if update_info.available {
                tracing::info!(
                    "Update available: {} -> {}",
                    update_info.current_version,
                    update_info.version.as_deref().unwrap_or("unknown")
                );

                // Hide the main window
                if let Some(main_window) = app.get_webview_window("main") {
                    let _ = main_window.hide();
                }

                // Create and show the update-required window
                match WebviewWindowBuilder::new(
                    &app,
                    "update-required",
                    WebviewUrl::App("pages/update-required.html".into()),
                )
                .title("Update Required - SwatNotes")
                .inner_size(500.0, 550.0)
                .min_inner_size(450.0, 500.0)
                .resizable(false)
                .decorations(true)
                .center()
                .visible(false) // Hidden until content loads
                .background_color(WINDOW_BACKGROUND_COLOR)
                .build()
                {
                    Ok(_window) => {
                        tracing::info!("Update-required window created successfully");
                    }
                    Err(e) => {
                        tracing::error!("Failed to create update-required window: {}", e);
                        // If we can't show the update window, show the main window anyway
                        if let Some(main_window) = app.get_webview_window("main") {
                            let _ = main_window.show();
                        }
                    }
                }
            } else {
                tracing::info!("Application is up to date");
                // Show the main window
                if let Some(main_window) = app.get_webview_window("main") {
                    let _ = main_window.show();
                    let _ = main_window.set_focus();
                }
            }
        }
        Err(e) => {
            // If update check fails (no internet, etc.), show the main window and continue
            tracing::warn!(
                "Failed to check for updates: {}. Continuing without update check.",
                e
            );
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.set_focus();
            }
        }
    }
}

/// Setup system tray with menu
fn setup_tray(app: &mut App) -> Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    tracing::info!("Setting up system tray");

    // Load hotkey settings to display in tray menu
    let state: tauri::State<AppState> = app.state();
    let settings_service = state.settings_service.clone();

    let hotkeys =
        tokio::runtime::Runtime::new()?.block_on(async { settings_service.get_hotkeys().await })?;

    let show_item = MenuItem::with_id(
        app,
        "show",
        "Toggle SwatNotes",
        true,
        Some(hotkeys.open_search.as_str()),
    )?;
    let new_note_item = MenuItem::with_id(
        app,
        "new_note",
        "New Note",
        true,
        Some(hotkeys.new_note.as_str()),
    )?;
    let toggle_note_item = MenuItem::with_id(
        app,
        "toggle_note",
        "Toggle Note",
        true,
        Some(hotkeys.toggle_note.as_str()),
    )?;
    let toggle_all_notes_item = MenuItem::with_id(
        app,
        "toggle_all_notes",
        "Toggle All Notes",
        true,
        Some(hotkeys.toggle_all_notes.as_str()),
    )?;
    let quick_capture_item = MenuItem::with_id(
        app,
        "quick_capture",
        "Quick Capture from Clipboard",
        true,
        Some(hotkeys.quick_capture.as_str()),
    )?;
    let settings_item = MenuItem::with_id(
        app,
        "settings",
        "Settings",
        true,
        Some(hotkeys.open_settings.as_str()),
    )?;
    let about_item = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &new_note_item,
            &toggle_note_item,
            &toggle_all_notes_item,
            &quick_capture_item,
            &settings_item,
            &about_item,
            &separator,
            &quit_item,
        ],
    )?;

    let icon = app
        .default_window_icon()
        .ok_or_else(|| crate::error::AppError::Generic("No default window icon found".into()))?
        .clone();

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false) // Only show menu on right-click
        .tooltip("SwatNotes")
        .on_tray_icon_event(|tray, event| {
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    // Single left click toggles main window
                    tracing::info!("System tray icon left-clicked");
                    let app = tray.app_handle();
                    if let Err(e) = crate::commands::toggle_main_window(app.clone()) {
                        tracing::error!("Failed to toggle main window from tray click: {}", e);
                    }
                }
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    // Double left click also toggles main window
                    tracing::info!("System tray icon double-clicked");
                    let app = tray.app_handle();
                    if let Err(e) = crate::commands::toggle_main_window(app.clone()) {
                        tracing::error!(
                            "Failed to toggle main window from tray double-click: {}",
                            e
                        );
                    }
                }
                _ => {}
            }
        })
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    // Toggle main window (show/hide)
                    if let Err(e) = crate::commands::toggle_main_window(app.clone()) {
                        tracing::error!("Failed to toggle main window: {}", e);
                    }
                }
                "new_note" => {
                    // Create a new sticky note window
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = crate::commands::create_new_sticky_note(
                            app_handle.clone(),
                            app_handle.state(),
                        )
                        .await
                        {
                            tracing::error!("Failed to create sticky note from tray menu: {}", e);
                        }
                    });
                }
                "toggle_note" => {
                    // Toggle last focused note window
                    if let Err(e) =
                        crate::commands::toggle_last_focused_note_window(app.clone(), app.state())
                    {
                        tracing::error!("Failed to toggle note window from tray menu: {}", e);
                    }
                }
                "toggle_all_notes" => {
                    // Toggle all note windows
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = crate::commands::toggle_all_note_windows(
                            app_handle.clone(),
                            app_handle.state(),
                        )
                        .await
                        {
                            tracing::error!(
                                "Failed to toggle all note windows from tray menu: {}",
                                e
                            );
                        }
                    });
                }
                "quick_capture" => {
                    // Quick capture from clipboard
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = crate::commands::quick_capture_from_clipboard(
                            app_handle.clone(),
                            app_handle.state(),
                        )
                        .await
                        {
                            tracing::error!("Failed to quick capture from tray menu: {}", e);
                        }
                    });
                }
                "settings" => {
                    // Toggle settings window (show/hide)
                    if let Err(e) = crate::commands::toggle_settings_window(app.clone()) {
                        tracing::error!("Failed to toggle settings window: {}", e);
                    }
                }
                "about" => {
                    // Toggle about window (show/hide)
                    if let Err(e) = crate::commands::toggle_about_window(app.clone()) {
                        tracing::error!("Failed to toggle about window: {}", e);
                    }
                }
                "quit" => {
                    // Cleanup scheduler before exit
                    let app_state: tauri::State<AppState> = app.state();
                    if let Some(scheduler) = &app_state.scheduler_service {
                        let scheduler_clone = Arc::clone(scheduler);
                        match tokio::runtime::Runtime::new() {
                            Ok(runtime) => {
                                runtime.block_on(async move {
                                    if let Err(e) = scheduler_clone.shutdown().await {
                                        tracing::error!("Failed to shutdown scheduler: {}", e);
                                    }
                                });
                            }
                            Err(e) => {
                                tracing::error!(
                                    "Failed to create runtime for scheduler shutdown: {}",
                                    e
                                );
                            }
                        }
                    }
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

    // Load hotkey settings
    let state: tauri::State<AppState> = app.state();
    let settings_service = state.settings_service.clone();

    let hotkeys =
        tokio::runtime::Runtime::new()?.block_on(async { settings_service.get_hotkeys().await })?;

    tracing::info!(
        "Loaded hotkey settings: new_note={}, toggle_note={}, open_search={}, open_settings={}, toggle_all_notes={}, quick_capture={}",
        hotkeys.new_note,
        hotkeys.toggle_note,
        hotkeys.open_search,
        hotkeys.open_settings,
        hotkeys.toggle_all_notes,
        hotkeys.quick_capture
    );

    // Unregister any existing hotkeys (from previous instance or crash)
    for shortcut in [
        &hotkeys.new_note,
        &hotkeys.toggle_note,
        &hotkeys.open_search,
        &hotkeys.open_settings,
        &hotkeys.toggle_all_notes,
        &hotkeys.quick_capture,
    ] {
        if app.global_shortcut().is_registered(shortcut.as_str()) {
            tracing::warn!(
                "Hotkey {} already registered, unregistering first",
                shortcut
            );
            if let Err(e) = app.global_shortcut().unregister(shortcut.as_str()) {
                tracing::error!("Failed to unregister existing hotkey: {}", e);
            }
        }
    }

    // Register hotkey for creating new sticky notes
    // Note: on_shortcut() both registers the hotkey AND sets up the event handler
    let new_note_shortcut = hotkeys.new_note.clone();
    app.global_shortcut()
        .on_shortcut(new_note_shortcut.as_str(), move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                tracing::info!("New note hotkey triggered");

                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = crate::commands::create_new_sticky_note(
                        app_handle.clone(),
                        app_handle.state(),
                    )
                    .await
                    {
                        tracing::error!("Failed to create sticky note from hotkey: {}", e);
                    }
                });
            }
        })
        .map_err(|e| {
            crate::error::AppError::Generic(format!("Failed to register shortcut handler: {}", e))
        })?;
    tracing::info!(
        "Global hotkey new_note ({}) registered successfully",
        hotkeys.new_note
    );

    // Register hotkey for toggling the last focused note window
    let toggle_note_shortcut = hotkeys.toggle_note.clone();
    app.global_shortcut()
        .on_shortcut(
            toggle_note_shortcut.as_str(),
            move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    tracing::info!("Toggle note hotkey triggered");

                    if let Err(e) =
                        crate::commands::toggle_last_focused_note_window(app.clone(), app.state())
                    {
                        tracing::error!("Failed to toggle note window from hotkey: {}", e);
                    }
                }
            },
        )
        .map_err(|e| {
            crate::error::AppError::Generic(format!(
                "Failed to register toggle shortcut handler: {}",
                e
            ))
        })?;
    tracing::info!(
        "Global hotkey toggle_note ({}) registered successfully",
        hotkeys.toggle_note
    );

    // Register hotkey for toggling main window (show/hide)
    let open_search_shortcut = hotkeys.open_search.clone();
    app.global_shortcut()
        .on_shortcut(
            open_search_shortcut.as_str(),
            move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    tracing::info!("Toggle main window hotkey triggered");

                    if let Err(e) = crate::commands::toggle_main_window(app.clone()) {
                        tracing::error!("Failed to toggle main window from hotkey: {}", e);
                    }
                }
            },
        )
        .map_err(|e| {
            crate::error::AppError::Generic(format!(
                "Failed to register toggle main window shortcut handler: {}",
                e
            ))
        })?;
    tracing::info!(
        "Global hotkey open_search/toggle_main ({}) registered successfully",
        hotkeys.open_search
    );

    // Register hotkey for toggling settings window (show/hide)
    let open_settings_shortcut = hotkeys.open_settings.clone();
    app.global_shortcut()
        .on_shortcut(
            open_settings_shortcut.as_str(),
            move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    tracing::info!("Toggle settings window hotkey triggered");

                    if let Err(e) = crate::commands::toggle_settings_window(app.clone()) {
                        tracing::error!("Failed to toggle settings window from hotkey: {}", e);
                    }
                }
            },
        )
        .map_err(|e| {
            crate::error::AppError::Generic(format!(
                "Failed to register toggle settings shortcut handler: {}",
                e
            ))
        })?;
    tracing::info!(
        "Global hotkey open_settings/toggle_settings ({}) registered successfully",
        hotkeys.open_settings
    );

    // Register hotkey for toggling all note windows (show/hide all)
    let toggle_all_notes_shortcut = hotkeys.toggle_all_notes.clone();
    app.global_shortcut()
        .on_shortcut(
            toggle_all_notes_shortcut.as_str(),
            move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    tracing::info!("Toggle all notes hotkey triggered");

                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = crate::commands::toggle_all_note_windows(
                            app_handle.clone(),
                            app_handle.state(),
                        )
                        .await
                        {
                            tracing::error!("Failed to toggle all note windows from hotkey: {}", e);
                        }
                    });
                }
            },
        )
        .map_err(|e| {
            crate::error::AppError::Generic(format!(
                "Failed to register toggle all notes shortcut handler: {}",
                e
            ))
        })?;
    tracing::info!(
        "Global hotkey toggle_all_notes ({}) registered successfully",
        hotkeys.toggle_all_notes
    );

    // Register hotkey for quick capture from clipboard
    let quick_capture_shortcut = hotkeys.quick_capture.clone();
    app.global_shortcut()
        .on_shortcut(
            quick_capture_shortcut.as_str(),
            move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    tracing::info!("Quick capture hotkey triggered");

                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = crate::commands::quick_capture_from_clipboard(
                            app_handle.clone(),
                            app_handle.state(),
                        )
                        .await
                        {
                            tracing::error!("Failed to quick capture from hotkey: {}", e);
                        }
                    });
                }
            },
        )
        .map_err(|e| {
            crate::error::AppError::Generic(format!(
                "Failed to register quick capture shortcut handler: {}",
                e
            ))
        })?;
    tracing::info!(
        "Global hotkey quick_capture ({}) registered successfully",
        hotkeys.quick_capture
    );

    tracing::info!("Global hotkeys setup complete");

    Ok(())
}

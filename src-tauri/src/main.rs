// SwatNotes - Production-grade desktop notes application
// Entry point and application setup

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod commands;
mod config;
mod crypto;
mod database;
mod error;
#[cfg(target_os = "windows")]
mod platform;
mod services;
mod storage;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "swatnotes=debug,info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting SwatNotes application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            tracing::info!("Running app setup");
            app::setup(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_app_info,
            commands::create_note,
            commands::get_note,
            commands::list_notes,
            commands::update_note,
            commands::delete_note,
            commands::delete_note_and_close_window,
            commands::search_notes,
            commands::count_deleted_notes,
            commands::prune_deleted_notes,
            commands::open_note_window,
            commands::create_new_sticky_note,
            commands::set_last_focused_note_window,
            commands::toggle_last_focused_note_window,
            commands::open_settings_window,
            commands::open_main_window_and_focus_search,
            commands::create_attachment,
            commands::list_attachments,
            commands::get_attachment_data,
            commands::delete_attachment,
            commands::create_backup,
            commands::list_backups,
            commands::restore_backup,
            commands::delete_backup,
            commands::create_reminder,
            commands::list_active_reminders,
            commands::delete_reminder,
            commands::get_hotkey_settings,
            commands::update_hotkey_settings,
            commands::get_autostart_state,
            commands::set_autostart,
            commands::toggle_autostart,
            commands::store_auto_backup_password,
            commands::has_auto_backup_password,
            commands::delete_auto_backup_password,
            commands::get_auto_backup_settings,
            commands::update_auto_backup_settings,
            commands::pick_backup_directory,
            commands::get_backup_directory,
            commands::get_reminder_settings,
            commands::update_reminder_settings,
            commands::get_behavior_settings,
            commands::update_behavior_settings,
            commands::check_for_update,
            commands::download_and_install_update,
            commands::toggle_main_window,
            commands::toggle_settings_window,
            commands::toggle_all_note_windows,
            commands::quick_capture_from_clipboard,
            commands::create_collection,
            commands::get_collection,
            commands::list_collections,
            commands::update_collection,
            commands::delete_collection,
            commands::update_note_collection,
            commands::list_notes_in_collection,
            commands::list_uncategorized_notes,
            commands::count_notes_in_collection,
            commands::import_from_onenote,
            commands::restart_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// QuickNotes - Production-grade desktop notes application
// Entry point and application setup

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod commands;
mod error;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quicknotes=debug,info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting QuickNotes application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            tracing::info!("Running app setup");
            app::setup(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_app_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

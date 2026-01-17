//! Application state and initialization
//!
//! This module manages the central application state and lifecycle.
//! All services are initialized here and made available through AppState.

use crate::error::Result;
use std::sync::Arc;
use tauri::{App, Manager};

/// Central application state holding all services
#[derive(Clone)]
pub struct AppState {
    pub app_data_dir: std::path::PathBuf,
}

impl AppState {
    pub fn new(app_data_dir: std::path::PathBuf) -> Self {
        Self { app_data_dir }
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

    // Initialize application state
    let state = AppState::new(app_data_dir);
    app.manage(state);

    tracing::info!("Application initialized successfully");

    Ok(())
}

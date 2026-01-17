//! Application state and initialization
//!
//! This module manages the central application state and lifecycle.
//! All services are initialized here and made available through AppState.

use crate::database::{create_pool, Repository};
use crate::error::Result;
use crate::services::{AttachmentsService, BackupService, NotesService};
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

        Ok(Self {
            app_data_dir,
            db,
            blob_store,
            notes_service,
            attachments_service,
            backup_service,
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
    app.manage(state);

    tracing::info!("Application initialized successfully");

    Ok(())
}

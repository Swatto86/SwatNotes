//! Database module
//!
//! This module provides all database functionality including:
//! - Schema and migrations
//! - Model definitions
//! - Repository layer for CRUD operations

pub mod migrations;
pub mod models;
pub mod repository;
pub mod schema;

pub use models::*;
pub use repository::Repository;
pub use schema::initialize_database;

use crate::error::Result;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

/// Build connection options shared by migration and application connections.
fn connect_options(db_path: &Path) -> std::result::Result<SqliteConnectOptions, sqlx::Error> {
    SqliteConnectOptions::from_str(&format!("sqlite://{}?mode=rwc", db_path.display())).map(
        |opts| {
            opts.create_if_missing(true)
                .busy_timeout(Duration::from_secs(5))
                .journal_mode(SqliteJournalMode::Wal)
                .foreign_keys(true)
        },
    )
}

/// Create and initialize a database connection pool.
///
/// Migrations run on a dedicated single-connection pool that is closed
/// before the application pool is created. This prevents schema-caching
/// issues where pooled connections opened before ALTER TABLE ADD COLUMN
/// still see the old column count.
pub async fn create_pool(db_path: &Path) -> Result<SqlitePool> {
    tracing::info!("Creating database connection pool at: {:?}", db_path);

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Phase 1 — run migrations on a single dedicated connection.
    // Using max_connections(1) guarantees every PRAGMA and every
    // ALTER TABLE executes on the same connection, eliminating
    // stale-schema reads from other pooled connections.
    let migration_pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(connect_options(db_path)?)
        .await?;

    initialize_database(&migration_pool).await?;
    migration_pool.close().await;

    // Phase 2 — create the application pool.
    // All connections are opened *after* migrations have committed,
    // so they read the final schema including every ADD COLUMN.
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options(db_path)?)
        .await?;

    tracing::info!("Database pool created successfully");

    Ok(pool)
}

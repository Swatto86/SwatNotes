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
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;
use std::str::FromStr;

/// Create and initialize a database connection pool
pub async fn create_pool(db_path: &Path) -> Result<SqlitePool> {
    tracing::info!("Creating database connection pool at: {:?}", db_path);

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Build connection options
    let conn_opts =
        SqliteConnectOptions::from_str(&format!("sqlite://{}?mode=rwc", db_path.display()))?
            .create_if_missing(true);

    // Create pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(conn_opts)
        .await?;

    // Initialize schema
    initialize_database(&pool).await?;

    tracing::info!("Database pool created successfully");

    Ok(pool)
}

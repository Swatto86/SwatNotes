//! Database schema and migrations
//!
//! This module handles database initialization and schema migrations.
//! Uses SQLite with WAL mode for better concurrency and crash safety.

use crate::error::Result;
use sqlx::{sqlite::SqlitePool, Row};

/// Initialize database with schema
pub async fn initialize_database(pool: &SqlitePool) -> Result<()> {
    tracing::info!("Initializing database schema");

    // Enable WAL mode for better performance and crash safety
    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(pool)
        .await?;

    // Enable foreign keys
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;

    // Create migrations table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Get current version
    let current_version: i32 = sqlx::query("SELECT COALESCE(MAX(version), 0) FROM migrations")
        .fetch_one(pool)
        .await?
        .get(0);

    tracing::info!("Current database version: {}", current_version);

    // Apply migrations
    apply_migrations(pool, current_version).await?;

    tracing::info!("Database initialization complete");
    Ok(())
}

async fn apply_migrations(pool: &SqlitePool, current_version: i32) -> Result<()> {
    let migrations = get_migrations();

    for (version, sql) in migrations {
        if version > current_version {
            tracing::info!("Applying migration version {}", version);

            // Execute migration in a transaction
            let mut tx = pool.begin().await?;

            // Run migration SQL
            for statement in sql.split(";").filter(|s| !s.trim().is_empty()) {
                sqlx::query(statement).execute(&mut *tx).await?;
            }

            // Record migration
            sqlx::query("INSERT INTO migrations (version) VALUES (?)")
                .bind(version)
                .execute(&mut *tx)
                .await?;

            tx.commit().await?;

            tracing::info!("Migration version {} applied successfully", version);
        }
    }

    Ok(())
}

fn get_migrations() -> Vec<(i32, &'static str)> {
    vec![
        (1, include_str!("migrations/001_initial_schema.sql")),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn test_initialize_database() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        initialize_database(&pool).await.unwrap();

        // Verify migrations table exists
        let result: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM migrations")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert!(result >= 0);
    }

    #[tokio::test]
    async fn test_foreign_keys_enabled() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        initialize_database(&pool).await.unwrap();

        let foreign_keys: i32 = sqlx::query_scalar("PRAGMA foreign_keys")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert_eq!(foreign_keys, 1);
    }
}

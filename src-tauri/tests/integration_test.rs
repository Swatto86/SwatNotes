//! Integration tests for SwatNotes
//!
//! These tests verify end-to-end functionality including:
//! - Database operations
//! - Encryption/decryption
//! - Backup and restore workflows

use swatnotes::database::{create_pool, Repository};
use swatnotes::services::NotesService;
use swatnotes::storage::BlobStore;
use swatnotes::services::BackupService;
use std::path::PathBuf;
use tempfile::TempDir;

/// Helper to create a test database with schema
async fn create_test_db() -> (Repository, TempDir) {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let pool = create_pool(&db_path).await.unwrap();
    let repo = Repository::new(pool);

    (repo, temp_dir)
}

/// Helper to create test blob store
async fn create_test_blob_store() -> (BlobStore, TempDir) {
    let temp_dir = TempDir::new().unwrap();
    let blob_store = BlobStore::new(temp_dir.path().join("blobs"));
    blob_store.initialize().await.unwrap();

    (blob_store, temp_dir)
}

#[tokio::test]
async fn test_note_crud_operations() {
    let (repo, _temp) = create_test_db().await;
    let notes_service = NotesService::new(repo);

    // Create note
    let note = notes_service
        .create_note("Test Note".to_string(), r#"{"ops":[{"insert":"Hello\n"}]}"#.to_string())
        .await
        .unwrap();

    assert_eq!(note.title, "Test Note");
    assert!(!note.id.is_empty());

    // Read note
    let retrieved = notes_service.get_note(&note.id).await.unwrap();
    assert_eq!(retrieved.id, note.id);
    assert_eq!(retrieved.title, "Test Note");

    // Update note
    let updated = notes_service
        .update_note(note.id.clone(), Some("Updated Title".to_string()), None)
        .await
        .unwrap();

    assert_eq!(updated.title, "Updated Title");

    // List notes
    let notes = notes_service.list_notes().await.unwrap();
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].title, "Updated Title");

    // Delete note (soft delete)
    notes_service.delete_note(&note.id).await.unwrap();

    // Verify deleted
    let deleted_note = notes_service.get_note(&note.id).await.unwrap();
    assert!(deleted_note.deleted_at.is_some());

    // List should be empty (soft-deleted notes aren't listed)
    let notes = notes_service.list_notes().await.unwrap();
    assert_eq!(notes.len(), 0);
}

#[tokio::test]
async fn test_search_functionality() {
    let (repo, _temp) = create_test_db().await;
    let notes_service = NotesService::new(repo);

    // Create test notes
    notes_service
        .create_note("Shopping List".to_string(), r#"{"ops":[{"insert":"Buy milk\n"}]}"#.to_string())
        .await
        .unwrap();

    notes_service
        .create_note("Todo".to_string(), r#"{"ops":[{"insert":"Fix bug\n"}]}"#.to_string())
        .await
        .unwrap();

    notes_service
        .create_note("Meeting Notes".to_string(), r#"{"ops":[{"insert":"Discuss project\n"}]}"#.to_string())
        .await
        .unwrap();

    // Search by title
    let results = notes_service.search_notes("todo").await.unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "Todo");

    // Search by content
    let results = notes_service.search_notes("milk").await.unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "Shopping List");

    // Search with no matches
    let results = notes_service.search_notes("nonexistent").await.unwrap();
    assert_eq!(results.len(), 0);
}

#[tokio::test]
async fn test_blob_storage_operations() {
    let (blob_store, _temp) = create_test_blob_store().await;

    let data = b"Hello, this is test data for blob storage!";

    // Write blob
    let hash = blob_store.write(data).await.unwrap();
    assert_eq!(hash.len(), 64); // SHA-256 produces 64 hex characters

    // Verify exists
    assert!(blob_store.exists(&hash).await.unwrap());

    // Read blob
    let retrieved = blob_store.read(&hash).await.unwrap();
    assert_eq!(retrieved, data);

    // Writing same data should return same hash
    let hash2 = blob_store.write(data).await.unwrap();
    assert_eq!(hash, hash2);

    // Delete blob
    blob_store.delete(&hash).await.unwrap();
    assert!(!blob_store.exists(&hash).await.unwrap());
}

#[tokio::test]
async fn test_backup_and_restore_workflow() {
    // Setup
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path().to_path_buf();

    let db_path = app_data_dir.join("test.db");
    let pool = create_pool(&db_path).await.unwrap();
    let repo = Repository::new(pool);

    let blob_store = BlobStore::new(app_data_dir.join("blobs"));
    blob_store.initialize().await.unwrap();

    let notes_service = NotesService::new(repo.clone());
    let backup_service = BackupService::new(repo.clone(), blob_store.clone(), app_data_dir.clone());

    // Create some test data
    let note1 = notes_service
        .create_note("Note 1".to_string(), r#"{"ops":[{"insert":"Content 1\n"}]}"#.to_string())
        .await
        .unwrap();

    let note2 = notes_service
        .create_note("Note 2".to_string(), r#"{"ops":[{"insert":"Content 2\n"}]}"#.to_string())
        .await
        .unwrap();

    // Create backup
    let password = "test_backup_password_123";
    let backup_path = backup_service.create_backup(password).await.unwrap();

    assert!(backup_path.exists());

    // Delete original notes
    notes_service.delete_note(&note1.id).await.unwrap();
    notes_service.delete_note(&note2.id).await.unwrap();

    let notes = notes_service.list_notes().await.unwrap();
    assert_eq!(notes.len(), 0, "All notes should be deleted");

    // Restore from backup
    backup_service.restore_backup(&backup_path, password).await.unwrap();

    // Verify notes are restored
    let restored_notes = notes_service.list_notes().await.unwrap();
    assert_eq!(restored_notes.len(), 2, "Both notes should be restored");

    let titles: Vec<&str> = restored_notes.iter().map(|n| n.title.as_str()).collect();
    assert!(titles.contains(&"Note 1"));
    assert!(titles.contains(&"Note 2"));
}

#[tokio::test]
async fn test_backup_with_wrong_password() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path().to_path_buf();

    let db_path = app_data_dir.join("test.db");
    let pool = create_pool(&db_path).await.unwrap();
    let repo = Repository::new(pool);

    let blob_store = BlobStore::new(app_data_dir.join("blobs"));
    blob_store.initialize().await.unwrap();

    let backup_service = BackupService::new(repo, blob_store, app_data_dir.clone());

    // Create backup
    let correct_password = "correct_password";
    let backup_path = backup_service.create_backup(correct_password).await.unwrap();

    // Try to restore with wrong password
    let wrong_password = "wrong_password";
    let result = backup_service.restore_backup(&backup_path, wrong_password).await;

    assert!(result.is_err(), "Restore with wrong password should fail");
}

#[tokio::test]
async fn test_list_backups() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path().to_path_buf();

    let db_path = app_data_dir.join("test.db");
    let pool = create_pool(&db_path).await.unwrap();
    let repo = Repository::new(pool);

    let blob_store = BlobStore::new(app_data_dir.join("blobs"));
    blob_store.initialize().await.unwrap();

    let backup_service = BackupService::new(repo, blob_store, app_data_dir.clone());

    // Initially no backups
    let backups = backup_service.list_backups().await.unwrap();
    assert_eq!(backups.len(), 0);

    // Create a backup
    let password = "password";
    backup_service.create_backup(password).await.unwrap();

    // Should have one backup
    let backups = backup_service.list_backups().await.unwrap();
    assert_eq!(backups.len(), 1);
    assert!(backups[0].size > 0);
}

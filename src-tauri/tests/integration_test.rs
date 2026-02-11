//! Integration tests for SwatNotes
//!
//! These tests verify end-to-end functionality including:
//! - Database operations
//! - Encryption/decryption
//! - Backup and restore workflows

use swatnotes::database::{create_pool, Repository};
use swatnotes::services::BackupService;
use swatnotes::services::NotesService;
use swatnotes::storage::BlobStore;
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
        .create_note(
            "Test Note".to_string(),
            r#"{"ops":[{"insert":"Hello\n"}]}"#.to_string(),
        )
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
        .update_note(
            note.id.clone(),
            Some("Updated Title".to_string()),
            None,
            None,
        )
        .await
        .unwrap();

    assert_eq!(updated.title, "Updated Title");

    // List notes
    let notes = notes_service.list_notes().await.unwrap();
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].title, "Updated Title");

    // Delete note (soft delete)
    notes_service.delete_note(&note.id).await.unwrap();

    // Verify deleted - get_note filters out soft-deleted notes, so it should return NoteNotFound
    let deleted_result = notes_service.get_note(&note.id).await;
    assert!(
        deleted_result.is_err(),
        "get_note should return error for soft-deleted note"
    );

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
        .create_note(
            "Shopping List".to_string(),
            r#"{"ops":[{"insert":"Buy milk\n"}]}"#.to_string(),
        )
        .await
        .unwrap();

    notes_service
        .create_note(
            "Todo".to_string(),
            r#"{"ops":[{"insert":"Fix bug\n"}]}"#.to_string(),
        )
        .await
        .unwrap();

    notes_service
        .create_note(
            "Meeting Notes".to_string(),
            r#"{"ops":[{"insert":"Discuss project\n"}]}"#.to_string(),
        )
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

    let db_path = app_data_dir.join("db.sqlite");
    let pool = create_pool(&db_path).await.unwrap();
    let repo = Repository::new(pool);

    let blob_store = BlobStore::new(app_data_dir.join("blobs"));
    blob_store.initialize().await.unwrap();

    let notes_service = NotesService::new(repo.clone());
    let backup_service = BackupService::new(repo.clone(), blob_store.clone(), app_data_dir.clone());

    // Create some test data
    let note1 = notes_service
        .create_note(
            "Note 1".to_string(),
            r#"{"ops":[{"insert":"Content 1\n"}]}"#.to_string(),
        )
        .await
        .unwrap();

    let note2 = notes_service
        .create_note(
            "Note 2".to_string(),
            r#"{"ops":[{"insert":"Content 2\n"}]}"#.to_string(),
        )
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
    backup_service
        .restore_backup(&backup_path, password)
        .await
        .unwrap();

    // After restore, the original pool is closed. Reconnect to verify.
    let pool = create_pool(&db_path).await.unwrap();
    let repo = Repository::new(pool);
    let notes_service = NotesService::new(repo);

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

    let notes_service = NotesService::new(repo.clone());
    let backup_service = BackupService::new(repo, blob_store, app_data_dir.clone());

    // Must create at least one note before backup
    notes_service
        .create_note("Test Note".to_string(), "{}".to_string())
        .await
        .unwrap();

    // Create backup
    let correct_password = "correct_password";
    let backup_path = backup_service
        .create_backup(correct_password)
        .await
        .unwrap();

    // Try to restore with wrong password
    let wrong_password = "wrong_password";
    let result = backup_service
        .restore_backup(&backup_path, wrong_password)
        .await;

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

    let notes_service = NotesService::new(repo.clone());
    let backup_service = BackupService::new(repo, blob_store, app_data_dir.clone());

    // Initially no backups
    let backups = backup_service.list_backups().await.unwrap();
    assert_eq!(backups.len(), 0);

    // Must create at least one note before backup
    notes_service
        .create_note("Test Note".to_string(), "{}".to_string())
        .await
        .unwrap();

    // Create a backup
    let password = "password";
    backup_service.create_backup(password).await.unwrap();

    // Should have one backup
    let backups = backup_service.list_backups().await.unwrap();
    assert_eq!(backups.len(), 1);
    assert!(backups[0].size > 0);
}

// ===== Regression Tests =====

#[tokio::test]
async fn test_regression_soft_delete_excludes_from_list() {
    // Regression: Ensure soft-deleted notes don't appear in list_notes()
    let (repo, _temp) = create_test_db().await;
    let notes_service = NotesService::new(repo);

    // Create multiple notes
    for i in 1..=5 {
        notes_service
            .create_note(format!("Note {}", i), "{}".to_string())
            .await
            .unwrap();
    }

    let notes = notes_service.list_notes().await.unwrap();
    assert_eq!(notes.len(), 5);

    // Delete some notes
    notes_service.delete_note(&notes[0].id).await.unwrap();
    notes_service.delete_note(&notes[2].id).await.unwrap();

    // List should only return non-deleted notes
    let remaining = notes_service.list_notes().await.unwrap();
    assert_eq!(remaining.len(), 3);
}

#[tokio::test]
async fn test_regression_search_empty_query_returns_all() {
    // Regression: Empty search query should return all notes
    let (repo, _temp) = create_test_db().await;
    let notes_service = NotesService::new(repo);

    notes_service
        .create_note("Note 1".to_string(), "{}".to_string())
        .await
        .unwrap();
    notes_service
        .create_note("Note 2".to_string(), "{}".to_string())
        .await
        .unwrap();
    notes_service
        .create_note("Note 3".to_string(), "{}".to_string())
        .await
        .unwrap();

    // Empty query
    let results = notes_service.search_notes("").await.unwrap();
    assert_eq!(results.len(), 3);

    // Whitespace-only query
    let results = notes_service.search_notes("   ").await.unwrap();
    assert_eq!(results.len(), 3);
}

#[tokio::test]
async fn test_regression_update_preserves_unmodified_fields() {
    // Regression: Updating one field should not affect others
    let (repo, _temp) = create_test_db().await;
    let notes_service = NotesService::new(repo);

    let note = notes_service
        .create_note(
            "Original Title".to_string(),
            r#"{"ops":[{"insert":"Original content\n"}]}"#.to_string(),
        )
        .await
        .unwrap();

    // Update only title
    let updated = notes_service
        .update_note(note.id.clone(), Some("New Title".to_string()), None, None)
        .await
        .unwrap();

    assert_eq!(updated.title, "New Title");
    assert_eq!(
        updated.content_json,
        r#"{"ops":[{"insert":"Original content\n"}]}"#
    );

    // Update only content
    let updated2 = notes_service
        .update_note(
            note.id.clone(),
            None,
            Some(r#"{"ops":[{"insert":"New content\n"}]}"#.to_string()),
            None,
        )
        .await
        .unwrap();

    assert_eq!(updated2.title, "New Title"); // Title preserved
    assert_eq!(
        updated2.content_json,
        r#"{"ops":[{"insert":"New content\n"}]}"#
    );
}

#[tokio::test]
async fn test_regression_blob_deduplication() {
    // Regression: Same content should produce same hash (deduplication)
    let (blob_store, _temp) = create_test_blob_store().await;

    let content = b"This is the same content for deduplication test";

    // Write same content multiple times
    let hash1 = blob_store.write(content).await.unwrap();
    let hash2 = blob_store.write(content).await.unwrap();
    let hash3 = blob_store.write(content).await.unwrap();

    // All hashes should be identical
    assert_eq!(hash1, hash2);
    assert_eq!(hash2, hash3);

    // Only one file should exist
    let all = blob_store.list_all().await.unwrap();
    assert_eq!(all.len(), 1);
}

#[tokio::test]
async fn test_regression_backup_with_attachments() {
    // Regression: Backup should include all attachments and restore them correctly
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path().to_path_buf();

    let db_path = app_data_dir.join("db.sqlite");
    let pool = create_pool(&db_path).await.unwrap();
    let repo = Repository::new(pool);

    let blob_store = BlobStore::new(app_data_dir.join("blobs"));
    blob_store.initialize().await.unwrap();

    let notes_service = NotesService::new(repo.clone());
    let backup_service = BackupService::new(repo.clone(), blob_store.clone(), app_data_dir.clone());

    // Create note with attachment
    let note = notes_service
        .create_note("Note with Attachment".to_string(), "{}".to_string())
        .await
        .unwrap();

    let attachment_data = b"This is attachment content";
    let hash = blob_store.write(attachment_data).await.unwrap();
    repo.create_attachment(
        &note.id,
        &hash,
        "test.txt",
        "text/plain",
        attachment_data.len() as i64,
    )
    .await
    .unwrap();

    // Create backup
    let password = "backup_password";
    let backup_path = backup_service.create_backup(password).await.unwrap();

    // Delete everything
    notes_service.delete_note(&note.id).await.unwrap();
    blob_store.delete(&hash).await.unwrap();

    // Verify deleted
    assert!(!blob_store.exists(&hash).await.unwrap());

    // Restore
    backup_service
        .restore_backup(&backup_path, password)
        .await
        .unwrap();

    // After restore, the original pool is closed. Reconnect to verify.
    let pool = create_pool(&db_path).await.unwrap();
    let repo = Repository::new(pool);
    let notes_service = NotesService::new(repo.clone());

    // Verify attachment is restored
    let restored_notes = notes_service.list_notes().await.unwrap();
    assert_eq!(restored_notes.len(), 1);

    let attachments = repo.list_attachments(&restored_notes[0].id).await.unwrap();
    assert_eq!(attachments.len(), 1);
    assert_eq!(attachments[0].filename, "test.txt");

    // Verify blob is restored
    assert!(blob_store.exists(&hash).await.unwrap());
    let restored_data = blob_store.read(&hash).await.unwrap();
    assert_eq!(restored_data, attachment_data);
}

#[tokio::test]
async fn test_regression_delete_note_removes_reminders() {
    // Regression: Deleting a note should also delete its reminders
    let (repo, _temp) = create_test_db().await;

    let note = repo
        .create_note(swatnotes::database::CreateNoteRequest {
            title: "Note with Reminder".to_string(),
            content_json: "{}".to_string(),
        })
        .await
        .unwrap();

    // Create reminder
    let trigger_time = chrono::Utc::now() + chrono::Duration::hours(1);
    repo.create_reminder(&note.id, trigger_time, None, None, None, None)
        .await
        .unwrap();

    // Verify reminder exists
    let reminders = repo.list_active_reminders().await.unwrap();
    assert_eq!(reminders.len(), 1);

    // Delete note
    repo.delete_note(&note.id).await.unwrap();

    // Reminder should be deleted too
    let reminders = repo.list_active_reminders().await.unwrap();
    assert_eq!(reminders.len(), 0);
}

#[tokio::test]
async fn test_edge_case_unicode_content() {
    // Edge case: Unicode characters in title and content
    let (repo, _temp) = create_test_db().await;
    let notes_service = NotesService::new(repo);

    let note = notes_service
        .create_note(
            "日本語タイトル".to_string(),
            r#"{"ops":[{"insert":"Unicode: 你好世界\n"}]}"#.to_string(),
        )
        .await
        .unwrap();

    let retrieved = notes_service.get_note(&note.id).await.unwrap();
    assert_eq!(retrieved.title, "日本語タイトル");
    assert!(retrieved.content_json.contains("你好世界"));
}

#[tokio::test]
async fn test_edge_case_very_long_content() {
    // Edge case: Very long content
    let (repo, _temp) = create_test_db().await;
    let notes_service = NotesService::new(repo);

    let long_text = "A".repeat(100_000);
    let content = format!(r#"{{"ops":[{{"insert":"{}\n"}}]}}"#, long_text);

    let note = notes_service
        .create_note("Long Content Note".to_string(), content.clone())
        .await
        .unwrap();

    let retrieved = notes_service.get_note(&note.id).await.unwrap();
    assert_eq!(retrieved.content_json, content);
}

#[tokio::test]
async fn test_edge_case_special_characters_in_title() {
    // Edge case: Special characters that might cause SQL issues
    let (repo, _temp) = create_test_db().await;
    let notes_service = NotesService::new(repo);

    let special_titles = vec![
        "Note with 'quotes'",
        "Note with \"double quotes\"",
        "Note with <html> tags",
        "Note with \\ backslash",
        "Note with % percent",
        "Note with _ underscore",
        "Note; DROP TABLE notes;--", // SQL injection attempt
    ];

    for title in special_titles {
        let note = notes_service
            .create_note(title.to_string(), "{}".to_string())
            .await
            .unwrap();

        let retrieved = notes_service.get_note(&note.id).await.unwrap();
        assert_eq!(retrieved.title, title);
    }
}

#[tokio::test]
async fn test_concurrent_note_creation() {
    // Test concurrent operations don't cause conflicts
    let (repo, _temp) = create_test_db().await;
    let notes_service = NotesService::new(repo);

    let mut handles = vec![];

    for i in 0..10 {
        let svc = notes_service.clone();
        let handle = tokio::spawn(async move {
            svc.create_note(format!("Concurrent Note {}", i), "{}".to_string())
                .await
        });
        handles.push(handle);
    }

    // Wait for all to complete
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }

    // Verify all notes were created
    let notes = notes_service.list_notes().await.unwrap();
    assert_eq!(notes.len(), 10);
}

// ===== Encryption Tests =====

#[tokio::test]
async fn test_encryption_integrity() {
    use swatnotes::crypto::{decrypt, encrypt};

    let test_cases = vec![
        b"Hello, World!".to_vec(),
        b"".to_vec(),
        vec![0u8; 1000],
        (0..255).collect::<Vec<u8>>(),
        "Unicode: 日本語".as_bytes().to_vec(),
    ];

    for plaintext in test_cases {
        let password = "test_password_123";
        let encrypted = encrypt(&plaintext, password).unwrap();
        let decrypted = decrypt(&encrypted, password).unwrap();
        assert_eq!(plaintext, decrypted);
    }
}

#[tokio::test]
async fn test_different_passwords_different_ciphertext() {
    use swatnotes::crypto::encrypt;

    let plaintext = b"Same content";
    let password1 = "password1";
    let password2 = "password2";

    let encrypted1 = encrypt(plaintext, password1).unwrap();
    let encrypted2 = encrypt(plaintext, password2).unwrap();

    // Different passwords should produce different ciphertext
    assert_ne!(encrypted1, encrypted2);
}

#[tokio::test]
async fn test_same_password_different_nonce() {
    use swatnotes::crypto::encrypt;

    let plaintext = b"Same content";
    let password = "same_password";

    let encrypted1 = encrypt(plaintext, password).unwrap();
    let encrypted2 = encrypt(plaintext, password).unwrap();

    // Same password but random nonce means different ciphertext each time
    assert_ne!(encrypted1, encrypted2);
}

//! Error types for SwatNotes application
//!
//! All errors use thiserror for structured error handling.
//! These errors can be serialized to the frontend.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("ZIP error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("Note not found: {0}")]
    NoteNotFound(String),

    #[allow(dead_code)]
    #[error("Backup error: {0}")]
    Backup(String),

    #[error("Restore error: {0}")]
    Restore(String),

    #[error("Blob store error: {0}")]
    BlobStore(String),

    #[error("{0}")]
    Generic(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_note_not_found_error() {
        let error = AppError::NoteNotFound("test-id-123".to_string());
        assert_eq!(error.to_string(), "Note not found: test-id-123");
    }

    #[test]
    fn test_backup_error() {
        let error = AppError::Backup("Disk full".to_string());
        assert_eq!(error.to_string(), "Backup error: Disk full");
    }

    #[test]
    fn test_restore_error() {
        let error = AppError::Restore("Invalid password".to_string());
        assert_eq!(error.to_string(), "Restore error: Invalid password");
    }

    #[test]
    fn test_blob_store_error() {
        let error = AppError::BlobStore("File not found".to_string());
        assert_eq!(error.to_string(), "Blob store error: File not found");
    }

    #[test]
    fn test_generic_error() {
        let error = AppError::Generic("Something went wrong".to_string());
        assert_eq!(error.to_string(), "Something went wrong");
    }

    #[test]
    fn test_error_serialization() {
        let error = AppError::NoteNotFound("abc".to_string());
        let serialized = serde_json::to_string(&error).unwrap();
        assert_eq!(serialized, "\"Note not found: abc\"");
    }

    #[test]
    fn test_error_debug_format() {
        let error = AppError::Generic("test".to_string());
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("Generic"));
        assert!(debug_str.contains("test"));
    }

    #[test]
    fn test_io_error_conversion() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let app_error: AppError = io_error.into();
        assert!(app_error.to_string().contains("IO error"));
    }

    #[test]
    fn test_serialization_error_conversion() {
        // Create a JSON parsing error
        let json_result: serde_json::Result<i32> = serde_json::from_str("not valid json");
        if let Err(json_error) = json_result {
            let app_error: AppError = json_error.into();
            assert!(app_error.to_string().contains("Serialization error"));
        }
    }

    #[test]
    fn test_result_type_alias() {
        fn example_function() -> Result<i32> {
            Ok(42)
        }

        fn example_error_function() -> Result<i32> {
            Err(AppError::Generic("error".to_string()))
        }

        assert_eq!(example_function().unwrap(), 42);
        assert!(example_error_function().is_err());
    }

    #[test]
    fn test_error_message_formatting() {
        // Test that error messages with special characters are handled
        let special_chars = "Error with <special> & \"characters\"";
        let error = AppError::Generic(special_chars.to_string());
        assert_eq!(error.to_string(), special_chars);
    }

    #[test]
    fn test_error_json_escaping() {
        // Ensure special characters in errors are properly escaped in JSON
        let error = AppError::Generic("Error with \"quotes\" and \\backslash".to_string());
        let serialized = serde_json::to_string(&error).unwrap();
        // Should be properly escaped
        assert!(serialized.contains("\\\"quotes\\\""));
        assert!(serialized.contains("\\\\backslash"));
    }
}

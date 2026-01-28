/// Credential Manager Service
/// Secure storage for backup passwords using Windows Credential Manager
use crate::error::{AppError, Result};
use keyring::Entry;

const SERVICE_NAME: &str = "SwatNotes";
const AUTO_BACKUP_PASSWORD_KEY: &str = "auto_backup_password";

/// Credential manager for secure password storage
pub struct CredentialManager;

impl CredentialManager {
    /// Store auto-backup password securely in OS credential store
    pub fn store_auto_backup_password(password: &str) -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, AUTO_BACKUP_PASSWORD_KEY)
            .map_err(|e| AppError::Backup(format!("Failed to create keyring entry: {}", e)))?;

        entry
            .set_password(password)
            .map_err(|e| AppError::Backup(format!("Failed to store password: {}", e)))?;

        tracing::info!("Auto-backup password stored in credential manager");
        Ok(())
    }

    /// Retrieve auto-backup password from OS credential store
    pub fn get_auto_backup_password() -> Result<String> {
        let entry = Entry::new(SERVICE_NAME, AUTO_BACKUP_PASSWORD_KEY)
            .map_err(|e| AppError::Backup(format!("Failed to create keyring entry: {}", e)))?;

        entry
            .get_password()
            .map_err(|e| AppError::Backup(format!("Failed to retrieve password: {}", e)))
    }

    /// Delete auto-backup password from OS credential store
    pub fn delete_auto_backup_password() -> Result<()> {
        let entry = Entry::new(SERVICE_NAME, AUTO_BACKUP_PASSWORD_KEY)
            .map_err(|e| AppError::Backup(format!("Failed to create keyring entry: {}", e)))?;

        entry
            .delete_credential()
            .map_err(|e| AppError::Backup(format!("Failed to delete password: {}", e)))?;

        tracing::info!("Auto-backup password deleted from credential manager");
        Ok(())
    }

    /// Check if auto-backup password is stored
    pub fn has_auto_backup_password() -> bool {
        Entry::new(SERVICE_NAME, AUTO_BACKUP_PASSWORD_KEY)
            .and_then(|entry| entry.get_password())
            .is_ok()
    }
}

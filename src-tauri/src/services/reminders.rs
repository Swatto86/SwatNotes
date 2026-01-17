//! Reminders service
//!
//! Manages reminder scheduling and notifications.
//! Runs background task that checks for due reminders every minute.

use crate::database::{Reminder, Repository};
use crate::error::Result;
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Reminders service with background scheduler
#[derive(Clone)]
pub struct RemindersService {
    repo: Repository,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl RemindersService {
    pub fn new(repo: Repository) -> Self {
        Self {
            repo,
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    /// Set the app handle for notifications
    pub async fn set_app_handle(&self, handle: AppHandle) {
        let mut app = self.app_handle.lock().await;
        *app = Some(handle);
    }

    /// Create a new reminder
    pub async fn create_reminder(
        &self,
        note_id: &str,
        trigger_time: DateTime<Utc>,
    ) -> Result<Reminder> {
        tracing::info!("Creating reminder for note {} at {}", note_id, trigger_time);
        self.repo.create_reminder(note_id, trigger_time).await
    }

    /// List all active (not yet triggered) reminders
    pub async fn list_active_reminders(&self) -> Result<Vec<Reminder>> {
        self.repo.list_active_reminders().await
    }

    /// Start the background scheduler
    pub fn start_scheduler(self) {
        tokio::spawn(async move {
            tracing::info!("Starting reminders scheduler");

            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));

            loop {
                interval.tick().await;

                if let Err(e) = self.check_and_trigger_reminders().await {
                    tracing::error!("Error checking reminders: {}", e);
                }
            }
        });
    }

    /// Check for due reminders and trigger them
    async fn check_and_trigger_reminders(&self) -> Result<()> {
        let reminders = self.list_active_reminders().await?;
        let now = Utc::now();

        for reminder in reminders {
            // trigger_time is already DateTime<Utc>
            if reminder.trigger_time <= now {
                tracing::info!("Triggering reminder {} for note {}", reminder.id, reminder.note_id);

                // Mark as triggered in database
                self.repo.mark_reminder_triggered(&reminder.id).await?;

                // Send notification
                self.send_notification(&reminder).await;
            }
        }

        Ok(())
    }

    /// Send notification for a reminder
    async fn send_notification(&self, reminder: &Reminder) {
        let app_handle = self.app_handle.lock().await;

        if let Some(handle) = app_handle.as_ref() {
            // Get note title for notification
            let note = match self.repo.get_note(&reminder.note_id).await {
                Ok(note) => note,
                Err(e) => {
                    tracing::error!("Failed to get note for reminder: {}", e);
                    return;
                }
            };

            // Send system notification
            use tauri_plugin_notification::NotificationExt;
            if let Err(e) = handle
                .notification()
                .builder()
                .title("QuickNotes Reminder")
                .body(format!("Reminder: {}", note.title))
                .show()
            {
                tracing::error!("Failed to send notification: {}", e);
            }

            // Emit event to frontend for UI handling
            if let Err(e) = handle.emit("reminder-triggered", ReminderEvent {
                reminder_id: reminder.id.clone(),
                note_id: reminder.note_id.clone(),
                note_title: note.title.clone(),
            }) {
                tracing::error!("Failed to emit reminder event: {}", e);
            }

            tracing::info!("Notification sent for reminder {}", reminder.id);
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
struct ReminderEvent {
    reminder_id: String,
    note_id: String,
    note_title: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{create_pool, initialize_database, CreateNoteRequest, Repository};
    use chrono::Duration;
    use sqlx::sqlite::SqlitePoolOptions;
    use tempfile::TempDir;

    async fn create_test_service() -> (RemindersService, Repository, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let app_data_dir = temp_dir.path().to_path_buf();

        let pool = SqlitePoolOptions::new()
            .connect(&format!("sqlite://{}/db.sqlite", app_data_dir.display()))
            .await
            .unwrap();

        initialize_database(&pool).await.unwrap();
        let repo = Repository::new(pool);

        let service = RemindersService::new(repo.clone());

        (service, repo, temp_dir)
    }

    #[tokio::test]
    async fn test_create_reminder() {
        let (service, repo, _temp) = create_test_service().await;

        // Create a note first
        let note = repo
            .create_note(CreateNoteRequest {
                title: "Test Note".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Create reminder for 1 hour from now
        let trigger_time = Utc::now() + Duration::hours(1);
        let reminder = service
            .create_reminder(&note.id, trigger_time)
            .await
            .unwrap();

        assert_eq!(reminder.note_id, note.id);
        assert_eq!(reminder.triggered, 0);
    }

    #[tokio::test]
    async fn test_list_active_reminders() {
        let (service, repo, _temp) = create_test_service().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Test Note".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Create two reminders
        let trigger1 = Utc::now() + Duration::hours(1);
        let trigger2 = Utc::now() + Duration::hours(2);

        service.create_reminder(&note.id, trigger1).await.unwrap();
        service.create_reminder(&note.id, trigger2).await.unwrap();

        let reminders = service.list_active_reminders().await.unwrap();
        assert_eq!(reminders.len(), 2);
    }

    #[tokio::test]
    async fn test_check_and_trigger_past_reminders() {
        let (service, repo, _temp) = create_test_service().await;

        let note = repo
            .create_note(CreateNoteRequest {
                title: "Test Note".to_string(),
                content_json: "{}".to_string(),
            })
            .await
            .unwrap();

        // Create reminder in the past
        let trigger_time = Utc::now() - Duration::minutes(5);
        let reminder = service
            .create_reminder(&note.id, trigger_time)
            .await
            .unwrap();

        // Check and trigger
        service.check_and_trigger_reminders().await.unwrap();

        // Verify it was marked as triggered
        let reminders = service.list_active_reminders().await.unwrap();
        assert_eq!(reminders.len(), 0); // Should be empty now
    }
}

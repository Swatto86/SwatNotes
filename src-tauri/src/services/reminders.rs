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
        tracing::info!("Setting app handle for reminders service");
        let mut app = self.app_handle.lock().await;
        *app = Some(handle);
        tracing::info!("App handle set successfully");
    }

    /// Create a new reminder
    pub async fn create_reminder(
        &self,
        note_id: &str,
        trigger_time: DateTime<Utc>,
        sound_enabled: Option<bool>,
        sound_type: Option<String>,
        shake_enabled: Option<bool>,
        glow_enabled: Option<bool>,
    ) -> Result<Reminder> {
        tracing::info!("Creating reminder for note {} at {}", note_id, trigger_time);
        self.repo
            .create_reminder(
                note_id,
                trigger_time,
                sound_enabled,
                sound_type,
                shake_enabled,
                glow_enabled,
            )
            .await
    }

    /// List all active (not yet triggered) reminders
    pub async fn list_active_reminders(&self) -> Result<Vec<Reminder>> {
        self.repo.list_active_reminders().await
    }

    /// Delete a reminder
    pub async fn delete_reminder(&self, id: &str) -> Result<()> {
        tracing::info!("Deleting reminder: {}", id);
        self.repo.delete_reminder(id).await
    }

    /// Start the background scheduler
    pub fn start_scheduler(self) {
        tokio::spawn(async move {
            tracing::info!("Starting reminders scheduler loop");

            // Check every 5 seconds for reminders (ensures accurate timing within a few seconds)
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));

            // First tick happens immediately, so consume it
            interval.tick().await;
            tracing::info!("Reminders scheduler: initial tick consumed, starting loop");

            let mut iteration = 0u64;
            loop {
                iteration += 1;
                tracing::debug!(
                    "Reminders scheduler: iteration {} - waiting for tick",
                    iteration
                );

                interval.tick().await;

                tracing::debug!(
                    "Reminders scheduler: iteration {} - tick received, checking reminders",
                    iteration
                );

                match self.check_and_trigger_reminders().await {
                    Ok(_) => {
                        tracing::debug!(
                            "Reminders scheduler: iteration {} - check complete successfully",
                            iteration
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            "Reminders scheduler: iteration {} - error during check: {}",
                            iteration,
                            e
                        );
                        // Continue loop even on error
                    }
                }

                tracing::debug!(
                    "Reminders scheduler: iteration {} - continuing to next tick",
                    iteration
                );
            }
        });

        tracing::info!("Reminders scheduler task spawned successfully");
    }

    /// Check for due reminders and trigger them
    async fn check_and_trigger_reminders(&self) -> Result<()> {
        let reminders = self.list_active_reminders().await?;
        let now = Utc::now();

        if !reminders.is_empty() {
            tracing::debug!("Checking {} active reminders at {}", reminders.len(), now);
        }

        for reminder in reminders {
            tracing::debug!(
                "Reminder {} scheduled for {} (now: {})",
                reminder.id,
                reminder.trigger_time,
                now
            );

            // trigger_time is already DateTime<Utc>
            if reminder.trigger_time <= now {
                tracing::info!(
                    "Triggering reminder {} for note {}",
                    reminder.id,
                    reminder.note_id
                );

                // Mark as triggered in database
                self.repo.mark_reminder_triggered(&reminder.id).await?;

                // Send notification
                self.send_notification(&reminder).await;
            }
        }

        Ok(())
    }

    /// Send notification for a reminder
    /// Shows the note window centered on screen with visual effects (no system notification)
    async fn send_notification(&self, reminder: &Reminder) {
        tracing::info!("send_notification: Starting for reminder {}", reminder.id);

        let app_handle_guard = self.app_handle.lock().await;
        let handle = match app_handle_guard.as_ref() {
            Some(h) => h.clone(),
            None => {
                tracing::error!("send_notification: App handle not set");
                return;
            }
        };
        // Release lock immediately
        drop(app_handle_guard);

        tracing::info!("send_notification: Got app handle, fetching note");

        // Get note title for notification
        let note = match self.repo.get_note(&reminder.note_id).await {
            Ok(note) => note,
            Err(e) => {
                tracing::error!("send_notification: Failed to get note for reminder: {}", e);
                return;
            }
        };

        tracing::info!("send_notification: Got note, handling window (no system notification)");

        // Handle window in separate task to avoid blocking
        let window_label = format!("note-{}", reminder.note_id);
        let handle_clone = handle.clone();
        let note_title = note.title.clone();
        let window_label_clone = window_label.clone();
        let note_id_clone = reminder.note_id.clone();
        let reminder_id_clone = reminder.id.clone();
        // Clone per-reminder settings to pass to the event
        let sound_enabled = reminder.sound_enabled;
        let sound_type = reminder.sound_type.clone();
        let shake_enabled = reminder.shake_enabled;
        let glow_enabled = reminder.glow_enabled;

        tauri::async_runtime::spawn(async move {
            use tauri::Manager;
            use tauri::WebviewUrl;
            use tauri::WebviewWindowBuilder;

            tracing::info!(
                "Window task: Checking if window exists: {}",
                window_label_clone
            );

            // Helper function to center window on primary monitor without focusing
            let center_window_on_screen =
                |window: &tauri::WebviewWindow, app_handle: &tauri::AppHandle| {
                    // Use primary monitor, falling back to any available monitor
                    let monitor = app_handle.primary_monitor().ok().flatten().or_else(|| {
                        app_handle
                            .available_monitors()
                            .ok()
                            .and_then(|m| m.into_iter().next())
                    });

                    if let Some(monitor) = monitor {
                        let monitor_size = monitor.size();
                        let monitor_position = monitor.position();

                        if let Ok(window_size) = window.outer_size() {
                            let x = monitor_position.x
                                + ((monitor_size.width as i32 - window_size.width as i32) / 2);
                            let y = monitor_position.y
                                + ((monitor_size.height as i32 - window_size.height as i32) / 2);

                            if let Err(e) = window.set_position(tauri::Position::Physical(
                                tauri::PhysicalPosition::new(x, y),
                            )) {
                                tracing::error!("Failed to center window: {}", e);
                            } else {
                                tracing::info!(
                                    "Window centered at ({}, {}) on primary monitor",
                                    x,
                                    y
                                );
                            }
                        }
                    } else {
                        tracing::warn!("No monitor found to center window on");
                    }
                };

            // Create reminder event data upfront
            let reminder_event = ReminderEvent {
                reminder_id: reminder_id_clone.clone(),
                note_id: note_id_clone.clone(),
                note_title: note_title.clone(),
                sound_enabled,
                sound_type,
                shake_enabled,
                glow_enabled,
            };

            // Check if window already exists
            let window_found = if let Some(window) =
                handle_clone.get_webview_window(&window_label_clone)
            {
                match window.is_visible() {
                    Ok(_) => {
                        tracing::info!("Window task: Window exists and is valid, showing it above other windows (no focus)");
                        let _ = window.unminimize();
                        let _ = window.show();

                        // Center on primary monitor
                        center_window_on_screen(&window, &handle_clone);

                        // Set always on top without focusing
                        let _ = window.set_always_on_top(true);

                        // Wait for window to be fully visible, then emit event
                        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                        if let Err(e) =
                            handle_clone.emit("reminder-triggered", reminder_event.clone())
                        {
                            tracing::error!("Failed to emit reminder-triggered event: {}", e);
                        } else {
                            tracing::info!("reminder-triggered event emitted successfully");
                        }

                        true
                    }
                    Err(_) => {
                        tracing::info!("Window task: Window exists but is invalid");
                        false
                    }
                }
            } else {
                tracing::info!("Window task: Window not found in registry");
                false
            };

            // Create window if it doesn't exist
            if !window_found {
                tracing::info!(
                    "Window task: Creating new window for note {}",
                    note_id_clone
                );
                match WebviewWindowBuilder::new(
                    &handle_clone,
                    &window_label_clone,
                    WebviewUrl::App("pages/sticky-note.html".into()),
                )
                .title(&note_title)
                .inner_size(400.0, 500.0)
                .min_inner_size(300.0, 400.0)
                .resizable(true)
                .decorations(true)
                .always_on_top(true) // Start on top
                .skip_taskbar(false)
                .visible(false) // Will be shown by frontend after loading
                .focused(false) // Don't focus when created
                .build()
                {
                    Ok(window) => {
                        tracing::info!("Window task: New window created successfully");

                        // Center on primary monitor and emit event after window initializes
                        let window_clone = window.clone();
                        let handle_for_event = handle_clone.clone();
                        let event_for_spawn = reminder_event.clone();
                        tauri::async_runtime::spawn(async move {
                            // Wait for window to fully initialize
                            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                            center_window_on_screen(&window_clone, &handle_for_event);
                            // Emit event after window is ready
                            if let Err(e) =
                                handle_for_event.emit("reminder-triggered", event_for_spawn)
                            {
                                tracing::error!("Failed to emit reminder-triggered event: {}", e);
                            } else {
                                tracing::info!("reminder-triggered event emitted successfully");
                            }
                        });
                    }
                    Err(e) => {
                        tracing::error!("Window task: Failed to create window: {}", e);
                    }
                }
            }
        });

        tracing::info!("send_notification: Complete for reminder {}", reminder.id);
    }
}

#[derive(Debug, Clone, serde::Serialize)]
struct ReminderEvent {
    reminder_id: String,
    note_id: String,
    note_title: String,
    /// Per-reminder sound setting (None = use global default)
    sound_enabled: Option<bool>,
    /// Per-reminder sound type (None = use global default)
    sound_type: Option<String>,
    /// Per-reminder shake animation setting (None = use global default)
    shake_enabled: Option<bool>,
    /// Per-reminder glow effect setting (None = use global default)
    glow_enabled: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{initialize_database, CreateNoteRequest, Repository};
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
            .create_reminder(&note.id, trigger_time, None, None, None, None)
            .await
            .unwrap();

        assert_eq!(reminder.note_id, note.id);
        assert_eq!(reminder.triggered, false);
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

        service
            .create_reminder(&note.id, trigger1, None, None, None, None)
            .await
            .unwrap();
        service
            .create_reminder(&note.id, trigger2, None, None, None, None)
            .await
            .unwrap();

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
        let _reminder = service
            .create_reminder(&note.id, trigger_time, None, None, None, None)
            .await
            .unwrap();

        // Check and trigger
        service.check_and_trigger_reminders().await.unwrap();

        // Verify it was marked as triggered
        let reminders = service.list_active_reminders().await.unwrap();
        assert_eq!(reminders.len(), 0); // Should be empty now
    }
}

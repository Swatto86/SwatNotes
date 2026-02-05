//! Reminder-related commands
//!
//! CRUD operations for note reminders.

use crate::app::AppState;
use crate::database::Reminder;
use crate::error::{AppError, Result};
use tauri::State;

/// Create a new reminder for a note
#[tauri::command]
pub async fn create_reminder(
    state: State<'_, AppState>,
    note_id: String,
    trigger_time: String,
    sound_enabled: Option<bool>,
    sound_type: Option<String>,
    shake_enabled: Option<bool>,
    glow_enabled: Option<bool>,
) -> Result<Reminder> {
    use chrono::DateTime;

    let trigger_dt = DateTime::parse_from_rfc3339(&trigger_time)
        .map_err(|e| AppError::Generic(format!("Invalid datetime: {}", e)))?
        .with_timezone(&chrono::Utc);

    state
        .reminders_service
        .create_reminder(
            &note_id,
            trigger_dt,
            sound_enabled,
            sound_type,
            shake_enabled,
            glow_enabled,
        )
        .await
}

/// List all active (non-triggered) reminders
#[tauri::command]
pub async fn list_active_reminders(state: State<'_, AppState>) -> Result<Vec<Reminder>> {
    state.reminders_service.list_active_reminders().await
}

/// Delete a reminder
#[tauri::command]
pub async fn delete_reminder(state: State<'_, AppState>, id: String) -> Result<()> {
    state.reminders_service.delete_reminder(&id).await
}

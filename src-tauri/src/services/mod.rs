//! Services module
//!
//! Business logic services that coordinate between commands and repository.

pub mod attachments;
pub mod backup;
pub mod credentials;
pub mod notes;
pub mod reminders;
pub mod scheduler;
pub mod settings;

pub use attachments::AttachmentsService;
pub use backup::BackupService;
pub use credentials::CredentialManager;
pub use notes::NotesService;
pub use reminders::RemindersService;
pub use scheduler::SchedulerService;
pub use settings::{
    AutoBackupSettings, BehaviorSettings, HotkeySettings, ReminderSettings, SettingsService,
};

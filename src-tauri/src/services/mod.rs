//! Services module
//!
//! Business logic services that coordinate between commands and repository.

pub mod attachments;
pub mod notes;

pub use attachments::AttachmentsService;
pub use notes::NotesService;

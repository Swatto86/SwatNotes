//! SwatNotes library
//!
//! This library exposes the core functionality of SwatNotes for testing
//! and potential future library use.

pub mod app;
pub mod commands;
pub mod config;
pub mod crypto;
pub mod database;
pub mod error;
#[cfg(target_os = "windows")]
pub mod platform;
pub mod services;
pub mod storage;

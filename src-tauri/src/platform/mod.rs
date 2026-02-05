//! Platform-specific functionality
//!
//! This module contains platform-specific implementations for features
//! that require direct OS API access.

#[cfg(target_os = "windows")]
pub mod registry;

#[cfg(target_os = "windows")]
pub use registry::*;

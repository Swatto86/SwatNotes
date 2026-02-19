//! Windows Registry operations
//!
//! Provides safe wrappers around Windows Registry APIs for managing
//! autostart and other registry-based configuration.

use std::ffi::OsStr;
use std::iter;
use std::os::windows::ffi::OsStrExt;

use windows::core::PCWSTR;
use windows::Win32::Foundation::{
    ERROR_FILE_NOT_FOUND, ERROR_MORE_DATA, ERROR_PATH_NOT_FOUND, ERROR_SUCCESS,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegDeleteKeyW, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY, HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE, KEY_WRITE, REG_SZ,
};

/// Registry key path for Windows Run (autostart) entries
pub const REGISTRY_RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";

/// Application name used for registry entries
pub const APP_NAME: &str = "SwatNotes";

/// Convert a Rust string to a null-terminated UTF-16 wide string for Win32 APIs
fn to_wide(input: &str) -> Vec<u16> {
    OsStr::new(input)
        .encode_wide()
        .chain(iter::once(0))
        .collect()
}

/// Safe wrapper around Windows Registry operations
pub struct WindowsRegistry;

impl WindowsRegistry {
    /// Check if a registry value exists under HKEY_CURRENT_USER
    ///
    /// # Arguments
    /// * `key_path` - The registry key path (e.g., "Software\\Microsoft\\Windows\\CurrentVersion\\Run")
    /// * `value_name` - The name of the value to check
    ///
    /// # Returns
    /// * `Ok(true)` if the value exists
    /// * `Ok(false)` if the value or key doesn't exist
    /// * `Err(String)` on other errors
    pub fn value_exists(key_path: &str, value_name: &str) -> Result<bool, String> {
        let key_path_wide = to_wide(key_path);
        let value_name_wide = to_wide(value_name);
        let mut key_handle: HKEY = HKEY::default();

        // SAFETY:
        // - key_path_wide is a valid null-terminated UTF-16 buffer that outlives this call
        // - key_handle is a valid pointer to receive the opened key
        // - We use KEY_READ for read-only access
        let open_result = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR::from_raw(key_path_wide.as_ptr()),
                0,
                KEY_READ,
                &mut key_handle,
            )
        };

        if open_result != ERROR_SUCCESS {
            if open_result == ERROR_FILE_NOT_FOUND || open_result == ERROR_PATH_NOT_FOUND {
                return Ok(false);
            }
            return Err(format!(
                "Failed to open registry key: error code {}",
                open_result.0
            ));
        }

        // Query the value size to check if it exists (pass null buffer)
        // SAFETY:
        // - value_name_wide is a valid null-terminated UTF-16 buffer
        // - We pass None for data buffer to just query existence/size
        // - key_handle is valid from the successful RegOpenKeyExW call
        let query_result = unsafe {
            RegQueryValueExW(
                key_handle,
                PCWSTR::from_raw(value_name_wide.as_ptr()),
                None, // reserved, must be None
                None, // type output (not needed)
                None, // data buffer (null to query size)
                None, // data size (null since we just check existence)
            )
        };

        // SAFETY: key_handle was opened successfully and must be closed
        let _ = unsafe { RegCloseKey(key_handle) };

        // ERROR_SUCCESS means value exists, ERROR_MORE_DATA means value exists but buffer too small
        if query_result == ERROR_SUCCESS || query_result == ERROR_MORE_DATA {
            Ok(true)
        } else if query_result == ERROR_FILE_NOT_FOUND {
            Ok(false)
        } else {
            Err(format!(
                "Failed to query registry value: error code {}",
                query_result.0
            ))
        }
    }

    /// Write a REG_SZ string value to the registry under HKEY_CURRENT_USER
    ///
    /// Opens the key (which must already exist) and writes the value.
    ///
    /// # Arguments
    /// * `key_path` - The registry key path
    /// * `value_name` - The name of the value to write
    /// * `value` - The string value to write
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(String)` on failure
    pub fn write_string(key_path: &str, value_name: &str, value: &str) -> Result<(), String> {
        let key_path_wide = to_wide(key_path);
        let value_name_wide = to_wide(value_name);
        let value_wide = to_wide(value);
        let mut key_handle: HKEY = HKEY::default();

        // SAFETY:
        // - key_path_wide is a valid null-terminated UTF-16 buffer
        // - key_handle receives the opened key
        // - We use KEY_WRITE for write access
        let open_result = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR::from_raw(key_path_wide.as_ptr()),
                0,
                KEY_WRITE,
                &mut key_handle,
            )
        };

        if open_result != ERROR_SUCCESS {
            return Err(format!(
                "Failed to open registry key: error code {}",
                open_result.0
            ));
        }

        // Calculate byte size including null terminator
        let data_bytes: &[u8] = unsafe {
            std::slice::from_raw_parts(
                value_wide.as_ptr() as *const u8,
                value_wide.len() * 2, // UTF-16 = 2 bytes per character
            )
        };

        // SAFETY:
        // - key_handle is valid from successful RegOpenKeyExW
        // - value_name_wide is a valid null-terminated UTF-16 buffer
        // - data_bytes is valid for the specified length
        let set_result = unsafe {
            RegSetValueExW(
                key_handle,
                PCWSTR::from_raw(value_name_wide.as_ptr()),
                0,      // reserved
                REG_SZ, // string type
                Some(data_bytes),
            )
        };

        // SAFETY: key_handle was opened successfully and must be closed
        let _ = unsafe { RegCloseKey(key_handle) };

        if set_result == ERROR_SUCCESS {
            Ok(())
        } else {
            Err(format!(
                "Failed to set registry value: error code {}",
                set_result.0
            ))
        }
    }

    /// Delete a registry value under HKEY_CURRENT_USER
    ///
    /// Treats missing key or value as success (idempotent delete).
    ///
    /// # Arguments
    /// * `key_path` - The registry key path
    /// * `value_name` - The name of the value to delete
    ///
    /// # Returns
    /// * `Ok(())` on success or if value/key doesn't exist
    /// * `Err(String)` on other errors
    pub fn delete_value(key_path: &str, value_name: &str) -> Result<(), String> {
        let key_path_wide = to_wide(key_path);
        let value_name_wide = to_wide(value_name);
        let mut key_handle: HKEY = HKEY::default();

        // SAFETY:
        // - key_path_wide is a valid null-terminated UTF-16 buffer
        // - key_handle receives the opened key
        // - KEY_SET_VALUE is required for RegDeleteValueW
        let open_result = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR::from_raw(key_path_wide.as_ptr()),
                0,
                KEY_SET_VALUE,
                &mut key_handle,
            )
        };

        if open_result != ERROR_SUCCESS {
            // Key doesn't exist = value doesn't exist = success
            if open_result == ERROR_FILE_NOT_FOUND || open_result == ERROR_PATH_NOT_FOUND {
                return Ok(());
            }
            return Err(format!(
                "Failed to open registry key: error code {}",
                open_result.0
            ));
        }

        // SAFETY:
        // - key_handle is valid from successful RegOpenKeyExW
        // - value_name_wide is a valid null-terminated UTF-16 buffer
        let delete_result =
            unsafe { RegDeleteValueW(key_handle, PCWSTR::from_raw(value_name_wide.as_ptr())) };

        // SAFETY: key_handle was opened successfully and must be closed
        let _ = unsafe { RegCloseKey(key_handle) };

        if delete_result == ERROR_SUCCESS || delete_result == ERROR_FILE_NOT_FOUND {
            Ok(())
        } else {
            Err(format!(
                "Failed to delete registry value: error code {}",
                delete_result.0
            ))
        }
    }

    /// Delete an entire registry key
    ///
    /// Used primarily for test cleanup.
    ///
    /// # Arguments
    /// * `key_path` - The registry key path to delete
    ///
    /// # Returns
    /// * `Ok(())` on success or if key doesn't exist
    /// * `Err(String)` on other errors
    #[allow(dead_code)]
    pub fn delete_key(key_path: &str) -> Result<(), String> {
        let key_path_wide = to_wide(key_path);

        // SAFETY:
        // - key_path_wide is a valid null-terminated UTF-16 buffer
        // - RegDeleteKeyW deletes the specified key (must have no subkeys)
        let result =
            unsafe { RegDeleteKeyW(HKEY_CURRENT_USER, PCWSTR::from_raw(key_path_wide.as_ptr())) };

        if result == ERROR_SUCCESS
            || result == ERROR_FILE_NOT_FOUND
            || result == ERROR_PATH_NOT_FOUND
        {
            Ok(())
        } else {
            Err(format!(
                "Failed to delete registry key: error code {}",
                result.0
            ))
        }
    }
}

// ===== Autostart Functions =====

/// Check if autostart is enabled for this application
///
/// Checks if a value with the app name exists under
/// HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
///
/// # Returns
/// * `Ok(true)` if autostart is enabled
/// * `Ok(false)` if autostart is disabled
/// * `Err(String)` on registry access errors
pub fn check_autostart_state() -> Result<bool, String> {
    WindowsRegistry::value_exists(REGISTRY_RUN_KEY, APP_NAME)
}

/// Enable autostart for this application
///
/// Writes the current executable path to the registry Run key.
///
/// # Returns
/// * `Ok(())` on success
/// * `Err(String)` on failure
pub fn enable_autostart() -> Result<(), String> {
    let exe_path =
        std::env::current_exe().map_err(|e| format!("Failed to get executable path: {}", e))?;

    // Quote the path to handle spaces
    let exe_path_quoted = format!("\"{}\"", exe_path.display());

    WindowsRegistry::write_string(REGISTRY_RUN_KEY, APP_NAME, &exe_path_quoted)?;

    tracing::info!(
        "Autostart enabled for {} at {}",
        APP_NAME,
        exe_path.display()
    );
    Ok(())
}

/// Disable autostart for this application
///
/// Removes the app's value from the registry Run key.
///
/// # Returns
/// * `Ok(())` on success (including if already disabled)
/// * `Err(String)` on registry access errors
pub fn disable_autostart() -> Result<(), String> {
    WindowsRegistry::delete_value(REGISTRY_RUN_KEY, APP_NAME)?;

    tracing::info!("Autostart disabled for {}", APP_NAME);
    Ok(())
}

/// Toggle autostart state
///
/// Enables autostart if currently disabled, or disables if currently enabled.
///
/// # Returns
/// * `Ok(true)` if autostart is now enabled
/// * `Ok(false)` if autostart is now disabled
/// * `Err(String)` on registry access errors
pub fn toggle_autostart() -> Result<bool, String> {
    let is_enabled = check_autostart_state()?;

    if is_enabled {
        disable_autostart()?;
        Ok(false)
    } else {
        enable_autostart()?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_VALUE_NAME: &str = "SwatNotes_Test_Value_Delete_Me";

    #[test]
    fn test_registry_roundtrip() {
        // Use the Run key which always exists on Windows
        // Write a test value
        let result = WindowsRegistry::write_string(REGISTRY_RUN_KEY, TEST_VALUE_NAME, "test_data");
        assert!(result.is_ok(), "Failed to write: {:?}", result);

        // Verify it exists
        let exists = WindowsRegistry::value_exists(REGISTRY_RUN_KEY, TEST_VALUE_NAME);
        assert!(exists.is_ok(), "Failed to check existence: {:?}", exists);
        assert!(exists.unwrap(), "Value should exist after writing");

        // Delete it
        let delete_result = WindowsRegistry::delete_value(REGISTRY_RUN_KEY, TEST_VALUE_NAME);
        assert!(
            delete_result.is_ok(),
            "Failed to delete: {:?}",
            delete_result
        );

        // Verify it's gone
        let exists_after = WindowsRegistry::value_exists(REGISTRY_RUN_KEY, TEST_VALUE_NAME);
        assert!(
            exists_after.is_ok(),
            "Failed to check existence after delete: {:?}",
            exists_after
        );
        assert!(
            !exists_after.unwrap(),
            "Value should not exist after deletion"
        );
    }

    #[test]
    fn test_value_exists_nonexistent() {
        let result =
            WindowsRegistry::value_exists("Software\\SwatNotes\\NonExistent", "NonExistentValue");
        assert!(result.is_ok(), "Should not error for nonexistent key");
        assert!(
            !result.unwrap(),
            "Should return false for nonexistent value"
        );
    }

    #[test]
    fn test_delete_nonexistent_value() {
        // Deleting a nonexistent value should succeed (idempotent)
        let result =
            WindowsRegistry::delete_value("Software\\SwatNotes\\NonExistent", "NonExistentValue");
        assert!(result.is_ok(), "Deleting nonexistent value should succeed");
    }

    #[test]
    fn test_autostart_functions() {
        // This test modifies the actual Run key, so we save and restore state
        let initial_state = check_autostart_state().unwrap_or(false);

        // Ensure disabled state
        let _ = disable_autostart();
        assert!(!check_autostart_state().unwrap(), "Should be disabled");

        // Enable
        let enable_result = enable_autostart();
        assert!(
            enable_result.is_ok(),
            "Failed to enable autostart: {:?}",
            enable_result
        );
        assert!(
            check_autostart_state().unwrap(),
            "Should be enabled after enable_autostart"
        );

        // Toggle off
        let toggle_result = toggle_autostart();
        assert!(
            toggle_result.is_ok(),
            "Failed to toggle autostart: {:?}",
            toggle_result
        );
        assert!(
            !toggle_result.unwrap(),
            "Toggle should return false (now disabled)"
        );
        assert!(
            !check_autostart_state().unwrap(),
            "Should be disabled after toggle"
        );

        // Toggle on
        let toggle_on = toggle_autostart();
        assert!(
            toggle_on.is_ok(),
            "Failed to toggle autostart on: {:?}",
            toggle_on
        );
        assert!(
            toggle_on.unwrap(),
            "Toggle should return true (now enabled)"
        );

        // Restore initial state
        if initial_state {
            let _ = enable_autostart();
        } else {
            let _ = disable_autostart();
        }
    }
}

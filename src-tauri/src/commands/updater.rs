//! Auto-update commands for SwatNotes
//!
//! Provides functionality to check for, download, and install application updates
//! using the GitHub API for the public SwatNotes repository.
//!
//! RELEASE NOTES FLOW:
//! 1. Release script creates annotated Git tag with user's notes
//! 2. GitHub Actions extracts tag message and publishes it in the GitHub Release
//! 3. This module fetches the release body from GitHub API (no auth needed for public repos)
//! 4. The frontend displays the notes in the update window

use crate::error::Result;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::AppHandle;

/// GitHub release information from the API
#[derive(Deserialize, Debug)]
struct GitHubRelease {
    tag_name: String,
    body: Option<String>,
    html_url: Option<String>,
    #[serde(default)]
    assets: Vec<GitHubAsset>,
}

/// GitHub release asset
#[derive(Deserialize, Debug)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

/// Information about an available update
#[derive(Serialize)]
pub struct UpdateInfo {
    /// Whether an update is available
    pub available: bool,
    /// The version of the available update (if any)
    pub version: Option<String>,
    /// Release notes/changelog for the update
    pub body: Option<String>,
    /// Current application version
    pub current_version: String,
    /// URL to the release page
    pub release_url: Option<String>,
    /// URL to the installer asset (if available)
    pub installer_url: Option<String>,
}

/// Compare version strings (semver format: x.y.z)
fn is_newer_version(current: &str, remote: &str) -> bool {
    let parse_version = |v: &str| -> Vec<u32> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect()
    };

    let current_parts = parse_version(current);
    let remote_parts = parse_version(remote);

    for i in 0..3 {
        let c = current_parts.get(i).copied().unwrap_or(0);
        let r = remote_parts.get(i).copied().unwrap_or(0);
        if r > c {
            return true;
        }
        if r < c {
            return false;
        }
    }
    false
}

/// Get the latest release from the GitHub API
/// No authentication required since the repository is public
async fn fetch_latest_release() -> Option<GitHubRelease> {
    tracing::info!("Checking for updates via GitHub API (public repository)...");

    let github_api_url = "https://api.github.com/repos/Swatto86/SwatNotes/releases/latest";

    let client = match reqwest::Client::builder()
        .user_agent("SwatNotes-Updater")
        .build()
    {
        Ok(client) => client,
        Err(e) => {
            tracing::warn!("Failed to create HTTP client: {}", e);
            return None;
        }
    };

    let response = match client.get(github_api_url).send().await {
        Ok(response) => response,
        Err(e) => {
            tracing::warn!("Failed to fetch from GitHub API: {}", e);
            return None;
        }
    };

    let status = response.status();
    if !status.is_success() {
        if status.as_u16() == 404 {
            tracing::info!("GitHub API returned 404 - no releases found");
        } else {
            tracing::warn!("GitHub API returned status: {}", status);
        }
        return None;
    }

    match response.json().await {
        Ok(release) => Some(release),
        Err(e) => {
            tracing::warn!("Failed to parse GitHub API response: {}", e);
            None
        }
    }
}

/// Check for available updates via the GitHub API.
#[tauri::command]
pub async fn check_for_update(_app: AppHandle) -> Result<UpdateInfo> {
    tracing::info!("Checking for updates...");

    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let releases_url = "https://github.com/Swatto86/SwatNotes/releases".to_string();

    match fetch_latest_release().await {
        Some(release) => {
            let remote_version = release.tag_name.trim_start_matches('v').to_string();
            tracing::info!(
                "Current version: {}, Latest release: {}",
                current_version,
                remote_version
            );

            if is_newer_version(&current_version, &remote_version) {
                tracing::info!("Update available: v{}", remote_version);

                // Find the MSI or NSIS installer asset
                let installer_url = release
                    .assets
                    .iter()
                    .find(|a| {
                        a.name.ends_with(".msi")
                            || a.name.ends_with("-setup.exe")
                            || a.name.ends_with("_x64-setup.exe")
                    })
                    .map(|a| a.browser_download_url.clone());

                Ok(UpdateInfo {
                    available: true,
                    version: Some(remote_version),
                    body: release.body,
                    current_version,
                    release_url: release.html_url.or(Some(releases_url)),
                    installer_url,
                })
            } else {
                tracing::info!("No update available, current version is up to date");
                Ok(UpdateInfo {
                    available: false,
                    version: None,
                    body: None,
                    current_version,
                    release_url: Some(releases_url),
                    installer_url: None,
                })
            }
        }
        None => {
            tracing::info!("No release information available");
            Ok(UpdateInfo {
                available: false,
                version: None,
                body: Some(
                    "No releases found. You're running the latest development version.".to_string(),
                ),
                current_version,
                release_url: Some(releases_url),
                installer_url: None,
            })
        }
    }
}

/// Download and install an available update.
///
/// Downloads the installer to a temp directory and launches it.
/// Falls back to opening the release page in the browser if no installer is found.
#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<()> {
    tracing::info!("Starting update process...");

    let update_info = check_for_update(app).await?;

    if !update_info.available {
        return Err(crate::error::AppError::Generic(
            "No update available".to_string(),
        ));
    }

    if let Some(installer_url) = update_info.installer_url {
        tracing::info!("Downloading installer from: {}", installer_url);

        let filename = installer_url
            .split('/')
            .next_back()
            .unwrap_or("SwatNotes-setup.exe");

        let temp_dir = std::env::temp_dir();
        let installer_path = temp_dir.join(filename);

        tracing::info!("Downloading to: {:?}", installer_path);

        let client = reqwest::Client::builder()
            .user_agent("SwatNotes-Updater")
            .redirect(reqwest::redirect::Policy::limited(10))
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .map_err(|e| {
                crate::error::AppError::Generic(format!("Failed to create HTTP client: {}", e))
            })?;

        tracing::info!("Sending download request...");
        let response = client.get(&installer_url).send().await.map_err(|e| {
            crate::error::AppError::Generic(format!("Failed to download installer: {}", e))
        })?;

        let status = response.status();
        tracing::info!("Download response status: {}", status);

        if !status.is_success() {
            return Err(crate::error::AppError::Generic(format!(
                "Download failed with status: {}",
                status
            )));
        }

        let bytes = response.bytes().await.map_err(|e| {
            crate::error::AppError::Generic(format!("Failed to read installer bytes: {}", e))
        })?;

        tracing::info!("Downloaded {} bytes", bytes.len());

        std::fs::write(&installer_path, &bytes).map_err(|e| {
            crate::error::AppError::Generic(format!("Failed to write installer: {}", e))
        })?;

        tracing::info!("Installer downloaded successfully, launching...");

        // Launch the installer
        let _ = Command::new("cmd")
            .args(["/C", "start", "", installer_path.to_str().unwrap_or("")])
            .spawn();

        return Ok(());
    }

    // Fallback: open the release page in browser
    if let Some(release_url) = update_info.release_url {
        tracing::info!("No installer found, opening release page: {}", release_url);

        let _ = Command::new("cmd")
            .args(["/C", "start", "", &release_url])
            .spawn();
    }

    Ok(())
}

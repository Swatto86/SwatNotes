/**
 * About window controller
 * Handles version display, data directory opening, and update checking
 */

import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-shell';
import { checkForUpdate } from './utils/updateApi';
import type { AppInfo, UpdateInfo } from './types';

// Initialize about window
document.addEventListener('DOMContentLoaded', async () => {
  let appDataDir = '';

  // Get app info (includes data directory)
  try {
    const info = await invoke<AppInfo>('get_app_info');
    appDataDir = info.app_data_dir;
  } catch (err) {
    console.error('Failed to get app info:', err);
  }

  // Set version
  try {
    const version = await getVersion();
    const versionText = document.getElementById('version-text');
    if (versionText) {
      versionText.textContent = `Version ${version}`;
    }
  } catch (err) {
    console.error('Failed to get version:', err);
  }

  // Show window after content is loaded (window is created hidden to prevent flash)
  try {
    const window = getCurrentWindow();
    await window.show();
    await window.setFocus();
  } catch (err) {
    console.error('Failed to show window:', err);
  }

  // Open data directory
  const openDataDirBtn = document.getElementById('open-data-dir-btn');
  openDataDirBtn?.addEventListener('click', async () => {
    if (appDataDir) {
      try {
        await open(appDataDir);
      } catch (err) {
        console.error('Failed to open data directory:', err);
      }
    }
  });

  // Check for updates
  const checkUpdatesBtn = document.getElementById('check-for-updates-btn');
  const updateStatus = document.getElementById('update-status');

  checkUpdatesBtn?.addEventListener('click', async () => {
    if (!updateStatus) {
      return;
    }

    updateStatus.classList.remove('hidden', 'text-success', 'text-error', 'text-warning');
    updateStatus.textContent = 'Checking for updates...';

    try {
      const result: UpdateInfo = await checkForUpdate();

      if (result.available) {
        updateStatus.classList.add('text-warning');
        updateStatus.innerHTML = `Update available: <strong>v${result.version}</strong>`;
      } else {
        updateStatus.classList.add('text-success');
        updateStatus.textContent = 'You are on the latest version';
      }
    } catch (err) {
      updateStatus.classList.add('text-error');
      updateStatus.textContent = 'Failed to check for updates';
      console.error('Update check failed:', err);
    }
  });
});

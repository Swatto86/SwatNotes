/**
 * Update Required Window
 * Displays when a mandatory update is available and blocks app usage until updated
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { exit } from '@tauri-apps/plugin-process';
import type { UpdateInfo } from './types';
import { logger } from './utils/logger';

const LOG_CONTEXT = 'UpdateRequired';
const currentWindow = getCurrentWebviewWindow();

/**
 * Initialize the update required window
 */
async function init(): Promise<void> {
  logger.info('Initializing update required window...', LOG_CONTEXT);

  // Apply theme from localStorage
  const theme = localStorage.getItem('swatnotes-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);

  // Get update info passed from backend
  try {
    const updateInfo = await invoke<UpdateInfo>('check_for_update');

    const currentVersionEl = document.getElementById('current-version');
    const newVersionEl = document.getElementById('new-version');
    const releaseNotesEl = document.getElementById('release-notes');

    if (currentVersionEl) {
      currentVersionEl.textContent = `v${updateInfo.current_version}`;
    }

    if (newVersionEl && updateInfo.version) {
      newVersionEl.textContent = `v${updateInfo.version}`;
    }

    if (releaseNotesEl) {
      // Display the release notes exactly as written in the Notes parameter
      // The notes flow: Notes param → Git tag annotation → GitHub Release body → Update UI
      const notes = updateInfo.body || 'No release notes available.';
      releaseNotesEl.textContent = notes;
    }
  } catch (error) {
    logger.error('Failed to load update info', LOG_CONTEXT, error);
  }

  // Setup event handlers
  setupEventHandlers();

  // Show window
  try {
    await currentWindow.show();
    await currentWindow.setFocus();
  } catch (error) {
    logger.error('Failed to show window', LOG_CONTEXT, error);
  }

  logger.info('Update required window initialized', LOG_CONTEXT);
}

/**
 * Setup event handlers for buttons
 */
function setupEventHandlers(): void {
  const quitBtn = document.getElementById('quit-btn');
  const updateBtn = document.getElementById('update-btn');

  quitBtn?.addEventListener('click', async () => {
    logger.info('User chose to quit', LOG_CONTEXT);
    await exit(0);
  });

  updateBtn?.addEventListener('click', async () => {
    try {
      updateBtn.setAttribute('disabled', 'true');
      updateBtn.innerHTML = `
        <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
        </svg>
        Downloading...
      `;

      logger.info('Starting update download and install', LOG_CONTEXT);
      await invoke('download_and_install_update');

      // The backend should handle opening the browser or running the installer
      // After which the user needs to manually complete the installation
      updateBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        Opening Download...
      `;

      // Give user time to see the message, then quit
      setTimeout(async () => {
        await exit(0);
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to download update: ' + errorMessage, LOG_CONTEXT, error);
      updateBtn.removeAttribute('disabled');
      updateBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Retry Download
      `;
      // Show error to user
      const releaseNotesEl = document.getElementById('release-notes');
      if (releaseNotesEl) {
        releaseNotesEl.textContent = `Download failed: ${errorMessage}\n\nPlease try again or download manually from GitHub.`;
        releaseNotesEl.style.color = 'oklch(var(--er))';
      }
    }
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

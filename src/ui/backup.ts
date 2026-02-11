/**
 * Backup UI Module
 * Handles backup creation and restore UI logic
 */

import { createBackup, listBackups, restoreBackup, deleteBackup } from '../utils/backupApi';
import { MIN_PASSWORD_LENGTH, BACKUP_LIST_LIMIT } from '../config';
import { showPrompt } from '../utils/modal';
import { logger } from '../utils/logger';
import { exit, relaunch } from '@tauri-apps/plugin-process';

const LOG_CONTEXT = 'Backup';

/**
 * Handle backup creation from UI
 */
export async function handleBackupNow() {
  const statusEl = document.getElementById('backup-status');
  const btnEl = document.getElementById('backup-now-btn') as HTMLButtonElement | null;
  const passwordInput = document.getElementById('backup-password') as HTMLInputElement | null;

  try {
    // Validate password
    const password = passwordInput?.value?.trim();
    if (!password) {
      if (statusEl) {
        statusEl.textContent = 'Please enter a backup password';
        statusEl.className = 'text-sm text-error';
      }
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      if (statusEl) {
        statusEl.textContent = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
        statusEl.className = 'text-sm text-error';
      }
      return;
    }

    if (btnEl) {
      btnEl.disabled = true;
    }
    if (statusEl) {
      statusEl.textContent = 'Creating encrypted backup...';
      statusEl.className = 'text-sm text-info';
    }

    await createBackup(password);

    if (statusEl) {
      statusEl.textContent = `Encrypted backup created successfully!`;
      statusEl.className = 'text-sm text-success';
    }

    // Clear password field
    if (passwordInput) {
      passwordInput.value = '';
    }

    // Refresh backups list
    await loadBackupsList();

    setTimeout(() => {
      if (statusEl) {
        statusEl.textContent = '';
      }
    }, 3000);
  } catch (error) {
    logger.error('Backup failed', LOG_CONTEXT, error);
    if (statusEl) {
      statusEl.textContent = 'Backup failed: ' + error;
      statusEl.className = 'text-sm text-error';
    }
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
    }
  }
}

/**
 * Load and display the list of available backups
 */
export async function loadBackupsList() {
  const listEl = document.getElementById('backups-list');
  if (!listEl) {
    return;
  }

  try {
    const backups = await listBackups();

    if (backups.length === 0) {
      listEl.innerHTML = '<p class="text-sm text-base-content/50">No backups yet.</p>';
      return;
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    listEl.innerHTML = backups
      .slice(0, BACKUP_LIST_LIMIT) // Show last N backups
      .map(
        (backup, index) => `
      <div class="flex justify-between items-center p-2 bg-base-200 rounded mb-2">
        <div>
          <p class="text-sm font-medium">${formatDate(backup.timestamp)}</p>
          <p class="text-xs text-base-content/50">${formatFileSize(backup.size)}</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-xs restore-btn" data-backup-index="${index}">Restore</button>
          <button class="btn btn-error btn-xs delete-btn" data-backup-index="${index}">Delete</button>
        </div>
      </div>
    `
      )
      .join('');

    // Attach click listeners to restore and delete buttons
    const recentBackups = backups.slice(0, BACKUP_LIST_LIMIT);
    document.querySelectorAll('.restore-btn').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const backup = recentBackups[index];
        handleRestoreBackup(backup.path, backup.timestamp);
      });
    });

    document.querySelectorAll('.delete-btn').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const backup = recentBackups[index];
        handleDeleteBackup(backup.id, backup.path, backup.timestamp);
      });
    });
  } catch (error) {
    logger.error('Failed to load backups', LOG_CONTEXT, error);
    listEl.innerHTML = '<p class="text-sm text-error">Failed to load backups</p>';
  }
}

/**
 * Format file size in human-readable form
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date to locale string
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * Handle backup restore
 * @param {string} backupPath - Path to backup file
 * @param {string} backupTimestamp - Backup creation timestamp
 */
async function handleRestoreBackup(backupPath: string, _backupTimestamp: string) {
  const password = await showPrompt('Enter the backup password:', {
    title: 'Restore Backup',
    input: { type: 'password', placeholder: 'Backup password' },
  });
  if (!password) {
    return;
  }

  const statusEl = document.getElementById('backup-status');

  try {
    statusEl.textContent = 'Restoring backup... Please wait.';
    statusEl.className = 'text-sm text-info';

    await restoreBackup(backupPath, password);

    statusEl.textContent = 'Restore completed! Restarting application...';
    statusEl.className = 'text-sm text-success';

    // Automatically restart
    logger.info('Restarting after restore', LOG_CONTEXT);
    try {
      // Use Tauri's relaunch to restart the application
      await relaunch();
    } catch (relaunchError) {
      // Fallback: try exit if relaunch fails
      logger.error('Relaunch failed, attempting exit', LOG_CONTEXT, relaunchError);
      await exit(0);
    }
  } catch (error) {
    logger.error('Restore failed', LOG_CONTEXT, error);
    statusEl.textContent = 'Restore failed: ' + error;
    statusEl.className = 'text-sm text-error';
  }
}

/**
 * Handle backup deletion
 * @param {string} backupId - Backup ID
 * @param {string} backupPath - Path to backup file
 * @param {string} backupTimestamp - Backup creation timestamp
 */
async function handleDeleteBackup(backupId, backupPath, _backupTimestamp) {
  const statusEl = document.getElementById('backup-status');

  try {
    statusEl.textContent = 'Deleting backup...';
    statusEl.className = 'text-sm text-info';

    await deleteBackup(backupId, backupPath);

    statusEl.textContent = 'Backup deleted successfully';
    statusEl.className = 'text-sm text-success';

    // Refresh backups list
    await loadBackupsList();

    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
  } catch (error) {
    logger.error('Delete failed', LOG_CONTEXT, error);
    statusEl.textContent = 'Delete failed: ' + error;
    statusEl.className = 'text-sm text-error';
  }
}

/**
 * Backup UI Module
 * Handles backup creation and restore UI logic
 */

import { createBackup, listBackups, restoreBackup } from '../utils/backupApi';
import { MIN_PASSWORD_LENGTH, BACKUP_LIST_LIMIT } from '../config';

/**
 * Handle backup creation from UI
 */
export async function handleBackupNow() {
  const statusEl = document.getElementById('backup-status');
  const btnEl = document.getElementById('backup-now-btn');
  const passwordInput = document.getElementById('backup-password');

  try {
    // Validate password
    const password = passwordInput?.value?.trim();
    if (!password) {
      statusEl.textContent = 'Please enter a backup password';
      statusEl.className = 'text-sm text-error';
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      statusEl.textContent = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
      statusEl.className = 'text-sm text-error';
      return;
    }

    btnEl.disabled = true;
    statusEl.textContent = 'Creating encrypted backup...';
    statusEl.className = 'text-sm text-info';

    const backupPath = await createBackup(password);

    statusEl.textContent = `Encrypted backup created successfully!`;
    statusEl.className = 'text-sm text-success';

    // Clear password field
    if (passwordInput) {
      passwordInput.value = '';
    }

    // Refresh backups list
    await loadBackupsList();

    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Backup failed:', error);
    statusEl.textContent = 'Backup failed: ' + error;
    statusEl.className = 'text-sm text-error';
  } finally {
    btnEl.disabled = false;
  }
}

/**
 * Load and display the list of available backups
 */
export async function loadBackupsList() {
  const listEl = document.getElementById('backups-list');
  if (!listEl) return;

  try {
    const backups = await listBackups();

    if (backups.length === 0) {
      listEl.innerHTML = '<p class="text-sm text-base-content/50">No backups yet.</p>';
      return;
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    listEl.innerHTML = backups
      .slice(0, BACKUP_LIST_LIMIT) // Show last N backups
      .map(
        (backup, index) => `
      <div class="flex justify-between items-center p-2 bg-base-200 rounded mb-2">
        <div>
          <p class="text-sm font-medium">${formatDate(backup.timestamp)}</p>
          <p class="text-xs text-base-content/50">${formatFileSize(backup.size)}</p>
        </div>
        <button class="btn btn-primary btn-xs restore-btn" data-backup-index="${index}">Restore</button>
      </div>
    `
      )
      .join('');

    // Attach click listeners to restore buttons
    const recentBackups = backups.slice(0, BACKUP_LIST_LIMIT);
    document.querySelectorAll('.restore-btn').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const backup = recentBackups[index];
        handleRestoreBackup(backup.path, backup.timestamp);
      });
    });
  } catch (error) {
    console.error('Failed to load backups:', error);
    listEl.innerHTML = '<p class="text-sm text-error">Failed to load backups</p>';
  }
}

/**
 * Format file size in human-readable form
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
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
async function handleRestoreBackup(backupPath, backupTimestamp) {
  const confirmed = confirm(
    `Are you sure you want to restore from backup created on ${formatDate(backupTimestamp)}?\n\n` +
    `This will replace all current data. The application will need to restart after restore.`
  );

  if (!confirmed) {
    return;
  }

  const password = prompt('Enter the backup password:');
  if (!password) {
    return;
  }

  const statusEl = document.getElementById('backup-status');

  try {
    statusEl.textContent = 'Restoring backup... Please wait.';
    statusEl.className = 'text-sm text-info';

    await restoreBackup(backupPath, password);

    statusEl.textContent = 'Restore completed! Please restart the application.';
    statusEl.className = 'text-sm text-success';

    // Show restart prompt
    setTimeout(() => {
      alert('Restore completed successfully!\n\nPlease close and restart the application to see the restored data.');
    }, 500);
  } catch (error) {
    console.error('Restore failed:', error);
    statusEl.textContent = 'Restore failed: ' + error;
    statusEl.className = 'text-sm text-error';
  }
}

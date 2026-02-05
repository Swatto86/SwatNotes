/**
 * Settings Window
 * Manages application settings with persistent storage
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { open } from '@tauri-apps/plugin-shell';
import type { AppInfo, Backup, UpdateInfo } from './types';
import { showPrompt, showAlert } from './utils/modal';
import { logger } from './utils/logger';
import { playNotificationSound } from './utils/notificationSound';

const LOG_CONTEXT = 'Settings';

const THEME_KEY = 'swatnotes-theme';
const SETTINGS_KEY = 'swatnotes-settings';

interface AppSettings {
  minimizeToTray: boolean;
  closeToTray: boolean;
  startWithWindows: boolean;
  autoSaveDelay: number;
}

const defaultSettings: AppSettings = {
  minimizeToTray: true,
  closeToTray: true,
  startWithWindows: false,
  autoSaveDelay: 1000,
};

interface AutoBackupSettings {
  enabled: boolean;
  frequency: string;
  retention_days: number;
  backup_location: string | null;
}

const currentWindow = getCurrentWebviewWindow();

/**
 * Get stored theme
 */
function getStoredTheme(): string {
  return localStorage.getItem(THEME_KEY) || 'light';
}

/**
 * Apply theme to document
 */
function applyTheme(theme?: string): void {
  const selectedTheme = theme || getStoredTheme();
  document.documentElement.setAttribute('data-theme', selectedTheme);
  localStorage.setItem(THEME_KEY, selectedTheme);

  // Notify other windows of theme change
  window.dispatchEvent(new StorageEvent('storage', {
    key: THEME_KEY,
    newValue: selectedTheme,
  }));
}

/**
 * Get stored settings
 */
function getSettings(): AppSettings {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      return { ...defaultSettings, ...JSON.parse(stored) };
    } catch (e) {
      logger.error('Failed to parse settings', LOG_CONTEXT, e);
    }
  }
  return defaultSettings;
}

/**
 * Save settings
 */
function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  logger.debug('Settings saved', LOG_CONTEXT, settings);
}

/**
 * Load auto-backup settings from backend
 */
async function loadAutoBackupSettings(): Promise<AutoBackupSettings> {
  try {
    return await invoke<AutoBackupSettings>('get_auto_backup_settings');
  } catch (error) {
    logger.error('Failed to load auto-backup settings', LOG_CONTEXT, error);
    return { enabled: false, frequency: 'weekly', retention_days: 30, backup_location: null };
  }
}

/**
 * Save auto-backup settings to backend
 */
async function saveAutoBackupSettings(settings: AutoBackupSettings): Promise<void> {
  await invoke('update_auto_backup_settings', { settings });
  logger.debug('Auto-backup settings saved', LOG_CONTEXT, settings);
}

/**
 * Check if auto-backup password is set
 */
async function checkAutoBackupPasswordStatus(): Promise<void> {
  const statusEl = document.getElementById('auto-backup-password-status');
  const clearBtn = document.getElementById('delete-auto-backup-password-btn') as HTMLButtonElement;

  try {
    const hasPassword = await invoke<boolean>('has_auto_backup_password');
    logger.debug('Password status check', LOG_CONTEXT, { hasPassword });

    if (statusEl) {
      if (hasPassword) {
        statusEl.innerHTML = '<span class="text-xs text-success flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>Password set</span>';
      } else {
        statusEl.innerHTML = '<span class="text-xs text-warning flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>No password set</span>';
      }
    }

    // Enable/disable clear button based on password status
    if (clearBtn) {
      clearBtn.disabled = !hasPassword;
    }
  } catch (error) {
    logger.error('Failed to check password status', LOG_CONTEXT, error);
    // Show error state in the UI
    if (statusEl) {
      statusEl.innerHTML = '<span class="text-xs text-error flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>Error checking status</span>';
    }
    // Disable clear button on error
    if (clearBtn) {
      clearBtn.disabled = true;
    }
  }
}

/**
 * Load and display current backup location
 */
async function loadBackupLocation(): Promise<void> {
  try {
    const backupDir = await invoke<string>('get_backup_directory');
    const inputEl = document.getElementById('backup-location-input') as HTMLInputElement;
    if (inputEl) {
      inputEl.value = backupDir;
      inputEl.title = backupDir; // Show full path on hover
    }
  } catch (error) {
    logger.error('Failed to load backup location', LOG_CONTEXT, error);
  }
}

interface HotkeySettings {
  new_note: string;
  toggle_note: string;
  open_search: string;
  open_settings: string;
  toggle_all_notes: string;
  quick_capture: string;
}

interface ReminderSettings {
  sound_enabled: boolean;
  sound_frequency: number;
  sound_duration: number;
  shake_enabled: boolean;
  shake_duration: number;
  glow_enabled: boolean;
  sound_type: string;
}

/**
 * Load reminder settings from backend
 */
async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    return await invoke<ReminderSettings>('get_reminder_settings');
  } catch (error) {
    logger.error('Failed to load reminder settings', LOG_CONTEXT, error);
    return {
      sound_enabled: true,
      sound_frequency: 880,
      sound_duration: 500,
      shake_enabled: true,
      shake_duration: 600,
      glow_enabled: true,
      sound_type: 'whoosh',
    };
  }
}

/**
 * Save reminder settings to backend
 */
async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await invoke('update_reminder_settings', { settings });
  logger.debug('Reminder settings saved', LOG_CONTEXT, settings);
}

/**
 * Play test notification sound using the selected preset
 */
function playTestSound(soundType?: string): void {
  playNotificationSound(soundType || 'whoosh');
}

/**
 * Load deleted notes count for database maintenance section
 */
async function loadDeletedNotesCount(): Promise<void> {
  try {
    const count = await invoke<number>('count_deleted_notes');
    const countEl = document.getElementById('deleted-notes-count');
    if (countEl) {
      countEl.textContent = count.toString();
      if (count === 0) {
        countEl.classList.remove('badge-warning');
        countEl.classList.add('badge-success');
      } else {
        countEl.classList.remove('badge-success');
        countEl.classList.add('badge-warning');
      }
    }
  } catch (error) {
    logger.error('Failed to load deleted notes count', LOG_CONTEXT, error);
    const countEl = document.getElementById('deleted-notes-count');
    if (countEl) {
      countEl.textContent = 'Error';
    }
  }
}

/**
 * Load app info
 */
async function loadAppInfo(): Promise<void> {
  try {
    const info = await invoke<AppInfo>('get_app_info');
    const currentVersionEl = document.getElementById('current-version');
    if (currentVersionEl) {
      currentVersionEl.textContent = info.version;
    }

    // Store data dir for open button
    const openDataDirBtn = document.getElementById('open-data-dir-btn');
    if (openDataDirBtn) {
      openDataDirBtn.setAttribute('data-dir', info.app_data_dir);
    }
  } catch (error) {
    logger.error('Failed to load app info', LOG_CONTEXT, error);
  }
}

/**
 * Load hotkey settings
 */
async function loadHotkeySettings(): Promise<void> {
  try {
    const hotkeys = await invoke<HotkeySettings>('get_hotkey_settings');
    const newNoteInput = document.getElementById('hotkey-new-note-input') as HTMLInputElement;
    const toggleNoteInput = document.getElementById('hotkey-toggle-note-input') as HTMLInputElement;
    const openSearchInput = document.getElementById('hotkey-open-search-input') as HTMLInputElement;
    const openSettingsInput = document.getElementById('hotkey-open-settings-input') as HTMLInputElement;
    const toggleAllNotesInput = document.getElementById('hotkey-toggle-all-notes-input') as HTMLInputElement;
    const quickCaptureInput = document.getElementById('hotkey-quick-capture-input') as HTMLInputElement;

    if (newNoteInput) newNoteInput.value = hotkeys.new_note;
    if (toggleNoteInput) toggleNoteInput.value = hotkeys.toggle_note;
    if (openSearchInput) openSearchInput.value = hotkeys.open_search;
    if (openSettingsInput) openSettingsInput.value = hotkeys.open_settings;
    if (toggleAllNotesInput) toggleAllNotesInput.value = hotkeys.toggle_all_notes;
    if (quickCaptureInput) quickCaptureInput.value = hotkeys.quick_capture;
  } catch (error) {
    logger.error('Failed to load hotkey settings', LOG_CONTEXT, error);
  }
}

/**
 * Format relative time (e.g., "2 minutes ago", "3 hours ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * Update the prominent last backup display
 */
function updateLastBackupDisplay(backups: any[]): void {
  const lastBackupTime = document.getElementById('last-backup-time');
  const lastBackupAge = document.getElementById('last-backup-age');

  if (!lastBackupTime || !lastBackupAge) return;

  if (backups.length === 0) {
    lastBackupTime.textContent = 'No backups yet';
    lastBackupTime.classList.remove('text-success', 'text-warning', 'text-error');
    return;
  }

  // Get the most recent backup
  const latest = backups[0];
  const backupDate = new Date(latest.timestamp);
  const ageMs = Date.now() - backupDate.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  lastBackupTime.textContent = backupDate.toLocaleString();
  lastBackupAge.textContent = formatRelativeTime(backupDate);

  // Color code based on age
  lastBackupTime.classList.remove('text-success', 'text-warning', 'text-error');
  if (ageHours < 1) {
    lastBackupTime.classList.add('text-success'); // Green - very recent
  } else if (ageHours < 24) {
    // Default color - reasonably recent
  } else if (ageHours < 72) {
    lastBackupTime.classList.add('text-warning'); // Yellow - getting old
  } else {
    lastBackupTime.classList.add('text-error'); // Red - very old
  }
}

/**
 * Load backups list
 */
async function loadBackupsList(): Promise<void> {
  try {
    const backups = await invoke<any[]>('list_backups');
    const backupsList = document.getElementById('backups-list');

    // Sort by timestamp (newest first)
    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Update the prominent last backup display
    updateLastBackupDisplay(backups);

    if (!backupsList) return;

    if (backups.length === 0) {
      backupsList.innerHTML = '<div class="text-base-content/50 text-sm text-center py-4">No backups found</div>';
      return;
    }

    backupsList.innerHTML = backups.map((backup, index) => `
      <div class="bg-base-200 rounded-lg p-3 flex justify-between items-center mb-2">
        <div>
          <div class="text-base-content font-medium">${new Date(backup.timestamp).toLocaleString()}</div>
          <div class="text-base-content/50 text-sm">${formatFileSize(backup.size)}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm restore-backup-btn" data-backup-index="${index}">
            Restore
          </button>
          <button class="btn btn-error btn-sm delete-backup-btn" data-backup-index="${index}">
            Delete
          </button>
        </div>
      </div>
    `).join('');

    // Attach event listeners for restore buttons
    document.querySelectorAll('.restore-backup-btn').forEach((btn, index) => {
      btn.addEventListener('click', async () => {
        const backup = backups[index];
        await handleRestoreBackup(backup);
      });
    });

    // Attach event listeners for delete buttons
    document.querySelectorAll('.delete-backup-btn').forEach((btn, index) => {
      btn.addEventListener('click', async () => {
        const backup = backups[index];
        await handleDeleteBackup(backup);
      });
    });
  } catch (error) {
    logger.error('Failed to load backups', LOG_CONTEXT, error);
  }
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Handle backup restore
 */
async function handleRestoreBackup(backup: Backup): Promise<void> {
  const password = await showPrompt('Enter the backup password:', {
    title: 'Restore Backup',
    input: { type: 'password', placeholder: 'Backup password' }
  });
  if (!password) return;

  try {
    await invoke('restore_backup', { backupPath: backup.path, password });
    await showAlert('Restore completed successfully!\n\nThe application will now restart to load the restored data.', {
      title: 'Success',
      type: 'success'
    });
    // Restart the application to load the restored database
    await invoke('restart_app');
  } catch (error) {
    logger.error('Restore failed', LOG_CONTEXT, error);
    await showAlert('Restore failed: ' + error, { title: 'Error', type: 'error' });
  }
}

/**
 * Handle backup deletion
 */
async function handleDeleteBackup(backup: Backup): Promise<void> {
  try {
    await invoke('delete_backup', { backupId: backup.id, backupPath: backup.path });
    // Refresh the backups list
    await loadBackupsList();
  } catch (error) {
    logger.error('Delete failed', LOG_CONTEXT, error);
  }
}

/**
 * Setup event handlers
 */
function setupEventHandlers(): void {
  const settings = getSettings();

  // Close button
  const closeBtn = document.getElementById('close-btn');
  closeBtn?.addEventListener('click', () => {
    currentWindow.close();
  });

  // Theme select
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
  if (themeSelect) {
    themeSelect.value = getStoredTheme();
    themeSelect.addEventListener('change', () => {
      applyTheme(themeSelect.value);
    });
  }

  // Minimize to tray checkbox
  const minimizeToTrayCheckbox = document.getElementById('minimize-to-tray-checkbox') as HTMLInputElement;
  if (minimizeToTrayCheckbox) {
    minimizeToTrayCheckbox.checked = settings.minimizeToTray;
    minimizeToTrayCheckbox.addEventListener('change', () => {
      settings.minimizeToTray = minimizeToTrayCheckbox.checked;
      saveSettings(settings);
    });
  }

  // Close to tray checkbox
  const closeToTrayCheckbox = document.getElementById('close-to-tray-checkbox') as HTMLInputElement;
  if (closeToTrayCheckbox) {
    closeToTrayCheckbox.checked = settings.closeToTray;
    closeToTrayCheckbox.addEventListener('change', () => {
      settings.closeToTray = closeToTrayCheckbox.checked;
      saveSettings(settings);
    });
  }

  // Start with Windows checkbox
  const startWithWindowsCheckbox = document.getElementById('start-with-windows-checkbox') as HTMLInputElement;
  if (startWithWindowsCheckbox) {
    startWithWindowsCheckbox.checked = settings.startWithWindows;
    startWithWindowsCheckbox.addEventListener('change', async () => {
      settings.startWithWindows = startWithWindowsCheckbox.checked;
      saveSettings(settings);

      // Call backend to actually enable/disable autostart
      try {
        await invoke('set_autostart', { enabled: startWithWindowsCheckbox.checked });
      } catch (error) {
        logger.error('Failed to set autostart', LOG_CONTEXT, error);
        await showAlert('Failed to update startup settings: ' + error, { title: 'Error', type: 'error' });
        // Revert checkbox on error
        startWithWindowsCheckbox.checked = !startWithWindowsCheckbox.checked;
        settings.startWithWindows = startWithWindowsCheckbox.checked;
        saveSettings(settings);
      }
    });
  }

  // Auto-save delay input
  const autoSaveDelayInput = document.getElementById('autosave-delay-input') as HTMLInputElement;
  if (autoSaveDelayInput) {
    autoSaveDelayInput.value = settings.autoSaveDelay.toString();
    autoSaveDelayInput.addEventListener('change', () => {
      const value = parseInt(autoSaveDelayInput.value, 10);
      if (value >= 100) {
        settings.autoSaveDelay = value;
        saveSettings(settings);
      }
    });
  }

  // Reminder settings (loaded from backend)
  loadReminderSettings().then(reminderSettings => {
    const soundCheckbox = document.getElementById('reminder-sound-checkbox') as HTMLInputElement;
    const shakeCheckbox = document.getElementById('reminder-shake-checkbox') as HTMLInputElement;
    const glowCheckbox = document.getElementById('reminder-glow-checkbox') as HTMLInputElement;
    const shakeDurationInput = document.getElementById('reminder-shake-duration-input') as HTMLInputElement;
    const testBtn = document.getElementById('test-reminder-btn');

    // Initialize checkboxes
    if (soundCheckbox) {
      soundCheckbox.checked = reminderSettings.sound_enabled;
      soundCheckbox.addEventListener('change', async () => {
        reminderSettings.sound_enabled = soundCheckbox.checked;
        try {
          await saveReminderSettings(reminderSettings);
        } catch (error) {
          logger.error('Failed to save reminder settings', LOG_CONTEXT, error);
          await showAlert('Failed to save settings: ' + error, { title: 'Error', type: 'error' });
        }
      });
    }

    if (shakeCheckbox) {
      shakeCheckbox.checked = reminderSettings.shake_enabled;
      shakeCheckbox.addEventListener('change', async () => {
        reminderSettings.shake_enabled = shakeCheckbox.checked;
        try {
          await saveReminderSettings(reminderSettings);
        } catch (error) {
          logger.error('Failed to save reminder settings', LOG_CONTEXT, error);
          await showAlert('Failed to save settings: ' + error, { title: 'Error', type: 'error' });
        }
      });
    }

    if (glowCheckbox) {
      glowCheckbox.checked = reminderSettings.glow_enabled;
      glowCheckbox.addEventListener('change', async () => {
        reminderSettings.glow_enabled = glowCheckbox.checked;
        try {
          await saveReminderSettings(reminderSettings);
        } catch (error) {
          logger.error('Failed to save reminder settings', LOG_CONTEXT, error);
          await showAlert('Failed to save settings: ' + error, { title: 'Error', type: 'error' });
        }
      });
    }

    // Initialize shake duration input
    if (shakeDurationInput) {
      shakeDurationInput.value = reminderSettings.shake_duration.toString();
      shakeDurationInput.addEventListener('change', async () => {
        const value = parseInt(shakeDurationInput.value, 10);
        if (value >= 200 && value <= 2000) {
          reminderSettings.shake_duration = value;
          try {
            await saveReminderSettings(reminderSettings);
          } catch (error) {
            logger.error('Failed to save reminder settings', LOG_CONTEXT, error);
            await showAlert('Failed to save settings: ' + error, { title: 'Error', type: 'error' });
          }
        }
      });
    }

    // Initialize sound type dropdown
    const soundTypeSelect = document.getElementById('reminder-sound-type-select') as HTMLSelectElement;
    if (soundTypeSelect) {
      soundTypeSelect.value = reminderSettings.sound_type || 'whoosh';
      soundTypeSelect.addEventListener('change', async () => {
        reminderSettings.sound_type = soundTypeSelect.value;
        try {
          await saveReminderSettings(reminderSettings);
          // Play a preview of the newly selected sound
          playTestSound(soundTypeSelect.value);
        } catch (error) {
          logger.error('Failed to save reminder settings', LOG_CONTEXT, error);
          await showAlert('Failed to save settings: ' + error, { title: 'Error', type: 'error' });
        }
      });
    }

    // Test notification button - plays the currently selected sound preset
    testBtn?.addEventListener('click', () => {
      playTestSound(reminderSettings.sound_type);
    });
  });

  // Auto-backup password management
  const autoBackupPasswordInput = document.getElementById('auto-backup-password-input') as HTMLInputElement;
  const savePasswordBtn = document.getElementById('save-auto-backup-password-btn');
  const deletePasswordBtn = document.getElementById('delete-auto-backup-password-btn');

  savePasswordBtn?.addEventListener('click', async () => {
    const password = autoBackupPasswordInput?.value || '';
    if (!password) {
      // Focus the input to indicate it's required
      autoBackupPasswordInput?.focus();
      return;
    }

    try {
      await invoke('store_auto_backup_password', { password });
      if (autoBackupPasswordInput) autoBackupPasswordInput.value = '';
      await checkAutoBackupPasswordStatus();
      logger.info('Auto-backup password saved successfully', LOG_CONTEXT);
    } catch (error) {
      logger.error('Failed to save password', LOG_CONTEXT, error);
      await showAlert('Failed to save password: ' + error, { title: 'Error', type: 'error' });
    }
  });

  deletePasswordBtn?.addEventListener('click', async () => {
    try {
      // Check if password exists before trying to delete
      const hasPassword = await invoke<boolean>('has_auto_backup_password');
      if (!hasPassword) {
        // No password to delete, just update status
        await checkAutoBackupPasswordStatus();
        return;
      }

      await invoke('delete_auto_backup_password');
      await checkAutoBackupPasswordStatus();

      // Disable auto-backup if password is deleted
      const autoBackupSettings = await loadAutoBackupSettings();
      if (autoBackupSettings.enabled) {
        autoBackupSettings.enabled = false;
        await saveAutoBackupSettings(autoBackupSettings);
        const checkbox = document.getElementById('auto-backup-enabled-checkbox') as HTMLInputElement;
        if (checkbox) checkbox.checked = false;
      }
      logger.info('Auto-backup password cleared successfully', LOG_CONTEXT);
    } catch (error) {
      logger.error('Failed to delete password', LOG_CONTEXT, error);
      await showAlert('Failed to clear password: ' + error, { title: 'Error', type: 'error' });
    }
  });

  // Backup location management
  const selectBackupLocationBtn = document.getElementById('select-backup-location-btn');
  const resetBackupLocationBtn = document.getElementById('reset-backup-location-btn');
  const backupLocationInput = document.getElementById('backup-location-input') as HTMLInputElement;

  selectBackupLocationBtn?.addEventListener('click', async () => {
    try {
      // Use Tauri's file dialog to select directory
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Backup Location'
      });

      if (selected && typeof selected === 'string') {
        // Update settings with new location
        const autoBackupSettings = await loadAutoBackupSettings();
        autoBackupSettings.backup_location = selected;
        await saveAutoBackupSettings(autoBackupSettings);

        // Update display
        if (backupLocationInput) {
          backupLocationInput.value = selected;
          backupLocationInput.title = selected;
        }
      }
    } catch (error) {
      logger.error('Failed to select backup location', LOG_CONTEXT, error);
    }
  });

  resetBackupLocationBtn?.addEventListener('click', async () => {
    try {
      // Reset location to null (default)
      const autoBackupSettings = await loadAutoBackupSettings();
      autoBackupSettings.backup_location = null;
      await saveAutoBackupSettings(autoBackupSettings);

      // Reload and display default location
      await loadBackupLocation();
    } catch (error) {
      logger.error('Failed to reset backup location', LOG_CONTEXT, error);
    }
  });

  // Auto backup settings (loaded from backend)
  loadAutoBackupSettings().then(autoBackupSettings => {
    const autoBackupEnabledCheckbox = document.getElementById('auto-backup-enabled-checkbox') as HTMLInputElement;
    const backupFrequencyInput = document.getElementById('backup-frequency-input') as HTMLInputElement;
    const backupRetentionSelect = document.getElementById('backup-retention-select') as HTMLSelectElement;

    if (autoBackupEnabledCheckbox) {
      autoBackupEnabledCheckbox.checked = autoBackupSettings.enabled;
      autoBackupEnabledCheckbox.addEventListener('change', async () => {
        autoBackupSettings.enabled = autoBackupEnabledCheckbox.checked;

        // Check if password is set before enabling
        if (autoBackupSettings.enabled) {
          const hasPassword = await invoke<boolean>('has_auto_backup_password');
          if (!hasPassword) {
            // Focus the password input instead of showing alert
            autoBackupEnabledCheckbox.checked = false;
            autoBackupPasswordInput?.focus();
            return;
          }
        }

        try {
          await saveAutoBackupSettings(autoBackupSettings);
        } catch (error) {
          logger.error('Failed to save auto-backup settings', LOG_CONTEXT, error);
        }
      });
    }

    if (backupFrequencyInput) {
      backupFrequencyInput.value = autoBackupSettings.frequency;
      backupFrequencyInput.addEventListener('blur', async () => {
        const value = backupFrequencyInput.value.trim().toLowerCase();

        // Validate format
        const validPattern = /^(\d+[mhd]|daily|weekly|monthly)$/;
        if (!value || !validPattern.test(value)) {
          // Revert to previous value on invalid input
          backupFrequencyInput.value = autoBackupSettings.frequency;
          return;
        }

        autoBackupSettings.frequency = value;
        try {
          await saveAutoBackupSettings(autoBackupSettings);
        } catch (error) {
          logger.error('Failed to save auto-backup settings', LOG_CONTEXT, error);
          // Revert on error
          backupFrequencyInput.value = autoBackupSettings.frequency;
        }
      });
    }

    if (backupRetentionSelect) {
      backupRetentionSelect.value = autoBackupSettings.retention_days.toString();
      backupRetentionSelect.addEventListener('change', async () => {
        autoBackupSettings.retention_days = parseInt(backupRetentionSelect.value, 10);
        try {
          await saveAutoBackupSettings(autoBackupSettings);
        } catch (error) {
          logger.error('Failed to save auto-backup settings', LOG_CONTEXT, error);
        }
      });
    }
  });

  // Create backup button
  const createBackupBtn = document.getElementById('create-backup-btn');
  const backupPasswordInput = document.getElementById('backup-password-input') as HTMLInputElement;

  createBackupBtn?.addEventListener('click', async () => {
    const password = backupPasswordInput?.value || '';

    if (!password) {
      backupPasswordInput?.focus();
      return;
    }

    try {
      createBackupBtn.setAttribute('disabled', 'true');
      createBackupBtn.textContent = 'Creating backup...';

      await invoke<string>('create_backup', { password });

      // Clear password
      if (backupPasswordInput) {
        backupPasswordInput.value = '';
      }

      // Reload backups list
      await loadBackupsList();
    } catch (error) {
      logger.error('Failed to create backup', LOG_CONTEXT, error);
    } finally {
      createBackupBtn.removeAttribute('disabled');
      createBackupBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Create Backup Now
      `;
    }
  });

  // Open data dir button
  const openDataDirBtn = document.getElementById('open-data-dir-btn');
  openDataDirBtn?.addEventListener('click', async () => {
    const dataDir = openDataDirBtn.getAttribute('data-dir');
    if (dataDir) {
      try {
        await open(dataDir);
      } catch (error) {
        logger.error('Failed to open data directory', LOG_CONTEXT, error);
      }
    }
  });

  // Prune database button (empty trash)
  const pruneDatabaseBtn = document.getElementById('prune-database-btn');
  pruneDatabaseBtn?.addEventListener('click', async () => {
    // Check count first
    const countEl = document.getElementById('deleted-notes-count');
    const count = parseInt(countEl?.textContent || '0', 10);

    if (count === 0) {
      return;
    }

    try {
      pruneDatabaseBtn.setAttribute('disabled', 'true');
      pruneDatabaseBtn.textContent = 'Removing...';

      await invoke<number>('prune_deleted_notes');

      // Refresh the count
      await loadDeletedNotesCount();
    } catch (error) {
      logger.error('Failed to prune database', LOG_CONTEXT, error);
    } finally {
      pruneDatabaseBtn.removeAttribute('disabled');
      pruneDatabaseBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Empty Trash
      `;
    }
  });

  // Save hotkeys button
  const saveHotkeysBtn = document.getElementById('save-hotkeys-btn');
  const newNoteInput = document.getElementById('hotkey-new-note-input') as HTMLInputElement;
  const toggleNoteInput = document.getElementById('hotkey-toggle-note-input') as HTMLInputElement;
  const openSearchInput = document.getElementById('hotkey-open-search-input') as HTMLInputElement;
  const openSettingsInput = document.getElementById('hotkey-open-settings-input') as HTMLInputElement;
  const toggleAllNotesInput = document.getElementById('hotkey-toggle-all-notes-input') as HTMLInputElement;
  const quickCaptureInput = document.getElementById('hotkey-quick-capture-input') as HTMLInputElement;

  saveHotkeysBtn?.addEventListener('click', async () => {
    if (!newNoteInput || !toggleNoteInput || !openSearchInput || !openSettingsInput || !toggleAllNotesInput || !quickCaptureInput) {
      await showAlert('Failed to get hotkey input fields', { title: 'Error', type: 'error' });
      return;
    }

    const hotkeys: HotkeySettings = {
      new_note: newNoteInput.value.trim(),
      toggle_note: toggleNoteInput.value.trim(),
      open_search: openSearchInput.value.trim(),
      open_settings: openSettingsInput.value.trim(),
      toggle_all_notes: toggleAllNotesInput.value.trim(),
      quick_capture: quickCaptureInput.value.trim(),
    };

    if (!hotkeys.new_note || !hotkeys.toggle_note || !hotkeys.open_search || !hotkeys.open_settings || !hotkeys.toggle_all_notes || !hotkeys.quick_capture) {
      await showAlert('All hotkey fields must be filled', { title: 'Error', type: 'warning' });
      return;
    }

    try {
      saveHotkeysBtn.setAttribute('disabled', 'true');
      saveHotkeysBtn.textContent = 'Saving...';

      await invoke('update_hotkey_settings', { hotkeys });

      // Show success state on button instead of popup
      saveHotkeysBtn.textContent = 'Saved! Restart to apply';
      saveHotkeysBtn.classList.add('btn-success');

      setTimeout(() => {
        saveHotkeysBtn.classList.remove('btn-success');
        saveHotkeysBtn.textContent = 'Save Hotkeys (Restart Required)';
      }, 3000);
    } catch (error) {
      logger.error('Failed to save hotkey settings', LOG_CONTEXT, error);
    } finally {
      saveHotkeysBtn.removeAttribute('disabled');
    }
  });

  // Update checker
  setupUpdateChecker();
}

/**
 * Escape HTML for safe display
 */
function escapeHtmlSimple(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Setup the check for updates button in the About section
 */
function setupUpdateChecker(): void {
  const checkBtn = document.getElementById('check-for-updates-btn');
  const updateStatus = document.getElementById('update-status');

  checkBtn?.addEventListener('click', async () => {
    if (!updateStatus) return;

    // Show checking state
    checkBtn.setAttribute('disabled', 'true');
    checkBtn.textContent = 'Checking...';
    updateStatus.classList.remove('hidden');
    updateStatus.innerHTML = `
      <div class="flex items-center gap-2 text-xs text-info">
        <span class="loading loading-spinner loading-xs"></span>
        Checking for updates...
      </div>
    `;

    try {
      const info = await invoke<UpdateInfo>('check_for_update');

      if (info.available && info.version) {
        updateStatus.innerHTML = `
          <div class="bg-info/10 rounded-lg p-3 text-sm">
            <div class="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-info">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span class="font-medium text-info">Update available: v${escapeHtmlSimple(info.version)}</span>
            </div>
            ${info.body ? `<p class="text-xs text-base-content/70 mb-2 whitespace-pre-line">${escapeHtmlSimple(info.body)}</p>` : ''}
            <button class="btn btn-info btn-sm" id="install-update-btn">Download &amp; Install</button>
          </div>
        `;

        // Wire up install button
        const installBtn = document.getElementById('install-update-btn');
        installBtn?.addEventListener('click', async () => {
          installBtn.setAttribute('disabled', 'true');
          installBtn.innerHTML = `
            <span class="loading loading-spinner loading-sm"></span>
            Downloading...
          `;
          try {
            await invoke('download_and_install_update');
            installBtn.innerHTML = 'Opening installer...';
          } catch (error) {
            logger.error('Failed to download update', LOG_CONTEXT, error);
            installBtn.removeAttribute('disabled');
            installBtn.textContent = 'Retry Download';
            await showAlert('Failed to download update: ' + error, { title: 'Update Error', type: 'error' });
          }
        });
      } else {
        updateStatus.innerHTML = `
          <div class="flex items-center gap-2 text-xs text-success">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            You're running the latest version (v${escapeHtmlSimple(info.current_version)})
          </div>
        `;
      }
    } catch (error) {
      logger.error('Failed to check for updates', LOG_CONTEXT, error);
      updateStatus.innerHTML = `
        <div class="flex items-center gap-2 text-xs text-error">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          Failed to check for updates
        </div>
      `;
    } finally {
      checkBtn.removeAttribute('disabled');
      checkBtn.textContent = 'Check for Updates';
    }
  });
}

/**
 * Initialize settings window
 */
async function init(): Promise<void> {
  logger.info('Initializing settings window...', LOG_CONTEXT);

  // Apply theme
  applyTheme();

  // Listen for theme changes from other windows
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === THEME_KEY && e.newValue) {
      document.documentElement.setAttribute('data-theme', e.newValue);
      // Update the theme select dropdown to match
      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
      if (themeSelect) {
        themeSelect.value = e.newValue;
      }
    }
  });

  // Setup event handlers
  setupEventHandlers();

  // Load app info
  await loadAppInfo();

  // Load hotkey settings
  await loadHotkeySettings();

  // Load backups list
  await loadBackupsList();

  // Check auto-backup password status
  await checkAutoBackupPasswordStatus();

  // Load backup location
  await loadBackupLocation();

  // Load deleted notes count for database maintenance section
  await loadDeletedNotesCount();

  // Show window after content is loaded to prevent white flash
  try {
    await currentWindow.show();
    await currentWindow.setFocus();
    logger.debug('Settings window shown and focused', LOG_CONTEXT);
  } catch (e) {
    logger.error('Failed to show settings window', LOG_CONTEXT, e);
  }

  logger.info('Settings window initialized', LOG_CONTEXT);
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for inline onclick handlers (legacy, may not be needed)
(window as any).restoreBackup = async (backupId: string) => {
  const password = await showPrompt('Enter backup password:', {
    title: 'Restore Backup',
    input: { type: 'password', placeholder: 'Backup password' }
  });
  if (!password) return;

  try {
    await invoke('restore_backup', { backupPath: backupId, password });
    await showAlert('Backup restored successfully. The application will now restart.', { title: 'Backup Restored', type: 'success' });
    await invoke('restart_app');
  } catch (error) {
    logger.error('Failed to restore backup', LOG_CONTEXT, error);
    await showAlert('Failed to restore backup: ' + error, { title: 'Restore Error', type: 'error' });
  }
};

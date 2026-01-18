/**
 * Settings Window
 * Manages application settings with persistent storage
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { AppInfo } from './types';

const THEME_KEY = 'swatnotes-theme';
const SETTINGS_KEY = 'swatnotes-settings';

interface AppSettings {
  startHidden: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  autoSaveDelay: number;
  autoBackupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupRetention: number;
}

const defaultSettings: AppSettings = {
  startHidden: false,
  minimizeToTray: true,
  closeToTray: true,
  autoSaveDelay: 1000,
  autoBackupEnabled: false,
  backupFrequency: 'weekly',
  backupRetention: 30,
};

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
      console.error('Failed to parse settings:', e);
    }
  }
  return defaultSettings;
}

/**
 * Save settings
 */
function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  console.log('Settings saved:', settings);
}

/**
 * Load app info
 */
async function loadAppInfo(): Promise<void> {
  try {
    const info = await invoke<AppInfo>('get_app_info');
    const versionEl = document.getElementById('app-version');
    if (versionEl) {
      versionEl.textContent = info.version;
    }

    // Store data dir for open button
    const openDataDirBtn = document.getElementById('open-data-dir-btn');
    if (openDataDirBtn) {
      openDataDirBtn.setAttribute('data-dir', info.app_data_dir);
    }
  } catch (error) {
    console.error('Failed to load app info:', error);
  }
}

/**
 * Load backups list
 */
async function loadBackupsList(): Promise<void> {
  try {
    const backups = await invoke<any[]>('list_backups');
    const backupsList = document.getElementById('backups-list');

    if (!backupsList) return;

    if (backups.length === 0) {
      backupsList.innerHTML = '<div class="text-base-content/50 text-sm text-center py-4">No backups found</div>';
      return;
    }

    backupsList.innerHTML = backups.map(backup => `
      <div class="bg-base-200 rounded-lg p-3 flex justify-between items-center">
        <div>
          <div class="text-base-content font-medium">${new Date(backup.created_at).toLocaleString()}</div>
          <div class="text-base-content/50 text-sm">${formatFileSize(backup.file_size)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="restoreBackup('${backup.id}')">
          Restore
        </button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load backups:', error);
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

  // Start hidden checkbox
  const startHiddenCheckbox = document.getElementById('start-hidden-checkbox') as HTMLInputElement;
  if (startHiddenCheckbox) {
    startHiddenCheckbox.checked = settings.startHidden;
    startHiddenCheckbox.addEventListener('change', () => {
      settings.startHidden = startHiddenCheckbox.checked;
      saveSettings(settings);
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

  // Auto backup enabled checkbox
  const autoBackupEnabledCheckbox = document.getElementById('auto-backup-enabled-checkbox') as HTMLInputElement;
  if (autoBackupEnabledCheckbox) {
    autoBackupEnabledCheckbox.checked = settings.autoBackupEnabled;
    autoBackupEnabledCheckbox.addEventListener('change', () => {
      settings.autoBackupEnabled = autoBackupEnabledCheckbox.checked;
      saveSettings(settings);
    });
  }

  // Backup frequency select
  const backupFrequencySelect = document.getElementById('backup-frequency-select') as HTMLSelectElement;
  if (backupFrequencySelect) {
    backupFrequencySelect.value = settings.backupFrequency;
    backupFrequencySelect.addEventListener('change', () => {
      settings.backupFrequency = backupFrequencySelect.value as 'daily' | 'weekly' | 'monthly';
      saveSettings(settings);
    });
  }

  // Backup retention select
  const backupRetentionSelect = document.getElementById('backup-retention-select') as HTMLSelectElement;
  if (backupRetentionSelect) {
    backupRetentionSelect.value = settings.backupRetention.toString();
    backupRetentionSelect.addEventListener('change', () => {
      settings.backupRetention = parseInt(backupRetentionSelect.value, 10);
      saveSettings(settings);
    });
  }

  // Create backup button
  const createBackupBtn = document.getElementById('create-backup-btn');
  const backupPasswordInput = document.getElementById('backup-password-input') as HTMLInputElement;

  createBackupBtn?.addEventListener('click', async () => {
    const password = backupPasswordInput?.value || '';

    if (!password) {
      alert('Please enter a backup password');
      return;
    }

    try {
      createBackupBtn.setAttribute('disabled', 'true');
      createBackupBtn.textContent = 'Creating backup...';

      const backupPath = await invoke<string>('create_backup', { password });

      alert(`Backup created successfully:\n${backupPath}`);

      // Clear password
      if (backupPasswordInput) {
        backupPasswordInput.value = '';
      }

      // Reload backups list
      await loadBackupsList();
    } catch (error) {
      console.error('Failed to create backup:', error);
      alert('Failed to create backup: ' + error);
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
        await invoke('plugin:shell|open', { path: dataDir });
      } catch (error) {
        console.error('Failed to open data directory:', error);
        alert('Failed to open data directory: ' + error);
      }
    }
  });
}

/**
 * Initialize settings window
 */
async function init(): Promise<void> {
  console.log('Initializing settings window...');

  // Apply theme
  applyTheme();

  // Setup event handlers
  setupEventHandlers();

  // Load app info
  await loadAppInfo();

  // Load backups list
  await loadBackupsList();

  console.log('Settings window initialized');
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for inline onclick handlers
(window as any).restoreBackup = async (backupId: string) => {
  const password = prompt('Enter backup password:');
  if (!password) return;

  try {
    await invoke('restore_backup', { backupPath: backupId, password });
    alert('Backup restored successfully. Please restart the application.');
  } catch (error) {
    console.error('Failed to restore backup:', error);
    alert('Failed to restore backup: ' + error);
  }
};

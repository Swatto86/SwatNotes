/**
 * Settings Management
 * Handles application settings persistence using localStorage
 */

export interface AppSettings {
  // Behavior
  startHidden: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;

  // Auto-save
  autoSaveDelay: number;

  // Automatic backups
  autoBackupEnabled: boolean;
  backupFrequency: 'hourly' | 'daily' | 'weekly';
  backupRetentionDays: number;
}

const SETTINGS_KEY = 'swatnotes-settings';

const DEFAULT_SETTINGS: AppSettings = {
  startHidden: true,
  minimizeToTray: true,
  closeToTray: true,
  autoSaveDelay: 1000,
  autoBackupEnabled: false,
  backupFrequency: 'daily',
  backupRetentionDays: 30,
};

/**
 * Load settings from localStorage
 */
export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    console.log('Settings saved:', settings);
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

/**
 * Get a specific setting value
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settings = loadSettings();
  return settings[key];
}

/**
 * Set a specific setting value
 */
export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): AppSettings {
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

/**
 * Tests for settings utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger before importing settings
vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('settings', () => {
  // Create fresh storage for each test
  let mockStorage: { [key: string]: string };

  beforeEach(async () => {
    // Reset modules to get fresh state
    vi.resetModules();

    // Create fresh mock storage
    mockStorage = {};

    // Mock localStorage with fresh storage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
      })
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('loadSettings', () => {
    it('should return default settings when no settings stored', async () => {
      const { loadSettings } = await import('./settings');
      const settings = loadSettings();

      expect(settings.startHidden).toBe(true);
      expect(settings.minimizeToTray).toBe(true);
      expect(settings.closeToTray).toBe(true);
      expect(settings.autoSaveDelay).toBe(1000);
      expect(settings.autoBackupEnabled).toBe(false);
      expect(settings.backupFrequency).toBe('daily');
      expect(settings.backupRetentionDays).toBe(30);
    });

    it('should load stored settings', async () => {
      const storedSettings = {
        startHidden: false,
        autoSaveDelay: 2000
      };
      mockStorage['swatnotes-settings'] = JSON.stringify(storedSettings);

      const { loadSettings } = await import('./settings');
      const settings = loadSettings();

      expect(settings.startHidden).toBe(false);
      expect(settings.autoSaveDelay).toBe(2000);
      expect(settings.minimizeToTray).toBe(true);
    });

    it('should merge stored settings with defaults', async () => {
      const partialSettings = {
        backupFrequency: 'hourly'
      };
      mockStorage['swatnotes-settings'] = JSON.stringify(partialSettings);

      const { loadSettings } = await import('./settings');
      const settings = loadSettings();

      expect(settings.backupFrequency).toBe('hourly');
      expect(settings.startHidden).toBe(true);
      expect(settings.autoSaveDelay).toBe(1000);
    });

    it('should handle corrupted JSON gracefully', async () => {
      mockStorage['swatnotes-settings'] = 'not valid json {{{';

      const { loadSettings } = await import('./settings');
      const settings = loadSettings();

      expect(settings.startHidden).toBe(true);
      expect(settings.autoSaveDelay).toBe(1000);
    });

    it('should handle empty stored value', async () => {
      mockStorage['swatnotes-settings'] = '';

      const { loadSettings } = await import('./settings');
      const settings = loadSettings();

      expect(settings.startHidden).toBe(true);
    });
  });

  describe('saveSettings', () => {
    it('should save settings to localStorage', async () => {
      const { saveSettings } = await import('./settings');
      const settings = {
        startHidden: false,
        minimizeToTray: false,
        closeToTray: true,
        autoSaveDelay: 500,
        autoBackupEnabled: true,
        backupFrequency: 'weekly' as const,
        backupRetentionDays: 60
      };

      saveSettings(settings);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'swatnotes-settings',
        JSON.stringify(settings)
      );
    });

    it('should persist settings correctly', async () => {
      const { saveSettings, loadSettings } = await import('./settings');
      const settings = {
        startHidden: true,
        minimizeToTray: true,
        closeToTray: false,
        autoSaveDelay: 1500,
        autoBackupEnabled: true,
        backupFrequency: 'hourly' as const,
        backupRetentionDays: 7
      };

      saveSettings(settings);

      const loaded = loadSettings();
      expect(loaded).toEqual(settings);
    });
  });

  describe('getSetting', () => {
    it('should get a specific setting value', async () => {
      const settings = {
        startHidden: false,
        minimizeToTray: true,
        closeToTray: true,
        autoSaveDelay: 3000,
        autoBackupEnabled: true,
        backupFrequency: 'weekly',
        backupRetentionDays: 14
      };
      mockStorage['swatnotes-settings'] = JSON.stringify(settings);

      const { getSetting } = await import('./settings');

      expect(getSetting('startHidden')).toBe(false);
      expect(getSetting('autoSaveDelay')).toBe(3000);
      expect(getSetting('backupFrequency')).toBe('weekly');
    });

    it('should return default value for unstored setting', async () => {
      const { getSetting } = await import('./settings');

      expect(getSetting('autoSaveDelay')).toBe(1000);
      expect(getSetting('startHidden')).toBe(true);
    });
  });

  describe('setSetting', () => {
    it('should update a single setting', async () => {
      const { setSetting, loadSettings } = await import('./settings');

      setSetting('autoSaveDelay', 2500);

      const settings = loadSettings();
      expect(settings.autoSaveDelay).toBe(2500);
      expect(settings.startHidden).toBe(true);
    });

    it('should preserve other settings when updating one', async () => {
      const { saveSettings, setSetting, loadSettings } = await import('./settings');

      const initial = {
        startHidden: false,
        minimizeToTray: false,
        closeToTray: false,
        autoSaveDelay: 500,
        autoBackupEnabled: true,
        backupFrequency: 'hourly' as const,
        backupRetentionDays: 7
      };
      saveSettings(initial);

      setSetting('backupRetentionDays', 30);

      const updated = loadSettings();
      expect(updated.startHidden).toBe(false);
      expect(updated.backupFrequency).toBe('hourly');
      expect(updated.backupRetentionDays).toBe(30);
    });

    it('should update boolean settings', async () => {
      const { setSetting, getSetting } = await import('./settings');

      setSetting('startHidden', false);
      expect(getSetting('startHidden')).toBe(false);

      setSetting('startHidden', true);
      expect(getSetting('startHidden')).toBe(true);
    });

    it('should update backup frequency enum', async () => {
      const { setSetting, getSetting } = await import('./settings');

      setSetting('backupFrequency', 'hourly');
      expect(getSetting('backupFrequency')).toBe('hourly');

      setSetting('backupFrequency', 'weekly');
      expect(getSetting('backupFrequency')).toBe('weekly');
    });
  });

  describe('resetSettings', () => {
    it('should reset all settings to defaults', async () => {
      const { saveSettings, resetSettings } = await import('./settings');

      saveSettings({
        startHidden: false,
        minimizeToTray: false,
        closeToTray: false,
        autoSaveDelay: 5000,
        autoBackupEnabled: true,
        backupFrequency: 'hourly',
        backupRetentionDays: 365
      });

      const reset = resetSettings();

      expect(reset.startHidden).toBe(true);
      expect(reset.minimizeToTray).toBe(true);
      expect(reset.closeToTray).toBe(true);
      expect(reset.autoSaveDelay).toBe(1000);
      expect(reset.autoBackupEnabled).toBe(false);
      expect(reset.backupFrequency).toBe('daily');
      expect(reset.backupRetentionDays).toBe(30);
    });

    it('should return the default settings', async () => {
      const { resetSettings } = await import('./settings');

      const defaults = resetSettings();

      expect(defaults).toEqual({
        startHidden: true,
        minimizeToTray: true,
        closeToTray: true,
        autoSaveDelay: 1000,
        autoBackupEnabled: false,
        backupFrequency: 'daily',
        backupRetentionDays: 30
      });
    });

    it('should persist reset settings', async () => {
      const { saveSettings, resetSettings, loadSettings } = await import('./settings');

      saveSettings({
        startHidden: false,
        minimizeToTray: false,
        closeToTray: false,
        autoSaveDelay: 9999,
        autoBackupEnabled: true,
        backupFrequency: 'weekly',
        backupRetentionDays: 1
      });

      resetSettings();

      const loaded = loadSettings();
      expect(loaded.autoSaveDelay).toBe(1000);
    });
  });

  describe('edge cases', () => {
    it('should handle localStorage quota exceeded', async () => {
      const { saveSettings, loadSettings } = await import('./settings');

      vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => saveSettings(loadSettings())).not.toThrow();
    });

    it('should handle localStorage getItem error', async () => {
      vi.mocked(localStorage.getItem).mockImplementationOnce(() => {
        throw new Error('localStorage is not available');
      });

      const { loadSettings } = await import('./settings');
      const settings = loadSettings();

      expect(settings.startHidden).toBe(true);
    });
  });
});

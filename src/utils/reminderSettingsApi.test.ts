/**
 * Tests for reminderSettingsApi
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  getReminderSettings,
  updateReminderSettings,
  getDefaultReminderSettings,
} from './reminderSettingsApi';
import type { ReminderSettings } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('reminderSettingsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getReminderSettings', () => {
    it('should get current reminder settings', async () => {
      const mockSettings: ReminderSettings = {
        sound_enabled: true,
        sound_frequency: 880,
        sound_duration: 500,
        shake_enabled: true,
        shake_duration: 600,
        glow_enabled: true,
        sound_type: 'whoosh',
      };

      vi.mocked(invoke).mockResolvedValue(mockSettings);

      const result = await getReminderSettings();

      expect(invoke).toHaveBeenCalledWith('get_reminder_settings');
      expect(result).toEqual(mockSettings);
    });

    it('should return settings with sound disabled', async () => {
      const mockSettings: ReminderSettings = {
        sound_enabled: false,
        sound_frequency: 440,
        sound_duration: 1000,
        shake_enabled: true,
        shake_duration: 800,
        glow_enabled: false,
        sound_type: 'whoosh',
      };

      vi.mocked(invoke).mockResolvedValue(mockSettings);

      const result = await getReminderSettings();

      expect(result.sound_enabled).toBe(false);
      expect(result.sound_frequency).toBe(440);
      expect(result.glow_enabled).toBe(false);
    });
  });

  describe('updateReminderSettings', () => {
    it('should update reminder settings', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const newSettings: ReminderSettings = {
        sound_enabled: false,
        sound_frequency: 660,
        sound_duration: 750,
        shake_enabled: true,
        shake_duration: 400,
        glow_enabled: true,
        sound_type: 'whoosh',
      };

      await updateReminderSettings(newSettings);

      expect(invoke).toHaveBeenCalledWith('update_reminder_settings', {
        settings: newSettings,
      });
    });

    it('should handle update errors', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Failed to save settings'));

      const settings: ReminderSettings = {
        sound_enabled: true,
        sound_frequency: 880,
        sound_duration: 500,
        shake_enabled: true,
        shake_duration: 600,
        glow_enabled: true,
        sound_type: 'whoosh',
      };

      await expect(updateReminderSettings(settings)).rejects.toThrow('Failed to save settings');
    });
  });

  describe('getDefaultReminderSettings', () => {
    it('should return default settings', () => {
      const defaults = getDefaultReminderSettings();

      expect(defaults.sound_enabled).toBe(true);
      expect(defaults.sound_frequency).toBe(880);
      expect(defaults.sound_duration).toBe(500);
      expect(defaults.shake_enabled).toBe(true);
      expect(defaults.shake_duration).toBe(600);
      expect(defaults.glow_enabled).toBe(true);
      expect(defaults.sound_type).toBe('whoosh');
    });

    it('should return a new object each time', () => {
      const defaults1 = getDefaultReminderSettings();
      const defaults2 = getDefaultReminderSettings();

      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });
  });

  describe('settings validation', () => {
    it('should accept valid frequency values', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const settings: ReminderSettings = {
        sound_enabled: true,
        sound_frequency: 200, // minimum valid
        sound_duration: 500,
        shake_enabled: true,
        shake_duration: 600,
        glow_enabled: true,
        sound_type: 'whoosh',
      };

      await expect(updateReminderSettings(settings)).resolves.toBeUndefined();
    });

    it('should accept valid duration values', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const settings: ReminderSettings = {
        sound_enabled: true,
        sound_frequency: 880,
        sound_duration: 100, // minimum valid
        shake_enabled: true,
        shake_duration: 200, // minimum valid
        glow_enabled: true,
        sound_type: 'whoosh',
      };

      await expect(updateReminderSettings(settings)).resolves.toBeUndefined();
    });
  });
});

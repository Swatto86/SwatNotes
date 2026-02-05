/**
 * Reminder Settings API
 * Wraps Tauri commands for managing reminder notification settings
 */

import { invoke } from '@tauri-apps/api/core';
import type { ReminderSettings } from '../types';

/**
 * Get the current reminder notification settings
 */
export async function getReminderSettings(): Promise<ReminderSettings> {
  return invoke<ReminderSettings>('get_reminder_settings');
}

/**
 * Update reminder notification settings
 */
export async function updateReminderSettings(settings: ReminderSettings): Promise<void> {
  return invoke('update_reminder_settings', { settings });
}

/**
 * Get default reminder settings
 */
export function getDefaultReminderSettings(): ReminderSettings {
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

/**
 * Reminders API Module
 * Wraps Tauri commands for reminder operations
 */

import { invoke } from '@tauri-apps/api/core';
import type { Reminder, ReminderCreateSettings } from '../types';

/**
 * Create a new reminder for a note
 * @param noteId - Note ID to attach reminder to
 * @param triggerTime - When to trigger the reminder
 * @param settings - Optional per-reminder notification settings
 * @returns Promise resolving to the created reminder
 */
export async function createReminder(
  noteId: string,
  triggerTime: Date,
  settings?: ReminderCreateSettings
): Promise<Reminder> {
  const triggerTimeStr = triggerTime.toISOString();
  return await invoke('create_reminder', {
    noteId,
    triggerTime: triggerTimeStr,
    soundEnabled: settings?.sound_enabled ?? null,
    soundType: settings?.sound_type ?? null,
    shakeEnabled: settings?.shake_enabled ?? null,
    glowEnabled: settings?.glow_enabled ?? null,
  });
}

/**
 * List all active reminders (not yet triggered)
 * @returns Promise resolving to array of active reminders
 */
export async function listActiveReminders(): Promise<Reminder[]> {
  return await invoke('list_active_reminders');
}

/**
 * Delete a reminder
 * @param id - Reminder ID to delete
 * @returns Promise resolving when deletion is complete
 */
export async function deleteReminder(id: string): Promise<void> {
  return await invoke('delete_reminder', { id });
}

/**
 * Update an existing reminder
 * @param id - Reminder ID to update
 * @param triggerTime - New trigger time
 * @param settings - Optional updated notification settings
 * @returns Promise resolving to the updated reminder
 */
export async function updateReminder(
  id: string,
  triggerTime: Date,
  settings?: ReminderCreateSettings
): Promise<Reminder> {
  const triggerTimeStr = triggerTime.toISOString();
  return await invoke('update_reminder', {
    id,
    triggerTime: triggerTimeStr,
    soundEnabled: settings?.sound_enabled ?? null,
    soundType: settings?.sound_type ?? null,
    shakeEnabled: settings?.shake_enabled ?? null,
    glowEnabled: settings?.glow_enabled ?? null,
  });
}

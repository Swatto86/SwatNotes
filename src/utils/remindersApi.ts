/**
 * Reminders API Module
 * Wraps Tauri commands for reminder operations
 */

import { invoke } from '@tauri-apps/api/core';
import type { Reminder } from '../types';

/**
 * Create a new reminder for a note
 * @param noteId - Note ID to attach reminder to
 * @param triggerTime - When to trigger the reminder
 * @returns Promise resolving to the created reminder
 */
export async function createReminder(noteId: string, triggerTime: Date): Promise<Reminder> {
  const triggerTimeStr = triggerTime.toISOString();
  return await invoke('create_reminder', { noteId, triggerTime: triggerTimeStr });
}

/**
 * List all active reminders (not yet triggered)
 * @returns Promise resolving to array of active reminders
 */
export async function listActiveReminders(): Promise<Reminder[]> {
  return await invoke('list_active_reminders');
}

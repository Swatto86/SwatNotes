// Reminders API - wraps Tauri commands for reminder operations

import { invoke } from '@tauri-apps/api/core';

/**
 * Create a new reminder for a note
 * @param {string} noteId - Note ID to attach reminder to
 * @param {Date} triggerTime - When to trigger the reminder
 * @returns {Promise<Reminder>}
 */
export async function createReminder(noteId, triggerTime) {
  const triggerTimeStr = triggerTime.toISOString();
  return await invoke('create_reminder', { noteId, triggerTime: triggerTimeStr });
}

/**
 * List all active reminders (not yet triggered)
 * @returns {Promise<Reminder[]>}
 */
export async function listActiveReminders() {
  return await invoke('list_active_reminders');
}

/**
 * @typedef {Object} Reminder
 * @property {string} id
 * @property {string} note_id
 * @property {string} trigger_time - ISO 8601 datetime string
 * @property {number} triggered - 0 for not triggered, 1 for triggered
 * @property {string} created_at
 */

// Backup API - wraps Tauri commands for backup operations

import { invoke } from '@tauri-apps/api/core';

/**
 * Create a backup now
 * @returns {Promise<string>} Backup file path
 */
export async function createBackup() {
  return await invoke('create_backup');
}

/**
 * List all backups
 * @returns {Promise<Backup[]>}
 */
export async function listBackups() {
  return await invoke('list_backups');
}

/**
 * @typedef {Object} Backup
 * @property {string} id
 * @property {string} timestamp
 * @property {string} path
 * @property {number} size
 * @property {string} manifest_hash
 */

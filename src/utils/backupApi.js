// Backup API - wraps Tauri commands for backup operations

import { invoke } from '@tauri-apps/api/core';

/**
 * Create a backup now
 * @param {string} password - Password to encrypt the backup
 * @returns {Promise<string>} Backup file path
 */
export async function createBackup(password) {
  return await invoke('create_backup', { password });
}

/**
 * List all backups
 * @returns {Promise<Backup[]>}
 */
export async function listBackups() {
  return await invoke('list_backups');
}

/**
 * Restore from a backup
 * @param {string} backupPath - Path to the backup file
 * @param {string} password - Password to decrypt the backup
 * @returns {Promise<void>}
 */
export async function restoreBackup(backupPath, password) {
  return await invoke('restore_backup', { backupPath, password });
}

/**
 * @typedef {Object} Backup
 * @property {string} id
 * @property {string} timestamp
 * @property {string} path
 * @property {number} size
 * @property {string} manifest_hash
 */

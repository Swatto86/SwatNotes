/**
 * Backup API Module
 * Wraps Tauri commands for backup operations
 */

import { invoke } from '@tauri-apps/api/core';
import type { Backup } from '../types';

/**
 * Create a backup now
 * @param password - Password to encrypt the backup
 * @returns Promise resolving to the backup file path
 */
export async function createBackup(password: string): Promise<string> {
  return await invoke('create_backup', { password });
}

/**
 * List all backups
 * @returns Promise resolving to array of backups
 */
export async function listBackups(): Promise<Backup[]> {
  return await invoke('list_backups');
}

/**
 * Restore from a backup
 * @param backupPath - Path to the backup file
 * @param password - Password to decrypt the backup
 * @returns Promise resolving when restore is complete
 */
export async function restoreBackup(backupPath: string, password: string): Promise<void> {
  return await invoke('restore_backup', { backupPath, password });
}

/**
 * Delete a backup
 * @param backupId - ID of the backup to delete
 * @param backupPath - Path to the backup file
 * @returns Promise resolving when deletion is complete
 */
export async function deleteBackup(backupId: string, backupPath: string): Promise<void> {
  return await invoke('delete_backup', { backupId, backupPath });
}

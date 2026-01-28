/**
 * Update API utilities for SwatNotes
 * Handles checking for and installing application updates
 */

import { invoke } from '@tauri-apps/api/core';
import type { UpdateInfo } from '../types';

/**
 * Check if an update is available
 * @returns UpdateInfo containing version information and availability status
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  return invoke<UpdateInfo>('check_for_update');
}

/**
 * Download and install an available update
 * The application will need to restart after the update is installed
 */
export async function downloadAndInstallUpdate(): Promise<void> {
  return invoke('download_and_install_update');
}

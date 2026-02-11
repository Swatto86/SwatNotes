/**
 * Tests for updateApi
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { checkForUpdate, downloadAndInstallUpdate } from './updateApi';
import type { UpdateInfo } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('updateApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkForUpdate', () => {
    it('should return update info when update is available', async () => {
      const mockUpdateInfo: UpdateInfo = {
        available: true,
        current_version: '1.0.0',
        version: '1.1.0',
        body: 'Bug fixes and improvements',
        release_url: null,
        installer_url: null,
      };
      vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);

      const result = await checkForUpdate();

      expect(invoke).toHaveBeenCalledWith('check_for_update');
      expect(result.available).toBe(true);
      expect(result.current_version).toBe('1.0.0');
      expect(result.version).toBe('1.1.0');
    });

    it('should return update info when no update is available', async () => {
      const mockUpdateInfo: UpdateInfo = {
        available: false,
        current_version: '1.1.0',
        version: '1.1.0',
        body: null,
        release_url: null,
        installer_url: null,
      };
      vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);

      const result = await checkForUpdate();

      expect(result.available).toBe(false);
      expect(result.current_version).toBe(result.version);
    });

    it('should handle network error during update check', async () => {
      vi.mocked(invoke).mockRejectedValue(
        new Error('Network error: Unable to reach update server')
      );

      await expect(checkForUpdate()).rejects.toThrow('Network error');
    });

    it('should handle server unavailable', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Update server unavailable'));

      await expect(checkForUpdate()).rejects.toThrow('Update server unavailable');
    });

    it('should handle malformed response', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Invalid update response'));

      await expect(checkForUpdate()).rejects.toThrow('Invalid update response');
    });
  });

  describe('downloadAndInstallUpdate', () => {
    it('should download and install update successfully', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await downloadAndInstallUpdate();

      expect(invoke).toHaveBeenCalledWith('download_and_install_update');
    });

    it('should handle download failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Download failed: insufficient disk space'));

      await expect(downloadAndInstallUpdate()).rejects.toThrow('Download failed');
    });

    it('should handle installation failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Installation failed: permission denied'));

      await expect(downloadAndInstallUpdate()).rejects.toThrow('Installation failed');
    });

    it('should handle signature verification failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Update signature verification failed'));

      await expect(downloadAndInstallUpdate()).rejects.toThrow('signature verification');
    });

    it('should handle cancelled update', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Update cancelled by user'));

      await expect(downloadAndInstallUpdate()).rejects.toThrow('cancelled');
    });
  });

  describe('update workflow', () => {
    it('should complete full update flow', async () => {
      // Step 1: Check for update
      const mockUpdateInfo: UpdateInfo = {
        available: true,
        current_version: '1.0.0',
        version: '2.0.0',
        body: 'Major update with new features',
        release_url: null,
        installer_url: null,
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockUpdateInfo);

      const updateInfo = await checkForUpdate();
      expect(updateInfo.available).toBe(true);

      // Step 2: Download and install
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await downloadAndInstallUpdate();

      expect(invoke).toHaveBeenCalledTimes(2);
    });

    it('should skip download when no update available', async () => {
      const mockUpdateInfo: UpdateInfo = {
        available: false,
        current_version: '2.0.0',
        version: '2.0.0',
        body: null,
        release_url: null,
        installer_url: null,
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockUpdateInfo);

      const updateInfo = await checkForUpdate();

      // Should not attempt download
      expect(updateInfo.available).toBe(false);
      expect(invoke).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Tests for backupApi
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createBackup, listBackups, restoreBackup, deleteBackup } from './backupApi';
import type { Backup } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('backupApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create a backup with password and return the path', async () => {
      const mockPath = '/path/to/backup/swatnotes_backup_2024-01-01.zip';
      vi.mocked(invoke).mockResolvedValue(mockPath);

      const result = await createBackup('mySecurePassword123');

      expect(invoke).toHaveBeenCalledWith('create_backup', { password: 'mySecurePassword123' });
      expect(result).toBe(mockPath);
    });

    it('should handle backup creation errors', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Backup failed: disk full'));

      await expect(createBackup('password')).rejects.toThrow('Backup failed: disk full');
    });

    it('should handle empty password', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Password required'));

      await expect(createBackup('')).rejects.toThrow('Password required');
    });
  });

  describe('listBackups', () => {
    it('should return list of backups', async () => {
      const mockBackups: Backup[] = [
        {
          id: 'backup-1',
          timestamp: '2024-01-01T10:00:00Z',
          path: '/backups/backup1.zip',
          size: 1024000,
          manifest_hash: 'abc123',
        },
        {
          id: 'backup-2',
          timestamp: '2024-01-02T10:00:00Z',
          path: '/backups/backup2.zip',
          size: 2048000,
          manifest_hash: 'def456',
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockBackups);

      const result = await listBackups();

      expect(invoke).toHaveBeenCalledWith('list_backups');
      expect(result).toEqual(mockBackups);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no backups exist', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await listBackups();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle list errors', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Database error'));

      await expect(listBackups()).rejects.toThrow('Database error');
    });
  });

  describe('restoreBackup', () => {
    it('should restore backup with correct parameters', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await restoreBackup('/path/to/backup.zip', 'password123');

      expect(invoke).toHaveBeenCalledWith('restore_backup', {
        backupPath: '/path/to/backup.zip',
        password: 'password123',
      });
    });

    it('should handle incorrect password', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Invalid password'));

      await expect(restoreBackup('/backup.zip', 'wrongpass')).rejects.toThrow('Invalid password');
    });

    it('should handle missing backup file', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Backup file not found'));

      await expect(restoreBackup('/nonexistent.zip', 'password')).rejects.toThrow(
        'Backup file not found'
      );
    });

    it('should handle corrupted backup', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Backup corrupted or invalid format'));

      await expect(restoreBackup('/corrupted.zip', 'password')).rejects.toThrow('Backup corrupted');
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup by id and path', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await deleteBackup('backup-123', '/path/to/backup.zip');

      expect(invoke).toHaveBeenCalledWith('delete_backup', {
        backupId: 'backup-123',
        backupPath: '/path/to/backup.zip',
      });
    });

    it('should handle delete errors', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Permission denied'));

      await expect(deleteBackup('backup-123', '/backup.zip')).rejects.toThrow('Permission denied');
    });

    it('should handle non-existent backup deletion', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Backup not found'));

      await expect(deleteBackup('nonexistent', '/missing.zip')).rejects.toThrow('Backup not found');
    });
  });

  describe('integration scenarios', () => {
    it('should handle backup lifecycle: create, list, delete', async () => {
      const mockPath = '/backups/new_backup.zip';
      const mockBackup: Backup = {
        id: 'new-backup',
        timestamp: new Date().toISOString(),
        path: mockPath,
        size: 512000,
        manifest_hash: 'newhash',
      };

      // Create
      vi.mocked(invoke).mockResolvedValueOnce(mockPath);
      const createdPath = await createBackup('password');
      expect(createdPath).toBe(mockPath);

      // List
      vi.mocked(invoke).mockResolvedValueOnce([mockBackup]);
      const backups = await listBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].path).toBe(mockPath);

      // Delete
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await deleteBackup(mockBackup.id, mockBackup.path);
      expect(invoke).toHaveBeenLastCalledWith('delete_backup', {
        backupId: mockBackup.id,
        backupPath: mockBackup.path,
      });
    });
  });
});

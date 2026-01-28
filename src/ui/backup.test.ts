/**
 * Tests for backup UI module
 *
 * These tests focus on the backup API interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createBackup, listBackups, restoreBackup, deleteBackup } from '../utils/backupApi';
import type { Backup } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('backup UI integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('backup creation workflow', () => {
    it('should create backup successfully', async () => {
      vi.mocked(invoke).mockResolvedValue('/backups/backup.zip');

      const path = await createBackup('password123');

      expect(invoke).toHaveBeenCalledWith('create_backup', { password: 'password123' });
      expect(path).toBe('/backups/backup.zip');
    });

    it('should handle backup creation error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Disk full'));

      await expect(createBackup('password')).rejects.toThrow('Disk full');
    });
  });

  describe('backup listing workflow', () => {
    it('should list all backups', async () => {
      const mockBackups: Backup[] = [
        {
          id: 'backup-1',
          timestamp: '2024-01-15T10:00:00Z',
          path: '/backups/backup1.zip',
          size: 1024000,
          manifest_hash: 'abc123'
        },
        {
          id: 'backup-2',
          timestamp: '2024-01-10T10:00:00Z',
          path: '/backups/backup2.zip',
          size: 2048000,
          manifest_hash: 'def456'
        }
      ];
      vi.mocked(invoke).mockResolvedValue(mockBackups);

      const backups = await listBackups();

      expect(invoke).toHaveBeenCalledWith('list_backups');
      expect(backups).toHaveLength(2);
      expect(backups[0].id).toBe('backup-1');
    });

    it('should return empty array when no backups', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const backups = await listBackups();

      expect(backups).toEqual([]);
    });
  });

  describe('backup restore workflow', () => {
    it('should restore backup with password', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await restoreBackup('/backup.zip', 'correctPassword');

      expect(invoke).toHaveBeenCalledWith('restore_backup', {
        backupPath: '/backup.zip',
        password: 'correctPassword'
      });
    });

    it('should handle wrong password', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Invalid password'));

      await expect(restoreBackup('/backup.zip', 'wrong')).rejects.toThrow('Invalid password');
    });

    it('should handle missing backup file', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Backup file not found'));

      await expect(restoreBackup('/missing.zip', 'pass')).rejects.toThrow('Backup file not found');
    });
  });

  describe('backup deletion workflow', () => {
    it('should delete backup by id and path', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await deleteBackup('backup-123', '/backups/backup.zip');

      expect(invoke).toHaveBeenCalledWith('delete_backup', {
        backupId: 'backup-123',
        backupPath: '/backups/backup.zip'
      });
    });

    it('should handle delete error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Permission denied'));

      await expect(deleteBackup('id', '/path')).rejects.toThrow('Permission denied');
    });
  });

  describe('full backup lifecycle', () => {
    it('should perform complete backup and restore cycle', async () => {
      // 1. Create backup
      vi.mocked(invoke).mockResolvedValueOnce('/backups/new.zip');
      const backupPath = await createBackup('myPassword');
      expect(backupPath).toBe('/backups/new.zip');

      // 2. List backups to verify it exists
      const mockBackup: Backup = {
        id: 'new-backup',
        timestamp: new Date().toISOString(),
        path: backupPath,
        size: 512000,
        manifest_hash: 'hash123'
      };
      vi.mocked(invoke).mockResolvedValueOnce([mockBackup]);
      const backups = await listBackups();
      expect(backups).toHaveLength(1);

      // 3. Restore from backup
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await restoreBackup(backupPath, 'myPassword');

      // 4. Delete backup
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await deleteBackup(mockBackup.id, backupPath);

      expect(invoke).toHaveBeenCalledTimes(4);
    });
  });

  describe('edge cases', () => {
    it('should handle very large backup size', async () => {
      const largeBackup: Backup = {
        id: 'large',
        timestamp: '2024-01-01T00:00:00Z',
        path: '/large.zip',
        size: 10737418240, // 10 GB
        manifest_hash: 'hash'
      };
      vi.mocked(invoke).mockResolvedValue([largeBackup]);

      const backups = await listBackups();

      expect(backups[0].size).toBe(10737418240);
    });

    it('should handle special characters in path', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await restoreBackup('/path with spaces/backup (1).zip', 'pass');

      expect(invoke).toHaveBeenCalledWith('restore_backup', {
        backupPath: '/path with spaces/backup (1).zip',
        password: 'pass'
      });
    });

    it('should handle network timeout during backup', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Network timeout'));

      await expect(createBackup('pass')).rejects.toThrow('Network timeout');
    });
  });
});

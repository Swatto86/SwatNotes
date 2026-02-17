/**
 * Tests for remindersApi
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createReminder, listActiveReminders, deleteReminder } from './remindersApi';
import type { Reminder } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('remindersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReminder', () => {
    it('should create a reminder with trigger time', async () => {
      const triggerDate = new Date('2024-12-25T10:00:00Z');
      const mockReminder: Reminder = {
        id: 'reminder-id',
        note_id: 'note-id',
        trigger_time: triggerDate.toISOString(),
        triggered: false,
        created_at: '2024-01-01T00:00:00Z',
        sound_enabled: null,
        sound_type: null,
        shake_enabled: null,
        glow_enabled: null,
      };

      vi.mocked(invoke).mockResolvedValue(mockReminder);

      const result = await createReminder('note-id', triggerDate);

      expect(invoke).toHaveBeenCalledWith('create_reminder', {
        noteId: 'note-id',
        triggerTime: triggerDate.toISOString(),
        soundEnabled: null,
        soundType: null,
        shakeEnabled: null,
        glowEnabled: null,
      });
      expect(result).toEqual(mockReminder);
    });

    it('should handle past dates', async () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');
      vi.mocked(invoke).mockRejectedValue(new Error('Trigger time must be in the future'));

      await expect(createReminder('note-id', pastDate)).rejects.toThrow(
        'Trigger time must be in the future'
      );
    });
  });

  describe('listActiveReminders', () => {
    it('should list all active reminders', async () => {
      const mockReminders: Reminder[] = [
        {
          id: 'reminder-1',
          note_id: 'note-1',
          trigger_time: '2024-12-25T10:00:00Z',
          triggered: false,
          created_at: '2024-01-01T00:00:00Z',
          sound_enabled: null,
          sound_type: null,
          shake_enabled: null,
          glow_enabled: null,
        },
        {
          id: 'reminder-2',
          note_id: 'note-2',
          trigger_time: '2024-12-26T15:00:00Z',
          triggered: false,
          created_at: '2024-01-01T00:01:00Z',
          sound_enabled: null,
          sound_type: null,
          shake_enabled: null,
          glow_enabled: null,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockReminders);

      const result = await listActiveReminders();

      expect(invoke).toHaveBeenCalledWith('list_active_reminders');
      expect(result).toEqual(mockReminders);
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.triggered === false)).toBe(true);
    });

    it('should return empty array when no active reminders exist', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await listActiveReminders();

      expect(result).toEqual([]);
    });
  });

  describe('deleteReminder', () => {
    it('should delete reminder by id', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await deleteReminder('reminder-id');

      expect(invoke).toHaveBeenCalledWith('delete_reminder', { id: 'reminder-id' });
    });

    it('should handle non-existent reminder', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Reminder not found'));

      await expect(deleteReminder('non-existent')).rejects.toThrow('Reminder not found');
    });
  });
});

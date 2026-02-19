/**
 * Tests for notesApi
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createNote, updateNote, deleteNote, getNote, listNotes, searchNotes } from './notesApi';
import type { Note } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('notesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNote', () => {
    it('should create a note with provided title and content', async () => {
      const mockNote: Note = {
        id: 'test-id',
        title: 'Test Note',
        content_json: '{"ops":[]}',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
        title_modified: false,
        collection_id: null,
      };

      vi.mocked(invoke).mockResolvedValue(mockNote);

      const result = await createNote('Test Note', '{"ops":[]}');

      expect(invoke).toHaveBeenCalledWith('create_note', {
        title: 'Test Note',
        contentJson: '{"ops":[]}',
        collectionId: null,
      });
      expect(result).toEqual(mockNote);
    });

    it('should handle errors from backend', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Database error'));

      await expect(createNote('Test', '{}')).rejects.toThrow('Database error');
    });
  });

  describe('updateNote', () => {
    it('should update note with new title and content', async () => {
      const mockNote: Note = {
        id: 'test-id',
        title: 'Updated Note',
        content_json: '{"ops":[{"insert":"Updated"}]}',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:01:00Z',
        deleted_at: null,
        title_modified: false,
        collection_id: null,
      };

      vi.mocked(invoke).mockResolvedValue(mockNote);

      const result = await updateNote('test-id', 'Updated Note', '{"ops":[{"insert":"Updated"}]}');

      expect(invoke).toHaveBeenCalledWith('update_note', {
        id: 'test-id',
        title: 'Updated Note',
        contentJson: '{"ops":[{"insert":"Updated"}]}',
        titleModified: null,
      });
      expect(result).toEqual(mockNote);
    });
  });

  describe('deleteNote', () => {
    it('should delete note by id', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await deleteNote('test-id');

      expect(invoke).toHaveBeenCalledWith('delete_note', { id: 'test-id' });
    });
  });

  describe('getNote', () => {
    it('should retrieve note by id', async () => {
      const mockNote: Note = {
        id: 'test-id',
        title: 'Test Note',
        content_json: '{"ops":[]}',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
        title_modified: false,
        collection_id: null,
      };

      vi.mocked(invoke).mockResolvedValue(mockNote);

      const result = await getNote('test-id');

      expect(invoke).toHaveBeenCalledWith('get_note', { id: 'test-id' });
      expect(result).toEqual(mockNote);
    });
  });

  describe('listNotes', () => {
    it('should list all notes', async () => {
      const mockNotes: Note[] = [
        {
          id: 'note-1',
          title: 'Note 1',
          content_json: '{"ops":[]}',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          deleted_at: null,
          title_modified: false,
          collection_id: null,
        },
        {
          id: 'note-2',
          title: 'Note 2',
          content_json: '{"ops":[]}',
          created_at: '2024-01-01T00:01:00Z',
          updated_at: '2024-01-01T00:01:00Z',
          deleted_at: null,
          title_modified: false,
          collection_id: null,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockNotes);

      const result = await listNotes();

      expect(invoke).toHaveBeenCalledWith('list_notes');
      expect(result).toEqual(mockNotes);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no notes exist', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await listNotes();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('searchNotes', () => {
    it('should search notes with query', async () => {
      const mockNotes: Note[] = [
        {
          id: 'note-1',
          title: 'Important Meeting',
          content_json: '{"ops":[{"insert":"Discuss project"}]}',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          deleted_at: null,
          title_modified: false,
          collection_id: null,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockNotes);

      const result = await searchNotes('meeting');

      expect(invoke).toHaveBeenCalledWith('search_notes', { query: 'meeting' });
      expect(result).toEqual(mockNotes);
    });

    it('should return empty array when no matches found', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await searchNotes('nonexistent');

      expect(result).toEqual([]);
    });
  });
});

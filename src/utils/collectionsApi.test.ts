/**
 * Tests for collectionsApi
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  createCollection,
  getCollection,
  listCollections,
  updateCollection,
  deleteCollection,
  updateNoteCollection,
  listNotesInCollection,
  listUncategorizedNotes,
  countNotesInCollection,
  COLLECTION_COLORS,
} from './collectionsApi';
import type { Collection, Note } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock data factories
function createMockCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'collection-1',
    name: 'Test Collection',
    description: 'A test collection',
    color: '#3B82F6',
    icon: 'folder',
    sort_order: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Test Note',
    content_json: '{"ops":[{"insert":"Test content\\n"}]}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    title_modified: false,
    collection_id: null,
    ...overrides,
  };
}

describe('collectionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCollection', () => {
    it('should create collection with all parameters', async () => {
      const mockCollection = createMockCollection();
      vi.mocked(invoke).mockResolvedValue(mockCollection);

      const result = await createCollection('My Collection', 'Description', '#EF4444', 'star');

      expect(invoke).toHaveBeenCalledWith('create_collection', {
        name: 'My Collection',
        description: 'Description',
        color: '#EF4444',
        icon: 'star',
      });
      expect(result).toEqual(mockCollection);
    });

    it('should create collection with only required parameters', async () => {
      const mockCollection = createMockCollection({ name: 'Simple Collection' });
      vi.mocked(invoke).mockResolvedValue(mockCollection);

      const result = await createCollection('Simple Collection');

      expect(invoke).toHaveBeenCalledWith('create_collection', {
        name: 'Simple Collection',
        description: undefined,
        color: undefined,
        icon: undefined,
      });
      expect(result.name).toBe('Simple Collection');
    });

    it('should handle duplicate name error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Collection name already exists'));

      await expect(createCollection('Existing')).rejects.toThrow('Collection name already exists');
    });
  });

  describe('getCollection', () => {
    it('should get collection by id', async () => {
      const mockCollection = createMockCollection({ id: 'col-123' });
      vi.mocked(invoke).mockResolvedValue(mockCollection);

      const result = await getCollection('col-123');

      expect(invoke).toHaveBeenCalledWith('get_collection', { id: 'col-123' });
      expect(result).toEqual(mockCollection);
    });

    it('should handle collection not found', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Collection not found'));

      await expect(getCollection('nonexistent')).rejects.toThrow('Collection not found');
    });
  });

  describe('listCollections', () => {
    it('should list all collections', async () => {
      const mockCollections = [
        createMockCollection({ id: 'col-1', name: 'Work' }),
        createMockCollection({ id: 'col-2', name: 'Personal' }),
        createMockCollection({ id: 'col-3', name: 'Ideas' }),
      ];
      vi.mocked(invoke).mockResolvedValue(mockCollections);

      const result = await listCollections();

      expect(invoke).toHaveBeenCalledWith('list_collections');
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no collections', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await listCollections();

      expect(result).toEqual([]);
    });
  });

  describe('updateCollection', () => {
    it('should update collection with partial data', async () => {
      const mockCollection = createMockCollection({ name: 'Updated Name' });
      vi.mocked(invoke).mockResolvedValue(mockCollection);

      const result = await updateCollection('col-123', { name: 'Updated Name' });

      expect(invoke).toHaveBeenCalledWith('update_collection', {
        id: 'col-123',
        name: 'Updated Name',
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should update multiple fields', async () => {
      const mockCollection = createMockCollection({
        name: 'New Name',
        color: '#22C55E',
        description: 'New description',
      });
      vi.mocked(invoke).mockResolvedValue(mockCollection);

      await updateCollection('col-123', {
        name: 'New Name',
        color: '#22C55E',
        description: 'New description',
      });

      expect(invoke).toHaveBeenCalledWith('update_collection', {
        id: 'col-123',
        name: 'New Name',
        color: '#22C55E',
        description: 'New description',
      });
    });

    it('should update sort order', async () => {
      const mockCollection = createMockCollection({ sort_order: 5 });
      vi.mocked(invoke).mockResolvedValue(mockCollection);

      await updateCollection('col-123', { sort_order: 5 });

      expect(invoke).toHaveBeenCalledWith('update_collection', {
        id: 'col-123',
        sort_order: 5,
      });
    });
  });

  describe('deleteCollection', () => {
    it('should delete collection by id', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await deleteCollection('col-123');

      expect(invoke).toHaveBeenCalledWith('delete_collection', { id: 'col-123' });
    });

    it('should handle delete error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Cannot delete collection'));

      await expect(deleteCollection('col-123')).rejects.toThrow('Cannot delete collection');
    });
  });

  describe('updateNoteCollection', () => {
    it('should move note to a collection', async () => {
      const mockNote = createMockNote({ collection_id: 'col-123' });
      vi.mocked(invoke).mockResolvedValue(mockNote);

      const result = await updateNoteCollection('note-1', 'col-123');

      expect(invoke).toHaveBeenCalledWith('update_note_collection', {
        noteId: 'note-1',
        collectionId: 'col-123',
      });
      expect(result.collection_id).toBe('col-123');
    });

    it('should remove note from collection (set to null)', async () => {
      const mockNote = createMockNote({ collection_id: null });
      vi.mocked(invoke).mockResolvedValue(mockNote);

      const result = await updateNoteCollection('note-1', null);

      expect(invoke).toHaveBeenCalledWith('update_note_collection', {
        noteId: 'note-1',
        collectionId: null,
      });
      expect(result.collection_id).toBeNull();
    });
  });

  describe('listNotesInCollection', () => {
    it('should list notes in a collection', async () => {
      const mockNotes = [
        createMockNote({ id: 'note-1', collection_id: 'col-1' }),
        createMockNote({ id: 'note-2', collection_id: 'col-1' }),
      ];
      vi.mocked(invoke).mockResolvedValue(mockNotes);

      const result = await listNotesInCollection('col-1');

      expect(invoke).toHaveBeenCalledWith('list_notes_in_collection', { collectionId: 'col-1' });
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty collection', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await listNotesInCollection('empty-col');

      expect(result).toEqual([]);
    });
  });

  describe('listUncategorizedNotes', () => {
    it('should list notes without a collection', async () => {
      const mockNotes = [
        createMockNote({ id: 'note-1', collection_id: null }),
        createMockNote({ id: 'note-2', collection_id: null }),
      ];
      vi.mocked(invoke).mockResolvedValue(mockNotes);

      const result = await listUncategorizedNotes();

      expect(invoke).toHaveBeenCalledWith('list_uncategorized_notes');
      expect(result).toHaveLength(2);
      expect(result.every((n) => n.collection_id === null)).toBe(true);
    });
  });

  describe('countNotesInCollection', () => {
    it('should return count of notes in collection', async () => {
      vi.mocked(invoke).mockResolvedValue(15);

      const result = await countNotesInCollection('col-123');

      expect(invoke).toHaveBeenCalledWith('count_notes_in_collection', { collectionId: 'col-123' });
      expect(result).toBe(15);
    });

    it('should return zero for empty collection', async () => {
      vi.mocked(invoke).mockResolvedValue(0);

      const result = await countNotesInCollection('empty-col');

      expect(result).toBe(0);
    });
  });

  describe('COLLECTION_COLORS', () => {
    it('should have valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      COLLECTION_COLORS.forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should have at least 10 colors', () => {
      expect(COLLECTION_COLORS.length).toBeGreaterThanOrEqual(10);
    });

    it('should have unique colors', () => {
      const uniqueColors = new Set(COLLECTION_COLORS);
      expect(uniqueColors.size).toBe(COLLECTION_COLORS.length);
    });

    it('should include common colors', () => {
      expect(COLLECTION_COLORS).toContain('#EF4444'); // Red
      expect(COLLECTION_COLORS).toContain('#22C55E'); // Green
      expect(COLLECTION_COLORS).toContain('#3B82F6'); // Blue
    });
  });

  describe('integration scenarios', () => {
    it('should handle collection lifecycle with notes', async () => {
      // Create collection
      const mockCollection = createMockCollection({ id: 'new-col' });
      vi.mocked(invoke).mockResolvedValueOnce(mockCollection);
      const collection = await createCollection('New Collection');

      // Add notes to collection
      const mockNote = createMockNote({ collection_id: collection.id });
      vi.mocked(invoke).mockResolvedValueOnce(mockNote);
      await updateNoteCollection('note-1', collection.id);

      // Verify note count
      vi.mocked(invoke).mockResolvedValueOnce(1);
      const count = await countNotesInCollection(collection.id);
      expect(count).toBe(1);

      // Delete collection (notes become uncategorized)
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await deleteCollection(collection.id);
    });
  });
});

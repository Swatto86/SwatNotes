/**
 * Tests for centralized application state management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the NoteEditorInstance before importing
vi.mock('../components/noteEditor', () => ({
  NoteEditorInstance: {},
}));

import { appState } from './appState';
import type { Note } from '../types';
import type { NoteEditorInstance } from '../components/noteEditor';

// Helper to create a mock note
function createMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'test-note-id',
    title: 'Test Note',
    content_json: '{"ops":[{"insert":"Hello"}]}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    title_modified: false,
    collection_id: null,
    ...overrides,
  };
}

// Helper to create a mock editor instance
function createMockEditor(): NoteEditorInstance {
  return {
    quill: {} as any,
    destroy: vi.fn(),
  };
}

describe('appState', () => {
  beforeEach(() => {
    // Reset state before each test
    appState.closeNote();
    appState.clearSearch();
  });

  describe('initial state', () => {
    it('should have null currentNote initially', () => {
      expect(appState.currentNote).toBeNull();
    });

    it('should have null selectedNoteId initially', () => {
      expect(appState.selectedNoteId).toBeNull();
    });

    it('should have null currentEditor initially', () => {
      expect(appState.currentEditor).toBeNull();
    });

    it('should have empty searchQuery initially', () => {
      expect(appState.searchQuery).toBe('');
    });

    it('should have isSearching false initially', () => {
      expect(appState.isSearching).toBe(false);
    });
  });

  describe('setCurrentNote', () => {
    it('should set the current note', () => {
      const note = createMockNote();
      appState.setCurrentNote(note);

      expect(appState.currentNote).toEqual(note);
    });

    it('should also update selectedNoteId', () => {
      const note = createMockNote({ id: 'note-123' });
      appState.setCurrentNote(note);

      expect(appState.selectedNoteId).toBe('note-123');
    });

    it('should clear selectedNoteId when note is null', () => {
      const note = createMockNote();
      appState.setCurrentNote(note);
      appState.setCurrentNote(null);

      expect(appState.selectedNoteId).toBeNull();
    });
  });

  describe('setSelectedNoteId', () => {
    it('should set the selected note ID', () => {
      appState.setSelectedNoteId('note-456');

      expect(appState.selectedNoteId).toBe('note-456');
    });

    it('should allow clearing the selection', () => {
      appState.setSelectedNoteId('note-456');
      appState.setSelectedNoteId(null);

      expect(appState.selectedNoteId).toBeNull();
    });
  });

  describe('setCurrentEditor', () => {
    it('should set the current editor', () => {
      const editor = createMockEditor();
      appState.setCurrentEditor(editor);

      expect(appState.currentEditor).toBe(editor);
    });
  });

  describe('setSearchQuery', () => {
    it('should set the search query', () => {
      appState.setSearchQuery('test query');

      expect(appState.searchQuery).toBe('test query');
    });
  });

  describe('setIsSearching', () => {
    it('should set the searching flag', () => {
      appState.setIsSearching(true);

      expect(appState.isSearching).toBe(true);
    });
  });

  describe('openNote', () => {
    it('should set both note and editor atomically', () => {
      const note = createMockNote();
      const editor = createMockEditor();

      appState.openNote(note, editor);

      expect(appState.currentNote).toEqual(note);
      expect(appState.currentEditor).toBe(editor);
      expect(appState.selectedNoteId).toBe(note.id);
    });

    it('should destroy the previous editor', () => {
      const oldEditor = createMockEditor();
      const newEditor = createMockEditor();
      const note = createMockNote();

      appState.setCurrentEditor(oldEditor);
      appState.openNote(note, newEditor);

      expect(oldEditor.destroy).toHaveBeenCalled();
    });
  });

  describe('closeNote', () => {
    it('should clear all note-related state', () => {
      const note = createMockNote();
      const editor = createMockEditor();

      appState.openNote(note, editor);
      appState.closeNote();

      expect(appState.currentNote).toBeNull();
      expect(appState.currentEditor).toBeNull();
      expect(appState.selectedNoteId).toBeNull();
    });

    it('should destroy the editor on close', () => {
      const note = createMockNote();
      const editor = createMockEditor();

      appState.openNote(note, editor);
      appState.closeNote();

      expect(editor.destroy).toHaveBeenCalled();
    });
  });

  describe('updateCurrentNote', () => {
    it('should update the current note if IDs match', () => {
      const note = createMockNote({ id: 'note-1', title: 'Original' });
      const editor = createMockEditor();
      appState.openNote(note, editor);

      const updatedNote = createMockNote({ id: 'note-1', title: 'Updated' });
      appState.updateCurrentNote(updatedNote);

      expect(appState.currentNote?.title).toBe('Updated');
    });

    it('should not update if IDs do not match', () => {
      const note = createMockNote({ id: 'note-1', title: 'Original' });
      const editor = createMockEditor();
      appState.openNote(note, editor);

      const differentNote = createMockNote({ id: 'note-2', title: 'Different' });
      appState.updateCurrentNote(differentNote);

      expect(appState.currentNote?.title).toBe('Original');
    });

    it('should not update if no note is open', () => {
      const note = createMockNote();
      appState.updateCurrentNote(note);

      expect(appState.currentNote).toBeNull();
    });
  });

  describe('clearSearch', () => {
    it('should clear search query and searching flag', () => {
      appState.setSearchQuery('test');
      appState.setIsSearching(true);

      appState.clearSearch();

      expect(appState.searchQuery).toBe('');
      expect(appState.isSearching).toBe(false);
    });
  });

  describe('subscription system', () => {
    it('should notify subscribers on state change', () => {
      const callback = vi.fn();
      const unsubscribe = appState.subscribe('currentNote', callback);

      const note = createMockNote();
      appState.setCurrentNote(note);

      expect(callback).toHaveBeenCalledWith(note, null);

      unsubscribe();
    });

    it('should not notify after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = appState.subscribe('currentNote', callback);

      unsubscribe();

      const note = createMockNote();
      appState.setCurrentNote(note);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support wildcard subscriptions', () => {
      const callback = vi.fn();
      const unsubscribe = appState.subscribe('*', callback);

      appState.setSearchQuery('test');

      expect(callback).toHaveBeenCalledWith('searchQuery', 'test', '');

      unsubscribe();
    });

    it('should not notify if value has not changed', () => {
      const callback = vi.fn();
      appState.subscribe('searchQuery', callback);

      appState.setSearchQuery('');
      appState.setSearchQuery('');

      // Should not be called because value didn't change
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getSnapshot', () => {
    it('should return a copy of the current state', () => {
      const note = createMockNote();
      const editor = createMockEditor();
      appState.openNote(note, editor);
      appState.setSearchQuery('test');

      const snapshot = appState.getSnapshot();

      expect(snapshot.currentNote).toEqual(note);
      expect(snapshot.searchQuery).toBe('test');
    });
  });
});

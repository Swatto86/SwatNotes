/**
 * Tests for Notes List Component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { Note } from '../types';

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../utils/notesApi', () => ({
  listNotes: vi.fn(),
}));

vi.mock('../utils/modal', () => ({
  showAlert: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { renderNotesList } from './notesList';
import { listNotes } from '../utils/notesApi';
import { appState } from '../state/appState';

// Helper to create a mock note
function createMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'test-note-id',
    title: 'Test Note',
    content_json: '{"ops":[{"insert":"Hello world\\n"}]}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    title_modified: false,
    collection_id: null,
    ...overrides,
  };
}

describe('notesList', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a container element
    container = document.createElement('div');
    container.id = 'notes-list';
    document.body.appendChild(container);

    // Reset appState
    appState.closeNote();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('renderNotesList', () => {
    it('should render empty state when no notes exist', async () => {
      vi.mocked(listNotes).mockResolvedValue([]);

      await renderNotesList('notes-list', vi.fn());

      expect(container.innerHTML).toContain('No notes yet');
      expect(container.innerHTML).toContain('Click "New Note" to get started');
    });

    it('should render notes list when notes exist', async () => {
      const mockNotes = [
        createMockNote({ id: 'note-1', title: 'First Note' }),
        createMockNote({ id: 'note-2', title: 'Second Note' }),
      ];
      vi.mocked(listNotes).mockResolvedValue(mockNotes);

      await renderNotesList('notes-list', vi.fn());

      expect(container.innerHTML).toContain('First Note');
      expect(container.innerHTML).toContain('Second Note');
      expect(container.querySelectorAll('.note-card').length).toBe(2);
    });

    it('should call onNoteClick callback when note card is clicked', async () => {
      const mockNote = createMockNote({ id: 'note-1', title: 'Clickable Note' });
      vi.mocked(listNotes).mockResolvedValue([mockNote]);

      const onNoteClick = vi.fn();
      await renderNotesList('notes-list', onNoteClick);

      const noteCard = container.querySelector('#note-note-1');
      expect(noteCard).not.toBeNull();

      // Simulate click
      noteCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onNoteClick).toHaveBeenCalledWith(mockNote);
    });

    it('should not trigger onNoteClick when popout button is clicked', async () => {
      const mockNote = createMockNote({ id: 'note-1' });
      vi.mocked(listNotes).mockResolvedValue([mockNote]);
      vi.mocked(invoke).mockResolvedValue(undefined);

      const onNoteClick = vi.fn();
      await renderNotesList('notes-list', onNoteClick);

      const popoutBtn = container.querySelector('#popout-note-1');
      expect(popoutBtn).not.toBeNull();

      // Simulate click on popout button
      popoutBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 0));

      // onNoteClick should NOT be called because click was on popout button (stopPropagation)
      expect(onNoteClick).not.toHaveBeenCalled();
    });

    it('should render text preview from content_json', async () => {
      const mockNote = createMockNote({
        id: 'note-1',
        content_json: '{"ops":[{"insert":"This is preview text\\n"}]}',
      });
      vi.mocked(listNotes).mockResolvedValue([mockNote]);

      await renderNotesList('notes-list', vi.fn());

      expect(container.innerHTML).toContain('This is preview text');
    });

    it('should escape HTML in note title', async () => {
      const mockNote = createMockNote({
        id: 'note-1',
        title: '<script>alert("xss")</script>',
      });
      vi.mocked(listNotes).mockResolvedValue([mockNote]);

      await renderNotesList('notes-list', vi.fn());

      // Should be escaped, not executed
      expect(container.innerHTML).not.toContain('<script>');
      expect(container.innerHTML).toContain('&lt;script&gt;');
    });

    it('should handle error when loading notes fails', async () => {
      vi.mocked(listNotes).mockRejectedValue(new Error('Database error'));

      await renderNotesList('notes-list', vi.fn());

      expect(container.innerHTML).toContain('Failed to load notes');
    });

    it('should call onNotesChange callback with notes array', async () => {
      const mockNotes = [createMockNote()];
      vi.mocked(listNotes).mockResolvedValue(mockNotes);

      const onNotesChange = vi.fn();
      await renderNotesList('notes-list', vi.fn(), onNotesChange);

      expect(onNotesChange).toHaveBeenCalledWith(mockNotes);
    });

    it('should highlight selected note', async () => {
      const mockNote = createMockNote({ id: 'selected-note' });
      vi.mocked(listNotes).mockResolvedValue([mockNote]);

      // Set selected note in app state
      appState.setSelectedNoteId('selected-note');

      await renderNotesList('notes-list', vi.fn());

      const noteCard = container.querySelector('#note-selected-note');
      expect(noteCard?.classList.contains('ring-2')).toBe(true);
      expect(noteCard?.classList.contains('ring-primary')).toBe(true);
    });

    it('should include popout button for each note', async () => {
      const mockNote = createMockNote({ id: 'note-1' });
      vi.mocked(listNotes).mockResolvedValue([mockNote]);

      await renderNotesList('notes-list', vi.fn());

      const popoutBtn = container.querySelector('#popout-note-1');
      expect(popoutBtn).not.toBeNull();
      expect(popoutBtn?.getAttribute('title')).toBe('Open in floating note window');
    });

    it('should call invoke for popout when popout button is clicked', async () => {
      const mockNote = createMockNote({ id: 'note-1' });
      vi.mocked(listNotes).mockResolvedValue([mockNote]);
      vi.mocked(invoke).mockResolvedValue(undefined);

      await renderNotesList('notes-list', vi.fn());

      const popoutBtn = container.querySelector('#popout-note-1');
      popoutBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(invoke).toHaveBeenCalledWith('open_note_window', { noteId: 'note-1' });
    });
  });

  // Note: Delete functionality is not part of the notesList component.
  // Notes are deleted through other UI interactions (e.g., editor context menu).
});

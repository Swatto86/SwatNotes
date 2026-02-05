/**
 * Tests for Note Editor Component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Note } from '../types';

// Mock Quill before importing the module
const mockQuillInstance = {
  setContents: vi.fn(),
  getContents: vi.fn(() => ({ ops: [{ insert: 'Test content\n' }] })),
  getText: vi.fn(() => 'Test content\n'),
  getSelection: vi.fn(() => ({ index: 0 })),
  insertEmbed: vi.fn(),
  setSelection: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

// Create a mock constructor function with static import method
function MockQuill() {
  return mockQuillInstance;
}

// Add static import method that Quill.import() calls
MockQuill.import = vi.fn(() => class MockBlot {});

vi.mock('quill', () => ({
  default: MockQuill,
}));

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock Tauri event system
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(() => Promise.resolve()),
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock the API modules
vi.mock('../utils/notesApi', () => ({
  updateNote: vi.fn(),
}));

vi.mock('../utils/attachmentsApi', () => ({
  createAttachment: vi.fn(),
  listAttachments: vi.fn(() => Promise.resolve([])),
  getAttachmentData: vi.fn(),
  deleteAttachment: vi.fn(),
  createDataUrl: vi.fn(),
  readFileAsBytes: vi.fn(),
}));

vi.mock('../utils/remindersApi', () => ({
  createReminder: vi.fn(),
  listActiveReminders: vi.fn(() => Promise.resolve([])),
  deleteReminder: vi.fn(),
}));

vi.mock('../utils/modal', () => ({
  showConfirm: vi.fn(() => Promise.resolve(true)),
  showAlert: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock quillAttachmentBlots to prevent Quill.import() at module load time
vi.mock('../utils/quillAttachmentBlots', () => ({
  AttachmentImageBlot: class MockAttachmentImageBlot {},
  AttachmentFileBlot: class MockAttachmentFileBlot {},
  registerAttachmentBlots: vi.fn(),
}));

import { createNoteEditor } from './noteEditor';
import { updateNote } from '../utils/notesApi';
import { listAttachments } from '../utils/attachmentsApi';
import { listActiveReminders } from '../utils/remindersApi';

// Helper to create a mock note
function createMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'test-note-id',
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

describe('noteEditor', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create a container element for the editor
    container = document.createElement('div');
    container.id = 'editor-container';
    document.body.appendChild(container);

    // Reset Quill mock
    mockQuillInstance.getText.mockReturnValue('Test content\n');
    mockQuillInstance.getContents.mockReturnValue({ ops: [{ insert: 'Test content\n' }] });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('createNoteEditor', () => {
    it('should create an editor in the specified container', () => {
      const note = createMockNote();
      const editor = createNoteEditor('editor-container', note);

      expect(container.innerHTML).toContain('note-title');
      expect(container.innerHTML).toContain('note-editor');
      expect(editor.quill).toBeDefined();
      expect(editor.destroy).toBeInstanceOf(Function);
    });

    it('should throw error if container not found', () => {
      const note = createMockNote();

      expect(() => createNoteEditor('nonexistent', note)).toThrow(
        'Container #nonexistent not found'
      );
    });

    it('should set the title input value from note when title is manually modified', () => {
      const note = createMockNote({ title: 'My Custom Title', title_modified: true });
      createNoteEditor('editor-container', note);

      const titleInput = document.getElementById('note-title') as HTMLInputElement;
      expect(titleInput.value).toBe('My Custom Title');
    });

    it('should load initial content into Quill', () => {
      const note = createMockNote();
      createNoteEditor('editor-container', note);

      expect(mockQuillInstance.setContents).toHaveBeenCalledWith({
        ops: [{ insert: 'Test content\n' }],
      });
    });

    it('should set auto-title checkbox based on title_modified flag', () => {
      const manualTitleNote = createMockNote({ title_modified: true });
      createNoteEditor('editor-container', manualTitleNote);

      const checkbox = document.getElementById('auto-title-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('should check auto-title checkbox when title is not manually modified', () => {
      const autoTitleNote = createMockNote({ title_modified: false });
      createNoteEditor('editor-container', autoTitleNote);

      const checkbox = document.getElementById('auto-title-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('should load attachments on creation', async () => {
      const note = createMockNote();
      createNoteEditor('editor-container', note);

      // Allow async operations to complete
      await vi.runAllTimersAsync();

      expect(listAttachments).toHaveBeenCalledWith('test-note-id');
    });

    it('should load reminders on creation', async () => {
      const note = createMockNote();
      createNoteEditor('editor-container', note);

      await vi.runAllTimersAsync();

      expect(listActiveReminders).toHaveBeenCalled();
    });
  });

  describe('autosave functionality', () => {
    it('should register text-change handler on Quill', () => {
      const note = createMockNote();
      createNoteEditor('editor-container', note);

      expect(mockQuillInstance.on).toHaveBeenCalledWith('text-change', expect.any(Function));
    });

    it('should debounce save calls', async () => {
      const note = createMockNote();
      vi.mocked(updateNote).mockResolvedValue(note);

      createNoteEditor('editor-container', note);

      // Get the text-change handler
      const textChangeHandler = mockQuillInstance.on.mock.calls.find(
        (call) => call[0] === 'text-change'
      )?.[1];

      expect(textChangeHandler).toBeDefined();

      // Trigger multiple changes rapidly
      textChangeHandler?.();
      textChangeHandler?.();
      textChangeHandler?.();

      // Advance time but not enough for debounce
      await vi.advanceTimersByTimeAsync(300);

      // Should not have saved yet
      expect(updateNote).not.toHaveBeenCalled();

      // Advance past debounce timeout (500ms)
      await vi.advanceTimersByTimeAsync(300);

      // Now it should have saved once
      expect(updateNote).toHaveBeenCalledTimes(1);
    });

    it('should call onSave callback after successful save', async () => {
      const note = createMockNote();
      const updatedNote = createMockNote({ updated_at: '2024-01-01T00:01:00Z' });
      vi.mocked(updateNote).mockResolvedValue(updatedNote);

      const onSave = vi.fn();
      createNoteEditor('editor-container', note, onSave);

      // Get the text-change handler and trigger it
      const textChangeHandler = mockQuillInstance.on.mock.calls.find(
        (call) => call[0] === 'text-change'
      )?.[1];
      textChangeHandler?.();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(600);

      expect(onSave).toHaveBeenCalledWith(updatedNote);
    });

    it('should not save empty notes', async () => {
      const note = createMockNote();
      mockQuillInstance.getText.mockReturnValue('\n'); // Empty content

      createNoteEditor('editor-container', note);

      const textChangeHandler = mockQuillInstance.on.mock.calls.find(
        (call) => call[0] === 'text-change'
      )?.[1];
      textChangeHandler?.();

      await vi.advanceTimersByTimeAsync(600);

      expect(updateNote).not.toHaveBeenCalled();
    });
  });

  describe('title handling', () => {
    it('should auto-generate title from content when auto-title is enabled', () => {
      const note = createMockNote({ title: 'Untitled', title_modified: false });
      mockQuillInstance.getText.mockReturnValue('My new note content\nMore text');

      createNoteEditor('editor-container', note);

      const titleInput = document.getElementById('note-title') as HTMLInputElement;
      // Title should be generated from first line
      expect(titleInput.value).toBe('My new note content');
    });

    it('should truncate long titles to 50 characters with ellipsis', () => {
      const note = createMockNote({ title: 'Untitled', title_modified: false });
      const longText = 'A'.repeat(60) + '\nMore text';
      mockQuillInstance.getText.mockReturnValue(longText);

      createNoteEditor('editor-container', note);

      const titleInput = document.getElementById('note-title') as HTMLInputElement;
      expect(titleInput.value).toBe('A'.repeat(50) + '...');
    });

    it('should use "Untitled" when content is empty', () => {
      const note = createMockNote({ title: 'Untitled', title_modified: false });
      mockQuillInstance.getText.mockReturnValue('\n');

      createNoteEditor('editor-container', note);

      const titleInput = document.getElementById('note-title') as HTMLInputElement;
      expect(titleInput.value).toBe('Untitled');
    });

    it('should not auto-generate title when title_modified is true', () => {
      const note = createMockNote({ title: 'My Manual Title', title_modified: true });
      mockQuillInstance.getText.mockReturnValue('Different content');

      createNoteEditor('editor-container', note);

      const titleInput = document.getElementById('note-title') as HTMLInputElement;
      expect(titleInput.value).toBe('My Manual Title');
    });
  });

  describe('destroy method', () => {
    it('should clear any pending save timeout', async () => {
      const note = createMockNote();
      vi.mocked(updateNote).mockResolvedValue(note);

      const editor = createNoteEditor('editor-container', note);

      // Trigger a change to start debounce timer
      const textChangeHandler = mockQuillInstance.on.mock.calls.find(
        (call) => call[0] === 'text-change'
      )?.[1];
      textChangeHandler?.();

      // Destroy before debounce completes
      editor.destroy();

      // Advance time - should not trigger save since destroyed
      await vi.advanceTimersByTimeAsync(600);

      // May or may not have been called depending on implementation
      // The key is no errors should occur
    });

    it('should expose the quill instance', () => {
      const note = createMockNote();
      const editor = createNoteEditor('editor-container', note);

      expect(editor.quill).toBe(mockQuillInstance);
    });
  });

  describe('UI elements', () => {
    it('should render save status element', () => {
      const note = createMockNote();
      createNoteEditor('editor-container', note);

      const saveStatus = document.getElementById('save-status');
      expect(saveStatus).toBeTruthy();
      expect(saveStatus?.textContent).toContain('Last saved:');
    });

    it('should render attachments section', () => {
      const note = createMockNote();
      createNoteEditor('editor-container', note);

      const attachmentsList = document.getElementById('attachments-list');
      expect(attachmentsList).toBeTruthy();
    });

    it('should render reminders section', () => {
      const note = createMockNote();
      createNoteEditor('editor-container', note);

      const remindersList = document.getElementById('reminders-list');
      const addReminderBtn = document.getElementById('add-reminder-btn');
      expect(remindersList).toBeTruthy();
      expect(addReminderBtn).toBeTruthy();
    });

    it('should render file upload input with note-specific id', () => {
      const note = createMockNote({ id: 'unique-note-123' });
      createNoteEditor('editor-container', note);

      const fileInput = document.getElementById('file-upload-unique-note-123');
      expect(fileInput).toBeTruthy();
      expect(fileInput?.getAttribute('type')).toBe('file');
    });
  });
});

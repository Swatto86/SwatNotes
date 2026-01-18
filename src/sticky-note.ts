/**
 * Sticky Note Window
 * Standalone floating note window with auto-save and theme support
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import Quill from 'quill';
import type { Note } from './types';

let noteId: string | null = null;
let currentNote: Note | null = null;
let editor: Quill | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isDirty = false;

// Theme management
const THEME_KEY = 'swatnotes-theme';

function getStoredTheme(): string {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(): void {
  const theme = getStoredTheme();
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Generate a title from note content
 * Takes the first line of text, up to 50 characters
 */
function generateTitleFromContent(quill: Quill): string {
  const text = quill.getText().trim();
  if (!text) {
    return 'Untitled';
  }

  // Get first line or first 50 characters
  const firstLine = text.split('\n')[0];
  if (firstLine.length > 50) {
    return firstLine.substring(0, 50) + '...';
  }

  return firstLine || 'Untitled';
}

// Get note ID from window label
const currentWindow = getCurrentWebviewWindow();
const windowLabel = currentWindow.label;
noteId = windowLabel.replace('note-', '');

// Initialize
async function init(): Promise<void> {
  console.log('Initializing sticky note for ID:', noteId);

  // Apply theme first
  applyTheme();

  // Listen for theme changes from main window
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      applyTheme();
    }
  });

  // Load note
  try {
    currentNote = await invoke<Note>('get_note', { id: noteId });
    console.log('Loaded note:', currentNote);

    // Initialize Quill editor
    editor = new Quill('#sticky-note-editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['link'],
          ['clean']
        ]
      },
      placeholder: 'Start typing...'
    });

    // Load content
    try {
      const content = JSON.parse(currentNote.content_json);
      editor.setContents(content);
    } catch (e) {
      console.error('Failed to parse note content:', e);
    }

    // Update window title from content
    const generatedTitle = generateTitleFromContent(editor);
    document.title = generatedTitle;

    // Setup auto-save on content changes
    editor.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user') {
        isDirty = true;
        updateSaveStatus('saving');

        // Update window title from content
        const newTitle = generateTitleFromContent(editor);
        document.title = newTitle;

        // Debounce auto-save
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await saveNote();
        }, 1000);
      }
    });

    // Setup event handlers
    setupEventHandlers();

    // Show window after content is loaded to prevent white flash
    try {
      await currentWindow.show();
      await currentWindow.setFocus();
      console.log('Window shown and focused');
    } catch (e) {
      console.error('Failed to show window:', e);
    }

  } catch (error) {
    console.error('Failed to load note:', error);
    alert('Failed to load note: ' + error);
  }
}

function setupEventHandlers(): void {
  // Track when this window gains focus for toggle hotkey
  currentWindow.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      invoke('set_last_focused_note_window', { windowLabel: windowLabel })
        .catch(err => console.error('Failed to set last focused window:', err));
    }
  });

  // Delete button - confirm and delete
  const deleteBtn = document.getElementById('delete-btn');
  deleteBtn?.addEventListener('click', async () => {
    if (!currentNote || !editor) {
      console.error('No current note to delete');
      return;
    }

    // Use generated title for confirmation
    const noteTitle = generateTitleFromContent(editor);

    const confirmed = confirm(`Delete note "${noteTitle}"?`);
    if (!confirmed) {
      console.log('Delete cancelled by user');
      return;
    }

    console.log('Deleting note:', noteId);
    try {
      // Use new command that both deletes and closes window
      await invoke('delete_note_and_close_window', { id: noteId });
      console.log('Note deleted and window closed');
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note: ' + error);
    }
  });

  // Save on window close
  window.addEventListener('beforeunload', async () => {
    if (isDirty) {
      await saveNote();
    }
  });
}

async function saveNote(): Promise<void> {
  if (!isDirty || !editor || !currentNote) return;

  // Generate title from content
  const title = generateTitleFromContent(editor);

  updateSaveStatus('saving');

  try {
    const content = editor.getContents();
    const contentJson = JSON.stringify(content);

    await invoke('update_note', {
      id: noteId,
      title: title,
      contentJson: contentJson
    });

    // Update current note reference
    if (currentNote) {
      currentNote.title = title;
      currentNote.content_json = contentJson;
    }

    isDirty = false;
    updateSaveStatus('saved');
    console.log('Note saved successfully with title:', title);
  } catch (error) {
    console.error('Failed to save note:', error);
    updateSaveStatus('error');
    setTimeout(() => {
      if (!isDirty) {
        updateSaveStatus('saved');
      }
    }, 3000);
  }
}

function updateSaveStatus(status: 'saving' | 'saved' | 'error'): void {
  const statusEl = document.getElementById('save-status');
  if (!statusEl) return;

  switch (status) {
    case 'saving':
      statusEl.textContent = 'Saving...';
      statusEl.className = 'text-xs text-info';
      break;
    case 'saved':
      statusEl.textContent = 'Saved';
      statusEl.className = 'text-xs text-success';
      break;
    case 'error':
      statusEl.textContent = 'Save failed';
      statusEl.className = 'text-xs text-error';
      break;
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

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

    // Update title input
    const titleInput = document.getElementById('sticky-note-title') as HTMLInputElement;
    if (titleInput) {
      titleInput.value = currentNote.title || 'Untitled';
    }
    document.title = currentNote.title || 'Note';

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

    // Setup auto-save on content changes
    editor.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user') {
        isDirty = true;
        updateSaveStatus('saving');

        // Debounce auto-save
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await saveNote();
        }, 1000);
      }
    });

    // Setup event handlers
    setupEventHandlers();

    // Note: Window is already shown by Rust code to ensure visibility
    // Just ensure focus in case needed
    await currentWindow.setFocus();

  } catch (error) {
    console.error('Failed to load note:', error);
    alert('Failed to load note: ' + error);
    currentWindow.close();
  }
}

function setupEventHandlers(): void {
  // Title input - auto-save on change
  const titleInput = document.getElementById('sticky-note-title') as HTMLInputElement;
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      isDirty = true;
      updateSaveStatus('saving');

      // Update window title immediately
      document.title = titleInput.value || 'Note';

      // Debounce auto-save
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        await saveNote();
      }, 1000);
    });
  }

  // Close button - save and close
  const closeBtn = document.getElementById('close-btn');
  closeBtn?.addEventListener('click', async () => {
    if (isDirty) {
      await saveNote();
    }
    currentWindow.close();
  });

  // Delete button - confirm and delete
  const deleteBtn = document.getElementById('delete-btn');
  deleteBtn?.addEventListener('click', async () => {
    if (!currentNote) {
      console.error('No current note to delete');
      return;
    }

    const titleInput = document.getElementById('sticky-note-title') as HTMLInputElement;
    const noteTitle = titleInput?.value || currentNote.title || 'Untitled';

    const confirmed = confirm(`Delete note "${noteTitle}"?`);
    if (!confirmed) {
      console.log('Delete cancelled by user');
      return;
    }

    console.log('Deleting note:', noteId);
    try {
      await invoke('delete_note', { id: noteId });
      console.log('Note deleted successfully, closing window');

      // Close window immediately after successful deletion
      // Use setTimeout to ensure the invoke completes before closing
      setTimeout(() => {
        currentWindow.close();
      }, 100);
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

  const titleInput = document.getElementById('sticky-note-title') as HTMLInputElement;
  const title = titleInput?.value || currentNote.title || 'Untitled';

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
    console.log('Note saved successfully');
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

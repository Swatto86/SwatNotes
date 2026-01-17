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

    // Update title
    const titleElement = document.getElementById('sticky-note-title');
    if (titleElement) {
      titleElement.textContent = currentNote.title || 'Untitled';
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

    // Setup auto-save on changes
    editor.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user') {
        isDirty = true;
        updateSaveButton();

        // Debounce auto-save
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await saveNote();
        }, 1000);
      }
    });

    // Setup event handlers
    setupEventHandlers();

    // Show window after initialization to prevent white flash
    await currentWindow.show();

  } catch (error) {
    console.error('Failed to load note:', error);
    alert('Failed to load note: ' + error);
    currentWindow.close();
  }
}

function setupEventHandlers(): void {
  // Save button
  const saveBtn = document.getElementById('save-btn');
  saveBtn?.addEventListener('click', async () => {
    await saveNote();
  });

  // Close button
  const closeBtn = document.getElementById('close-btn');
  closeBtn?.addEventListener('click', async () => {
    if (isDirty) {
      await saveNote();
    }
    currentWindow.close();
  });

  // Delete button
  const deleteBtn = document.getElementById('delete-btn');
  deleteBtn?.addEventListener('click', async () => {
    if (!currentNote) return;
    const confirmed = confirm(`Delete note "${currentNote.title}"?`);
    if (confirmed) {
      try {
        await invoke('delete_note', { id: noteId });
        currentWindow.close();
      } catch (error) {
        console.error('Failed to delete note:', error);
        alert('Failed to delete note: ' + error);
      }
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

  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
  if (saveBtn) {
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
  }

  try {
    const content = editor.getContents();
    const contentJson = JSON.stringify(content);

    await invoke('update_note', {
      id: noteId,
      title: currentNote.title,
      contentJson: contentJson
    });

    isDirty = false;
    if (saveBtn) {
      saveBtn.textContent = 'Saved';
    }
    console.log('Note saved successfully');
  } catch (error) {
    console.error('Failed to save note:', error);
    if (saveBtn) {
      saveBtn.textContent = 'Error';
      setTimeout(() => updateSaveButton(), 2000);
    }
  }
}

function updateSaveButton(): void {
  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
  if (!saveBtn) return;

  if (isDirty) {
    saveBtn.textContent = 'Save';
    saveBtn.disabled = false;
    saveBtn.classList.add('btn-primary');
    saveBtn.classList.remove('btn-ghost');
  } else {
    saveBtn.textContent = 'Saved';
    saveBtn.disabled = true;
    saveBtn.classList.remove('btn-primary');
    saveBtn.classList.add('btn-ghost');
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

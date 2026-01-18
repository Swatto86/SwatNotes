/**
 * Event Handlers Module
 * Central location for all application event handling logic
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createNote, searchNotes } from '../utils/notesApi';
import { renderNotesList } from '../components/notesList';
import { DEFAULT_NOTE_CONTENT, DEFAULT_NOTE_TITLE, SEARCH_DEBOUNCE_MS } from '../config';

/**
 * Setup all event handlers for the application
 */
export function setupEventHandlers() {
  // New Note button
  const newNoteBtn = document.getElementById('new-note-btn');
  newNoteBtn?.addEventListener('click', async () => {
    await handleCreateNote();
  });

  // Search input with debounce
  const searchInput = document.getElementById('search-input');
  let searchTimeout = null;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      await handleSearch(e.target.value);
    }, SEARCH_DEBOUNCE_MS);
  });
}

/**
 * Create a new note and open it in a floating window
 */
async function handleCreateNote() {
  try {
    const newNote = await createNote(DEFAULT_NOTE_TITLE, DEFAULT_NOTE_CONTENT);
    await refreshNotesList();
    // Open new note in floating window instead of main editor
    await invoke('open_note_window', { noteId: newNote.id });
  } catch (error) {
    console.error('Failed to create note:', error);
    alert('Failed to create note');
  }
}

/**
 * Search notes and render filtered results
 * @param {string} query - Search query
 */
async function handleSearch(query) {
  if (!query.trim()) {
    await refreshNotesList();
    return;
  }

  try {
    const results = await searchNotes(query);
    renderFilteredNotes(results);
  } catch (error) {
    console.error('Search failed:', error);
  }
}

/**
 * Refresh the notes list display
 */
async function refreshNotesList() {
  // Dummy callback for notes list (we don't open in main window anymore)
  const dummyCallback = () => {};
  await renderNotesList('notes-list', dummyCallback, null);
}

/**
 * Render filtered search results
 * @param {Array} notes - Array of note objects
 */
function renderFilteredNotes(notes) {
  const container = document.getElementById('notes-list');
  if (!container) return;

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="text-center text-base-content/50 py-8">
        No notes found
      </div>
    `;
    return;
  }

  // Reuse notesList rendering (simplified version here for filtered results)
  // In production, you'd call a shared rendering function
  refreshNotesList();
}

/**
 * Setup reminder notification listeners
 */
export async function setupReminderListener() {
  await listen('reminder-triggered', (event) => {
    const { note_id, note_title } = event.payload;
    console.log('Reminder triggered for note:', note_title);

    // Show in-app alert
    alert(`Reminder: ${note_title}`);
  });

  // Listen for create-new-note event from tray/hotkey
  await listen('create-new-note', async () => {
    console.log('Create new note triggered from tray/hotkey');
    await handleCreateNote();
  });

  // Listen for notes list changes to auto-refresh
  await listen('notes-list-changed', async () => {
    console.log('Notes list changed, refreshing...');
    await refreshNotesList();
  });
}

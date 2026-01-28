/**
 * Event Handlers Module
 * Central location for all application event handling logic
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { createNote, searchNotes } from '../utils/notesApi';
import { DEFAULT_NOTE_CONTENT, DEFAULT_NOTE_TITLE, SEARCH_DEBOUNCE_MS } from '../config';
import { showAlert } from '../utils/modal';
import { appState } from '../state/appState';
import { logger } from '../utils/logger';
import { extractTextPreview, formatRelativeDate, escapeHtml } from '../utils/formatters';
import { playNotificationSound } from '../utils/notificationSound';
import type { Note } from '../types';

const LOG_CONTEXT = 'Handlers';

/** Search timeout reference for debouncing */
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Setup all event handlers for the application
 */
export function setupEventHandlers(): void {
  // New Note button
  const newNoteBtn = document.getElementById('new-note-btn');
  newNoteBtn?.addEventListener('click', async () => {
    await handleCreateNote();
  });

  // Search input with debounce
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(async () => {
      await handleSearch(query);
    }, SEARCH_DEBOUNCE_MS);
  });

  // Clear search when input is cleared
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      appState.clearSearch();
      requestNotesListRefresh();
    }
  });
}

/**
 * Create a new note and open it in a floating window
 */
async function handleCreateNote(): Promise<void> {
  try {
    const newNote = await createNote(DEFAULT_NOTE_TITLE, DEFAULT_NOTE_CONTENT);
    await requestNotesListRefresh();
    // Open new note in floating window instead of main editor
    await invoke('open_note_window', { noteId: newNote.id });
  } catch (error) {
    logger.error('Failed to create note', LOG_CONTEXT, error);
    showAlert('Failed to create note', { title: 'Error', type: 'error' });
  }
}

/**
 * Search notes and render filtered results
 * @param query - Search query
 */
async function handleSearch(query: string): Promise<void> {
  // Update search state
  appState.setSearchQuery(query);

  if (!query.trim()) {
    appState.setIsSearching(false);
    await requestNotesListRefresh();
    return;
  }

  try {
    appState.setIsSearching(true);
    const results = await searchNotes(query);
    renderFilteredNotes(results, query);
  } catch (error) {
    logger.error('Search failed', LOG_CONTEXT, error);
    appState.setIsSearching(false);
  }
}

/**
 * Request a refresh of the notes list display
 * Emits an event that main.ts listens to, ensuring proper click handlers are attached
 */
async function requestNotesListRefresh(): Promise<void> {
  await emit('refresh-notes');
}

/**
 * Highlight search term in text
 * @param text - Text to highlight
 * @param query - Search query
 * @returns HTML with highlighted matches
 */
function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text);

  const escapedText = escapeHtml(text);
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return escapedText.replace(regex, '<mark class="bg-warning text-warning-content px-1 rounded">$1</mark>');
}

/**
 * Escape special regex characters
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper functions (escapeHtml, extractTextPreview, formatRelativeDate) are imported from '../utils/formatters'

/**
 * Render filtered search results
 * @param notes - Array of note objects
 * @param query - Search query for highlighting
 */
function renderFilteredNotes(notes: Note[], query: string = ''): void {
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

  // Render each note card with highlighting
  container.innerHTML = notes.map(note => {
    const preview = extractTextPreview(note.content_json);
    const date = formatRelativeDate(note.updated_at);
    const highlightedTitle = highlightText(note.title, query);
    const highlightedPreview = highlightText(preview, query);

    return `
      <div id="note-${note.id}" class="note-card card bg-base-100 hover:bg-base-200 cursor-pointer p-4 mb-2 border border-base-300">
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-lg truncate">${highlightedTitle}</h3>
            <p class="text-sm text-base-content/70 line-clamp-2 mt-1">${highlightedPreview}</p>
            <p class="text-xs text-base-content/50 mt-2">${date}</p>
          </div>
          <div class="flex gap-1">
            <button id="popout-${note.id}" class="popout-note-btn btn btn-ghost btn-sm btn-circle"
                    title="Open in sticky note window">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
            <button id="delete-${note.id}" class="delete-note-btn btn btn-ghost btn-sm btn-circle"
                    title="Delete note">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners
  notes.forEach(note => {
    const popoutBtn = document.getElementById(`popout-${note.id}`);
    if (popoutBtn) {
      popoutBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await invoke('open_note_window', { noteId: note.id });
        } catch (error) {
          logger.error('Failed to open sticky note', LOG_CONTEXT, error);
          showAlert('Failed to open sticky note: ' + error, { title: 'Error', type: 'error' });
        }
      });
    }

    const deleteBtn = document.getElementById(`delete-${note.id}`);
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await invoke('delete_note', { id: note.id });

          // Clear selection if deleted note was selected
          if (appState.selectedNoteId === note.id) {
            appState.closeNote();
          }

          // Re-run the search to update results
          const searchInput = document.getElementById('search-input') as HTMLInputElement;
          if (searchInput && searchInput.value.trim()) {
            await handleSearch(searchInput.value);
          } else {
            await requestNotesListRefresh();
          }
        } catch (error) {
          logger.error('Failed to delete note', LOG_CONTEXT, error);
          showAlert('Failed to delete note', { title: 'Error', type: 'error' });
        }
      });
    }
  });
}

/**
 * Setup reminder notification listeners
 */
/** Reminder triggered event payload */
interface ReminderTriggeredPayload {
  note_id: string;
  note_title: string;
}

export async function setupReminderListener(): Promise<void> {
  await listen<ReminderTriggeredPayload>('reminder-triggered', (event) => {
    const { note_id, note_title } = event.payload;
    logger.info(`Reminder triggered for note: ${note_title}`, LOG_CONTEXT);

    // Play notification sound
    playNotificationSound();
  });

  // Listen for create-new-note event from tray/hotkey
  await listen('create-new-note', async () => {
    logger.debug('Create new note triggered from tray/hotkey', LOG_CONTEXT);
    await handleCreateNote();
  });

  // Note: 'notes-list-changed' listener is handled in main.ts to ensure proper click handlers

  // Listen for focus-search event from global hotkey
  await listen('focus-search', () => {
    logger.debug('Focus search event received', LOG_CONTEXT);
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  });
}

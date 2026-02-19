/**
 * SwatNotes - Main Application Entry Point
 * Coordinates application initialization and module setup
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { initTheme, setupThemeSwitcher } from './ui/theme';
import { setupEventHandlers, setupReminderListener } from './events/handlers';
import { createNoteEditor } from './components/noteEditor';
import { deleteNote } from './utils/notesApi';
import { showAlert, showPrompt } from './utils/modal';
import { appState } from './state/appState';
import { logger } from './utils/logger';
import { extractTextPreview, formatRelativeDate, formatReminderDate } from './utils/formatters';
import { listActiveReminders } from './utils/remindersApi';

import type { AppInfo, Note, Collection } from './types';
import {
  listCollections,
  createCollection,
  deleteCollection,
  updateCollection,
  listNotesInCollection,
  listUncategorizedNotes,
  COLLECTION_COLORS,
} from './utils/collectionsApi';

const LOG_CONTEXT = 'Main';

// UI state
let collectionsExpanded = true;
// Track which collection is being color-picked
let colorPickCollectionId: string | null = null;

/**
 * Get application information from backend
 * @returns App info object or null on error
 */
async function getAppInfo(): Promise<AppInfo | null> {
  try {
    const info = await invoke<AppInfo>('get_app_info');
    logger.debug('App info loaded', LOG_CONTEXT, info);
    return info;
  } catch (error) {
    logger.error('Error getting app info', LOG_CONTEXT, error);
    return null;
  }
}

/**
 * Clean up empty notes from the database
 * Deletes notes that only contain whitespace
 */
async function cleanupEmptyNotes(): Promise<void> {
  try {
    logger.debug('Checking for empty notes to clean up...', LOG_CONTEXT);
    const notes = await invoke<Note[]>('list_notes');

    let deletedCount = 0;
    for (const note of notes) {
      try {
        // Parse the Quill Delta JSON
        const content = JSON.parse(note.content_json);
        if (content.ops && Array.isArray(content.ops)) {
          // Extract text from all ops
          const text = content.ops
            .map((op: { insert?: string | object }) =>
              typeof op.insert === 'string' ? op.insert : ''
            )
            .join('')
            .trim();

          // If note is empty (only whitespace), delete it
          if (text.length === 0) {
            logger.debug(`Deleting empty note: ${note.id} (${note.title})`, LOG_CONTEXT);
            try {
              await invoke('delete_note', { id: note.id });
              deletedCount++;
            } catch (deleteError) {
              // Note may have been deleted by another window/process - this is fine
              const errorStr = String(deleteError);
              if (errorStr.includes('not found') || errorStr.includes('Note not found')) {
                logger.debug(`Note ${note.id} was already deleted, skipping`, LOG_CONTEXT);
              } else {
                throw deleteError;
              }
            }
          }
        }
      } catch (e) {
        // Only log errors that aren't "not found" errors
        const errorStr = String(e);
        if (!errorStr.includes('not found') && !errorStr.includes('Note not found')) {
          logger.error(`Failed to check note ${note.id}`, LOG_CONTEXT, e);
        }
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} empty note(s)`, LOG_CONTEXT);
    }
  } catch (error) {
    logger.error('Failed to cleanup empty notes', LOG_CONTEXT, error);
  }
}

/**
 * Show the notes grid view (main browsing view)
 */
function showNotesListView(): void {
  const container = document.getElementById('editor-container');
  if (!container) {
    return;
  }

  // Clear state
  appState.closeNote();

  container.innerHTML = `
    <div id="notes-list-view" class="p-6">
      <div id="notes-list-header" class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-base-content" id="notes-view-title">All Notes</h2>
        <span id="notes-list-count" class="text-sm text-base-content/50"></span>
      </div>
      <div id="notes-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div class="text-center text-base-content/50 py-8 col-span-full">Loading...</div>
      </div>
    </div>
  `;
}

/**
 * Get the current filter display name
 */
async function getFilterDisplayName(): Promise<string> {
  const currentFilter = appState.currentCollectionFilter;
  if (currentFilter === 'all') {
    return 'All Notes';
  }
  if (currentFilter === 'uncategorized') {
    return 'Uncategorized';
  }
  if (currentFilter === 'reminders') {
    return 'Reminders';
  }
  try {
    const collections = await listCollections();
    const coll = collections.find((c) => c.id === currentFilter);
    return coll ? coll.name : 'Notes';
  } catch {
    return 'Notes';
  }
}

/**
 * Render notes as cards in the center panel
 */
async function renderNotesGrid(notes: Note[]): Promise<void> {
  const container = document.getElementById('notes-list');
  const countEl = document.getElementById('notes-list-count');
  const titleEl = document.getElementById('notes-view-title');

  if (!container) {
    return;
  }

  // Update header
  const filterName = await getFilterDisplayName();
  if (titleEl) {
    titleEl.textContent = filterName;
  }
  if (countEl) {
    countEl.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
  }

  // Get collections for colors
  let collections: Collection[] = [];
  try {
    collections = await listCollections();
  } catch {
    /* ignore */
  }

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="text-center text-base-content/40 py-16 col-span-full">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="font-medium">No notes here</p>
        <p class="text-sm mt-1">Click <strong>New Note</strong> to create one</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notes
    .map((note) => {
      const preview = extractTextPreview(note.content_json);
      const date = formatRelativeDate(note.updated_at);
      const collection = collections.find((c) => c.id === note.collection_id);
      const color = collection?.color || null;
      const collName = collection?.name || null;

      const colorBar = color
        ? `<div class="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style="background-color: ${color}"></div>`
        : '';

      const collBadge =
        collName && color
          ? `<div class="flex items-center gap-1 mt-2">
           <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${color}"></span>
           <span class="text-xs text-base-content/50 truncate">${escapeHtml(collName)}</span>
         </div>`
          : '';

      return `
      <div class="note-grid-card relative card bg-base-100 border border-base-300 hover:shadow-lg hover:border-base-content/20 cursor-pointer transition-all duration-200 overflow-hidden group" data-note-id="${note.id}">
        ${colorBar}
        <div class="card-body p-4">
          <h3 class="card-title text-sm font-semibold line-clamp-1">${escapeHtml(note.title)}</h3>
          <p class="text-xs text-base-content/60 line-clamp-3 leading-relaxed">${preview}</p>
          <div class="flex items-center justify-between mt-auto pt-2">
            <span class="text-xs text-base-content/40">${date}</span>
            <button class="popout-btn btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-70 transition-opacity" data-note-id="${note.id}" title="Open in floating window">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
          ${collBadge}
        </div>
      </div>
    `;
    })
    .join('');

  // Attach click handlers
  container.querySelectorAll('.note-grid-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.popout-btn')) {
        return;
      } // handled separately
      const noteId = card.getAttribute('data-note-id');
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        openNoteInEditor(note);
      }
    });
  });

  // Attach popout handlers
  container.querySelectorAll('.popout-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const noteId = (btn as HTMLElement).getAttribute('data-note-id');
      if (noteId) {
        try {
          await invoke('open_note_window', { noteId });
        } catch (error) {
          logger.error('Failed to open floating note', LOG_CONTEXT, error);
        }
      }
    });
  });
}

/**
 * Update the reminders count in the sidebar
 */
async function updateRemindersCount(): Promise<void> {
  try {
    const reminders = await listActiveReminders();
    const countEl = document.getElementById('reminders-count');
    if (countEl) {
      countEl.textContent = reminders.length.toString();
    }
  } catch (error) {
    logger.error('Failed to update reminders count', LOG_CONTEXT, error);
  }
}

/**
 * Render the reminders view showing notes with active reminders
 */
async function renderRemindersView(): Promise<void> {
  const container = document.getElementById('notes-list');
  const countEl = document.getElementById('notes-list-count');
  const titleEl = document.getElementById('notes-view-title');

  if (!container) {
    return;
  }

  // Update header
  if (titleEl) {
    titleEl.textContent = 'Reminders';
  }

  try {
    const reminders = await listActiveReminders();

    if (countEl) {
      countEl.textContent = `${reminders.length} reminder${reminders.length !== 1 ? 's' : ''}`;
    }

    if (reminders.length === 0) {
      container.innerHTML = `
        <div class="text-center text-base-content/40 py-16 col-span-full">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p class="font-medium">No active reminders</p>
          <p class="text-sm mt-1">Open a note and click <strong>Remind</strong> to set one</p>
        </div>
      `;
      return;
    }

    // Get note IDs from reminders and batch fetch notes
    const noteIds = [...new Set(reminders.map((r) => r.note_id))];
    const notes: Note[] = [];

    // Fetch notes individually (could be optimized with batch endpoint)
    for (const noteId of noteIds) {
      try {
        const note = await invoke<Note>('get_note', { id: noteId });
        notes.push(note);
      } catch {
        // Note might have been deleted
      }
    }

    // Create a map for quick note lookup
    const noteMap = new Map(notes.map((n) => [n.id, n]));

    // Get collections for colors
    let collections: Collection[] = [];
    try {
      collections = await listCollections();
    } catch {
      /* ignore */
    }

    // Render reminder cards
    container.innerHTML = reminders
      .map((reminder) => {
        const note = noteMap.get(reminder.note_id);
        if (!note) {
          return ''; // Skip if note not found
        }

        const preview = extractTextPreview(note.content_json);
        const reminderTime = formatReminderDate(reminder.trigger_time);
        const collection = collections.find((c) => c.id === note.collection_id);
        const color = collection?.color || null;
        const collName = collection?.name || null;

        const colorBar = color
          ? `<div class="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style="background-color: ${color}"></div>`
          : '';

        const collBadge =
          collName && color
            ? `<div class="flex items-center gap-1 mt-2">
             <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${color}"></span>
             <span class="text-xs text-base-content/50 truncate">${escapeHtml(collName)}</span>
           </div>`
            : '';

        return `
        <div class="reminder-card relative card bg-base-100 border border-base-300 hover:shadow-lg hover:border-base-content/20 cursor-pointer transition-all duration-200 overflow-hidden group" data-note-id="${note.id}">
          ${colorBar}
          <div class="card-body p-4">
            <h3 class="card-title text-sm font-semibold line-clamp-1">${escapeHtml(note.title)}</h3>
            <p class="text-xs text-base-content/60 line-clamp-2 leading-relaxed">${preview}</p>
            <div class="flex items-center gap-2 mt-2 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span class="text-xs font-medium">${reminderTime}</span>
            </div>
            <div class="flex items-center justify-between mt-auto pt-2">
              <span class="text-xs text-base-content/40">${formatRelativeDate(note.updated_at)}</span>
              <button class="popout-btn btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-70 transition-opacity" data-note-id="${note.id}" title="Open in floating window">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
            ${collBadge}
          </div>
        </div>
      `;
      })
      .join('');

    // Attach click handlers
    container.querySelectorAll('.reminder-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.popout-btn')) {
          return;
        }
        const noteId = card.getAttribute('data-note-id');
        if (noteId) {
          const note = noteMap.get(noteId);
          if (note) {
            openNoteInEditor(note);
          }
        }
      });
    });

    // Attach popout handlers
    container.querySelectorAll('.popout-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const noteId = (btn as HTMLElement).getAttribute('data-note-id');
        if (noteId) {
          try {
            await invoke('open_note_window', { noteId });
          } catch (error) {
            logger.error('Failed to open floating note', LOG_CONTEXT, error);
          }
        }
      });
    });
  } catch (error) {
    logger.error('Failed to render reminders view', LOG_CONTEXT, error);
    container.innerHTML = `
      <div class="alert alert-error col-span-full">
        <span>Failed to load reminders</span>
      </div>
    `;
  }
}

/**
 * Update toolbar buttons visibility based on note selection
 */
function _updateToolbarButtons(_noteSelected: boolean): void {
  // No-op: toolbar buttons removed
}

/**
 * Open a note in the main editor (replaces the grid view)
 */
async function openNoteInEditor(note: Note): Promise<void> {
  logger.debug(`Opening note in editor: ${note.id} - ${note.title}`, LOG_CONTEXT);

  const container = document.getElementById('editor-container');
  if (!container) {
    logger.error('Editor container not found', LOG_CONTEXT);
    return;
  }

  // Replace grid with editor, include a back button
  container.innerHTML = `
    <div class="p-4 border-b border-base-300 bg-base-200/50">
      <button id="back-to-list-btn" class="btn btn-ghost btn-sm gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Notes
      </button>
    </div>
    <div class="flex-1 p-6 overflow-y-auto">
      <div class="max-w-4xl mx-auto" id="note-editor-wrapper"></div>
    </div>
  `;

  // Wire up back button
  document.getElementById('back-to-list-btn')?.addEventListener('click', () => {
    showNotesListView();
    refreshNotesList();
  });

  // Create the editor
  try {
    const editor = createNoteEditor(
      'note-editor-wrapper',
      note,
      (updatedNote) => {
        appState.updateCurrentNote(updatedNote);
      },
      () => {
        deleteCurrentNote();
      }
    );

    appState.openNote(note, editor);
  } catch (error) {
    logger.error('Failed to create editor', LOG_CONTEXT, error);
    showAlert('Failed to open note editor: ' + error, { title: 'Error', type: 'error' });
    showNotesListView();
    refreshNotesList();
  }
}

/**
 * Delete the currently selected note
 */
async function deleteCurrentNote(): Promise<void> {
  const currentNote = appState.currentNote;

  if (!currentNote) {
    logger.debug('No note selected to delete', LOG_CONTEXT);
    return;
  }

  try {
    const noteId = currentNote.id;
    appState.closeNote();
    await deleteNote(noteId);

    try {
      await invoke('delete_note_and_close_window', { id: noteId });
    } catch (_e) {
      // Window might not be open, ignore
    }

    showNotesListView();
    await refreshNotesList();
  } catch (error) {
    logger.error('Failed to delete note', LOG_CONTEXT, error);
  }
}

/**
 * Refresh the notes list display
 */
async function refreshNotesList(): Promise<void> {
  const currentFilter = appState.currentCollectionFilter;

  // Special handling for reminders view
  if (currentFilter === 'reminders') {
    const notesListView = document.getElementById('notes-list-view');
    if (notesListView) {
      await renderRemindersView();
    }
    // Update reminder count in sidebar
    await updateRemindersCount();
    await renderCollections();
    return;
  }

  let notes: Note[];

  try {
    if (currentFilter === 'all') {
      notes = await invoke<Note[]>('list_notes');
    } else if (currentFilter === 'uncategorized') {
      notes = await listUncategorizedNotes();
    } else {
      notes = await listNotesInCollection(currentFilter);
    }
  } catch (error) {
    logger.error('Failed to fetch notes', LOG_CONTEXT, error);
    notes = [];
  }

  // Only render grid if we're in list view (not editing)
  const notesListView = document.getElementById('notes-list-view');
  if (notesListView) {
    await renderNotesGrid(notes);
  }

  // Always update collection counts
  await renderCollections();
}

/**
 * Setup toolbar button handlers
 */
function setupToolbarHandlers(): void {
  // Toolbar buttons removed
}

/**
 * Open color picker modal for a collection
 */
function openColorPicker(collectionId: string, currentColor: string): void {
  colorPickCollectionId = collectionId;
  const modal = document.getElementById('color-picker-modal') as HTMLDialogElement;
  const grid = document.getElementById('color-picker-grid');
  if (!modal || !grid) {
    return;
  }

  grid.innerHTML = COLLECTION_COLORS.map((color) => {
    const isActive = color.toLowerCase() === currentColor.toLowerCase();
    return `
      <button class="color-pick-btn w-8 h-8 rounded-full cursor-pointer transition-transform hover:scale-110 ${isActive ? 'ring-2 ring-offset-2 ring-primary' : 'ring-1 ring-black/10'}"
              style="background-color: ${color}" data-color="${color}" title="${color}">
      </button>
    `;
  }).join('');

  // Attach click handlers
  grid.querySelectorAll('.color-pick-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newColor = (btn as HTMLElement).getAttribute('data-color');
      if (newColor && colorPickCollectionId) {
        try {
          await updateCollection(colorPickCollectionId, { color: newColor });
          modal.close();
          await renderCollections();
          // Re-render notes grid to reflect new colors
          await refreshNotesList();
          await emit('notes-list-changed');
        } catch (error) {
          logger.error('Failed to update collection color', LOG_CONTEXT, error);
        }
      }
    });
  });

  modal.showModal();
}

/**
 * Render the collections list in the sidebar
 */
async function renderCollections(): Promise<void> {
  try {
    const collections = await listCollections();
    const collectionsContainer = document.getElementById('collections-items');

    if (!collectionsContainer) {
      return;
    }

    // Get note counts
    const allNotes = await invoke<Note[]>('list_notes');
    const uncategorizedNotes = await listUncategorizedNotes();

    // Update counts
    const allNotesCount = document.getElementById('all-notes-count');
    const uncategorizedCount = document.getElementById('uncategorized-count');

    if (allNotesCount) {
      allNotesCount.textContent = allNotes.length.toString();
    }
    if (uncategorizedCount) {
      uncategorizedCount.textContent = uncategorizedNotes.length.toString();
    }

    // Update reminders count
    await updateRemindersCount();

    // Render collection items
    collectionsContainer.innerHTML = collections
      .map((collection) => {
        const count = allNotes.filter((n) => n.collection_id === collection.id).length;
        const isActive = appState.currentCollectionFilter === collection.id;

        return `
        <div class="collection-item group flex items-center gap-0.5" data-collection-id="${collection.id}">
          <button class="color-dot-btn flex-shrink-0 w-3 h-3 rounded-full ml-3 cursor-pointer hover:scale-125 transition-transform ring-1 ring-black/10" style="background-color: ${collection.color}" data-collection-id="${collection.id}" data-color="${collection.color}" title="Change color"></button>
          <button class="collection-btn flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-base-content hover:bg-base-300 transition-colors ${isActive ? 'bg-base-300 font-medium' : ''}">
            <span class="flex-1 text-left truncate">${escapeHtml(collection.name)}</span>
            <span class="text-xs text-base-content/50">${count}</span>
          </button>
          <button class="delete-collection-btn opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle text-error transition-opacity" title="Delete collection">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `;
      })
      .join('');

    // Color dot click -> open color picker
    collectionsContainer.querySelectorAll('.color-dot-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const collId = (btn as HTMLElement).getAttribute('data-collection-id');
        const color = (btn as HTMLElement).getAttribute('data-color') || '#6B7280';
        if (collId) {
          openColorPicker(collId, color);
        }
      });
    });

    // Collection name click -> filter
    collectionsContainer.querySelectorAll('.collection-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const collectionId = btn.closest('.collection-item')?.getAttribute('data-collection-id');
        if (collectionId) {
          setCollectionFilter(collectionId);
        }
      });
    });

    // Delete buttons
    collectionsContainer.querySelectorAll('.delete-collection-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const collectionId = btn.closest('.collection-item')?.getAttribute('data-collection-id');
        if (collectionId) {
          await deleteCollection(collectionId);
          if (appState.currentCollectionFilter === collectionId) {
            appState.setCurrentCollectionFilter('all');
          }
          await renderCollections();
          await refreshNotesList();
          await emit('notes-list-changed');
        }
      });
    });

    updateCollectionActiveStates();
  } catch (error) {
    logger.error('Failed to render collections', LOG_CONTEXT, error);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Update the active state for collection filter buttons
 */
function updateCollectionActiveStates(): void {
  const allNotesBtn = document.getElementById('filter-all-notes');
  const uncategorizedBtn = document.getElementById('filter-uncategorized');
  const remindersBtn = document.getElementById('filter-reminders');
  const collectionItems = document.querySelectorAll('.collection-btn');
  const currentFilter = appState.currentCollectionFilter;

  allNotesBtn?.classList.remove('bg-base-300', 'font-medium');
  uncategorizedBtn?.classList.remove('bg-base-300', 'font-medium');
  remindersBtn?.classList.remove('bg-base-300', 'font-medium');
  collectionItems.forEach((btn) => btn.classList.remove('bg-base-300', 'font-medium'));

  if (currentFilter === 'all') {
    allNotesBtn?.classList.add('bg-base-300', 'font-medium');
  } else if (currentFilter === 'uncategorized') {
    uncategorizedBtn?.classList.add('bg-base-300', 'font-medium');
  } else if (currentFilter === 'reminders') {
    remindersBtn?.classList.add('bg-base-300', 'font-medium');
  } else {
    const activeBtn = document.querySelector(
      `.collection-item[data-collection-id="${currentFilter}"] .collection-btn`
    );
    activeBtn?.classList.add('bg-base-300', 'font-medium');
  }
}

/**
 * Set the collection filter and switch to list view
 */
async function setCollectionFilter(
  filter: 'all' | 'uncategorized' | 'reminders' | string
): Promise<void> {
  appState.setCurrentCollectionFilter(filter);
  updateCollectionActiveStates();

  // If we're in editor view, switch back to grid
  if (!document.getElementById('notes-list-view')) {
    showNotesListView();
  }

  await refreshNotesList();
}

/**
 * Setup collection UI handlers
 */
function setupCollectionHandlers(): void {
  const toggleBtn = document.getElementById('collections-toggle');
  const chevron = document.getElementById('collections-chevron');
  const collectionsList = document.getElementById('collections-list');

  toggleBtn?.addEventListener('click', () => {
    collectionsExpanded = !collectionsExpanded;
    if (collectionsList) {
      collectionsList.style.display = collectionsExpanded ? 'block' : 'none';
    }
    if (chevron) {
      chevron.style.transform = collectionsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
    }
  });

  // Add collection button
  const addCollectionBtn = document.getElementById('sidebar-add-collection-btn');
  addCollectionBtn?.addEventListener('click', async () => {
    const name = await showPrompt('Enter collection name:', {
      title: 'New Collection',
      input: { type: 'text', placeholder: 'Collection name' },
    });

    if (name && name.trim()) {
      try {
        const color = COLLECTION_COLORS[Math.floor(Math.random() * COLLECTION_COLORS.length)];
        await createCollection(name.trim(), undefined, color);
        await renderCollections();
        await emit('notes-list-changed');
      } catch (error) {
        logger.error('Failed to create collection', LOG_CONTEXT, error);
        showAlert('Failed to create collection: ' + error, { title: 'Error', type: 'error' });
      }
    }
  });

  // All notes filter
  document
    .getElementById('filter-all-notes')
    ?.addEventListener('click', () => setCollectionFilter('all'));

  // Uncategorized filter
  document
    .getElementById('filter-uncategorized')
    ?.addEventListener('click', () => setCollectionFilter('uncategorized'));

  // Reminders filter
  document
    .getElementById('filter-reminders')
    ?.addEventListener('click', () => setCollectionFilter('reminders'));
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  logger.info('Initializing SwatNotes...', LOG_CONTEXT);

  initTheme();
  setupThemeSwitcher();
  setupEventHandlers();
  await setupReminderListener();

  const appInfo = await getAppInfo();

  if (appInfo) {
    logger.info(`App Version: ${appInfo.version}`, LOG_CONTEXT);

    const versionBadge = document.getElementById('version-badge');
    if (versionBadge) {
      versionBadge.textContent = `v${appInfo.version}`;
    }
  }

  await cleanupEmptyNotes();
  setupToolbarHandlers();
  setupCollectionHandlers();

  // Initial load
  await renderCollections();
  await refreshNotesList();

  // Listen for notes-list-changed events
  await listen('notes-list-changed', async () => {
    logger.debug('Notes list changed event received', LOG_CONTEXT);
    await renderCollections();
    await refreshNotesList();
  });

  // Listen for refresh-notes event
  await listen('refresh-notes', async () => {
    logger.debug('Refresh notes event received', LOG_CONTEXT);
    await refreshNotesList();
  });

  logger.info('SwatNotes initialized successfully!', LOG_CONTEXT);
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

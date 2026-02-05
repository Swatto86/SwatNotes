/**
 * SwatNotes - Main Application Entry Point
 * Coordinates application initialization and module setup
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { initTheme, setupThemeSwitcher } from './ui/theme';
import { setupEventHandlers, setupReminderListener } from './events/handlers';
import { renderNotesList } from './components/notesList';
import { createNoteEditor } from './components/noteEditor';
import { deleteNote } from './utils/notesApi';
import { showAlert, showPrompt } from './utils/modal';
import { appState } from './state/appState';
import { logger } from './utils/logger';
import type { AppInfo, Note, Collection } from './types';
import {
  listCollections,
  createCollection,
  deleteCollection,
  listNotesInCollection,
  listUncategorizedNotes,
  COLLECTION_COLORS,
} from './utils/collectionsApi';

const LOG_CONTEXT = 'Main';

// Current collection filter state
let currentFilter: 'all' | 'uncategorized' | string = 'all';
let collectionsExpanded = true;

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
            .map((op: { insert?: string | object }) => (typeof op.insert === 'string' ? op.insert : ''))
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
 * Show the welcome screen
 */
function showWelcomeScreen(): void {
  const container = document.getElementById('editor-container');
  const welcomeScreen = document.getElementById('welcome-screen');

  if (container && !welcomeScreen) {
    // Re-create welcome screen if it was removed
    container.innerHTML = `
      <div class="max-w-4xl mx-auto" id="welcome-screen">
        <div class="alert alert-info shadow-lg mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current flex-shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="font-bold">Welcome to SwatNotes!</h3>
            <div class="text-xs">Click "New Note" to get started. Try switching themes to see DaisyUI in action.</div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title text-2xl">Getting Started</h2>
            <p class="text-base-content/70">
              SwatNotes is a production-grade desktop notes application built with Rust and Tauri.
              It features rich text editing, image support, automatic backups, and more.
            </p>
            <div class="divider"></div>
            <h3 class="font-bold text-lg">Features</h3>
            <ul class="list-disc list-inside space-y-2 text-base-content/80">
              <li>Rich text editing with images and attachments</li>
              <li>Automatic backups and restore</li>
              <li>Reminders with notifications</li>
              <li>System tray integration</li>
              <li>Global hotkeys</li>
              <li>Beautiful themes powered by DaisyUI</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // Hide toolbar buttons for note operations
  updateToolbarButtons(false);

  // Clear state using centralized state manager
  appState.closeNote();
}

/**
 * Update toolbar buttons visibility based on note selection
 * Note: Toolbar buttons removed - delete is now in note editor
 */
function updateToolbarButtons(_noteSelected: boolean): void {
  // No-op: toolbar buttons removed
}

/**
 * Open a note in the main editor
 */
async function openNoteInEditor(note: Note): Promise<void> {
  logger.debug(`Opening note in editor: ${note.id} - ${note.title}`, LOG_CONTEXT);

  // Show toolbar buttons
  updateToolbarButtons(true);

  // Create editor in the container
  const container = document.getElementById('editor-container');
  if (!container) {
    logger.error('Editor container not found', LOG_CONTEXT);
    return;
  }

  // Clear the welcome screen
  container.innerHTML = '<div class="max-w-4xl mx-auto" id="note-editor-wrapper"></div>';

  // Create the editor
  try {
    const editor = createNoteEditor(
      'note-editor-wrapper',
      note,
      (updatedNote) => {
        // Update note reference in state and refresh sidebar
        appState.updateCurrentNote(updatedNote);
        refreshNotesList();
      },
      () => {
        // Handle delete from editor
        deleteCurrentNote();
      }
    );

    // Update state atomically using the compound operation
    appState.openNote(note, editor);
  } catch (error) {
    logger.error('Failed to create editor', LOG_CONTEXT, error);
    showAlert('Failed to open note editor: ' + error, { title: 'Error', type: 'error' });
    showWelcomeScreen();
  }
}

/**
 * Handle note click from sidebar
 */
function handleNoteClick(note: Note): void {
  openNoteInEditor(note);
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

    // Close the note (cleans up editor)
    appState.closeNote();

    await deleteNote(noteId);

    // Close floating window if open
    try {
      await invoke('delete_note_and_close_window', { id: noteId });
    } catch (e) {
      // Window might not be open, ignore
    }

    // Show welcome screen
    showWelcomeScreen();

    // Refresh notes list
    await refreshNotesList();
  } catch (error) {
    logger.error('Failed to delete note', LOG_CONTEXT, error);
  }
}

/**
 * Refresh the notes list display
 */
async function refreshNotesList(): Promise<void> {
  // Get filtered notes based on current filter
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

  // Render the notes list with the filtered notes
  await renderNotesList('notes-list', handleNoteClick, (allNotes) => {
    const currentNote = appState.currentNote;

    // If current note was deleted, show welcome screen
    if (currentNote && !allNotes.find(n => n.id === currentNote.id)) {
      appState.closeNote();
      showWelcomeScreen();
    }
  }, notes);

  // Update collection counts
  await renderCollections();
}

/**
 * Setup toolbar button handlers
 */
function setupToolbarHandlers(): void {
  // Toolbar buttons removed - delete is now in note editor
}

/**
 * Render the collections list in the sidebar
 */
async function renderCollections(): Promise<void> {
  try {
    const collections = await listCollections();
    const collectionsContainer = document.getElementById('collections-items');

    if (!collectionsContainer) return;

    // Get note counts
    const allNotes = await invoke<Note[]>('list_notes');
    const uncategorizedNotes = await listUncategorizedNotes();

    // Update counts
    const allNotesCount = document.getElementById('all-notes-count');
    const uncategorizedCount = document.getElementById('uncategorized-count');

    if (allNotesCount) allNotesCount.textContent = allNotes.length.toString();
    if (uncategorizedCount) uncategorizedCount.textContent = uncategorizedNotes.length.toString();

    // Render collection items
    collectionsContainer.innerHTML = collections.map(collection => {
      const count = allNotes.filter(n => n.collection_id === collection.id).length;
      const isActive = currentFilter === collection.id;

      return `
        <div class="collection-item group flex items-center gap-1" data-collection-id="${collection.id}">
          <button class="collection-btn flex-1 flex items-center gap-2 px-3 py-1.5 rounded text-sm text-base-content hover:bg-base-300 ${isActive ? 'bg-base-300' : ''}">
            <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${collection.color}"></span>
            <span class="flex-1 text-left truncate">${escapeHtml(collection.name)}</span>
            <span class="text-xs text-base-content/50">${count}</span>
          </button>
          <button class="delete-collection-btn opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle text-error" title="Delete collection">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `;
    }).join('');

    // Add event listeners for collections
    collectionsContainer.querySelectorAll('.collection-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const collectionId = btn.closest('.collection-item')?.getAttribute('data-collection-id');
        if (collectionId) {
          setCollectionFilter(collectionId);
        }
      });
    });

    // Add event listeners for delete buttons
    collectionsContainer.querySelectorAll('.delete-collection-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const collectionId = btn.closest('.collection-item')?.getAttribute('data-collection-id');
        if (collectionId) {
          await deleteCollection(collectionId);
          if (currentFilter === collectionId) {
            currentFilter = 'all';
          }
          await renderCollections();
          await refreshNotesList();
          // Notify about the change
          await emit('notes-list-changed');
        }
      });
    });

    // Update active states
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
  const collectionItems = document.querySelectorAll('.collection-btn');

  // Remove active class from all
  allNotesBtn?.classList.remove('bg-base-300');
  uncategorizedBtn?.classList.remove('bg-base-300');
  collectionItems.forEach(btn => btn.classList.remove('bg-base-300'));

  // Add active class to current filter
  if (currentFilter === 'all') {
    allNotesBtn?.classList.add('bg-base-300');
  } else if (currentFilter === 'uncategorized') {
    uncategorizedBtn?.classList.add('bg-base-300');
  } else {
    const activeBtn = document.querySelector(`.collection-item[data-collection-id="${currentFilter}"] .collection-btn`);
    activeBtn?.classList.add('bg-base-300');
  }
}

/**
 * Set the collection filter
 */
async function setCollectionFilter(filter: 'all' | 'uncategorized' | string): Promise<void> {
  currentFilter = filter;
  updateCollectionActiveStates();
  await refreshNotesList();
}

/**
 * Setup collection UI handlers
 */
function setupCollectionHandlers(): void {
  // Toggle collections visibility
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

  // Add collection button (sidebar)
  const addCollectionBtn = document.getElementById('sidebar-add-collection-btn');
  addCollectionBtn?.addEventListener('click', async () => {
    const name = await showPrompt('Enter collection name:', {
      title: 'New Collection',
      input: { type: 'text', placeholder: 'Collection name' }
    });

    if (name && name.trim()) {
      try {
        // Pick a random color from the palette
        const color = COLLECTION_COLORS[Math.floor(Math.random() * COLLECTION_COLORS.length)];
        await createCollection(name.trim(), undefined, color);
        await renderCollections();
        // Notify about the change
        await emit('notes-list-changed');
      } catch (error) {
        logger.error('Failed to create collection', LOG_CONTEXT, error);
        showAlert('Failed to create collection: ' + error, { title: 'Error', type: 'error' });
      }
    }
  });

  // All notes filter
  const allNotesBtn = document.getElementById('filter-all-notes');
  allNotesBtn?.addEventListener('click', () => setCollectionFilter('all'));

  // Uncategorized filter
  const uncategorizedBtn = document.getElementById('filter-uncategorized');
  uncategorizedBtn?.addEventListener('click', () => setCollectionFilter('uncategorized'));
}

/**
 * Initialize the application
 * Sets up all modules, loads data, and displays the window
 */
async function init(): Promise<void> {
  logger.info('Initializing SwatNotes...', LOG_CONTEXT);

  // Initialize theme
  initTheme();
  setupThemeSwitcher();

  // Setup event handlers
  setupEventHandlers();

  // Setup reminder notification listener
  await setupReminderListener();

  // Get app info
  const appInfo = await getAppInfo();

  if (appInfo) {
    logger.info(`App Version: ${appInfo.version}`, LOG_CONTEXT);
    logger.debug(`App Data Directory: ${appInfo.app_data_dir}`, LOG_CONTEXT);

    // Update version badge in the UI
    const versionBadge = document.getElementById('version-badge');
    if (versionBadge) {
      versionBadge.textContent = `v${appInfo.version}`;
    }
  }

  // Clean up any empty notes before loading the list
  await cleanupEmptyNotes();

  // Setup toolbar handlers
  setupToolbarHandlers();

  // Setup collection handlers
  setupCollectionHandlers();

  // Load collections and notes
  await renderCollections();
  await refreshNotesList();

  // Listen for notes-list-changed events (e.g., from new sticky notes)
  await listen('notes-list-changed', async () => {
    logger.debug('Notes list changed event received', LOG_CONTEXT);
    await renderCollections();
    await refreshNotesList();
  });

  // Listen for refresh-notes event (triggered when window is shown via hotkey/tray)
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

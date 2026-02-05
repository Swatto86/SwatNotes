/**
 * Notes List Component
 * Renders and manages the notes list UI
 */

import { invoke } from '@tauri-apps/api/core';
import { listNotes } from '../utils/notesApi';
import type { Note } from '../types';
import { appState } from '../state/appState';
import { logger } from '../utils/logger';
import { escapeHtml, extractTextPreview, formatRelativeDate } from '../utils/formatters';
import { showAlert } from '../utils/modal';

const LOG_CONTEXT = 'NotesList';

/**
 * Update selection highlight in the UI
 */
function updateSelectionHighlight(): void {
  const selectedNoteId = appState.selectedNoteId;

  // Remove selection from all cards
  document.querySelectorAll('.note-card').forEach(card => {
    card.classList.remove('ring-2', 'ring-primary', 'bg-primary/10');
  });

  // Add selection to the selected card
  if (selectedNoteId) {
    const selectedCard = document.getElementById(`note-${selectedNoteId}`);
    if (selectedCard) {
      selectedCard.classList.add('ring-2', 'ring-primary', 'bg-primary/10');
    }
  }
}

// Subscribe to selectedNoteId changes to update UI
appState.subscribe('selectedNoteId', () => {
  updateSelectionHighlight();
});

/**
 * Render notes list
 * @param containerId - Container element ID
 * @param onNoteClick - Callback when note is clicked (receives note)
 * @param onNotesChange - Callback when notes list changes
 * @param providedNotes - Optional pre-filtered notes array (if not provided, fetches all)
 */
export async function renderNotesList(
  containerId: string,
  onNoteClick: (note: Note) => void,
  onNotesChange?: ((notes: Note[]) => void) | null,
  providedNotes?: Note[]
): Promise<void> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container #${containerId} not found`);
  }

  try {
    // Use provided notes or fetch all
    const notes = providedNotes !== undefined ? providedNotes : await listNotes();

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="text-center text-base-content/50 py-8">
          No notes yet.<br>
          Click "New Note" to get started.
        </div>
      `;
      // Still call onNotesChange with empty array so caller can handle deleted notes
      if (onNotesChange) {
        onNotesChange(notes);
      }
      return;
    }

    container.innerHTML = notes.map(note => createNoteCard(note)).join('');

    // Update selection highlight after rendering
    updateSelectionHighlight();

    // Attach event listeners
    notes.forEach(note => {
      const card = document.getElementById(`note-${note.id}`);
      if (card) {
        card.addEventListener('click', () => {
          onNoteClick(note);
        });
      }

      // Attach popout button handler
      const popoutBtn = document.getElementById(`popout-${note.id}`);
      if (popoutBtn) {
        popoutBtn.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent triggering the card click
          try {
            await invoke('open_note_window', { noteId: note.id });
          } catch (error) {
            logger.error('Failed to open floating note', LOG_CONTEXT, error);
            showAlert('Failed to open floating note: ' + error, { title: 'Error', type: 'error' });
          }
        });
      }
    });

    if (onNotesChange) {
      onNotesChange(notes);
    }
  } catch (error) {
    logger.error('Failed to load notes', LOG_CONTEXT, error);
    container.innerHTML = `
      <div class="alert alert-error">
        <span>Failed to load notes</span>
      </div>
    `;
  }
}

function createNoteCard(note: Note): string {
  const preview = extractTextPreview(note.content_json);
  const date = formatRelativeDate(note.updated_at);
  const selectedNoteId = appState.selectedNoteId;
  const isSelected = selectedNoteId === note.id;
  const selectionClasses = isSelected ? 'ring-2 ring-primary bg-primary/10' : '';

  return `
    <div id="note-${note.id}" class="note-card card bg-base-100 hover:bg-base-200 cursor-pointer p-4 mb-2 border border-base-300 transition-all ${selectionClasses}">
      <div class="flex justify-between items-start">
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-lg truncate">${escapeHtml(note.title)}</h3>
          <p class="text-sm text-base-content/70 line-clamp-2 mt-1">${preview}</p>
          <p class="text-xs text-base-content/50 mt-2">${date}</p>
        </div>
        <button id="popout-${note.id}" class="popout-note-btn btn btn-ghost btn-sm btn-circle ml-2"
                title="Open in floating note window">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>
    </div>
  `;
}

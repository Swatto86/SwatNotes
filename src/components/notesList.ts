/**
 * Notes List Component
 * Renders and manages the notes list UI
 */

import { listNotes, deleteNote } from '../utils/notesApi';
import { invoke } from '@tauri-apps/api/core';
import type { Note } from '../types';

/**
 * Render notes list
 * @param containerId - Container element ID
 * @param onNoteClick - Callback when note is clicked (receives note)
 * @param onNotesChange - Callback when notes list changes
 */
export async function renderNotesList(
  containerId: string,
  onNoteClick: (note: Note) => void,
  onNotesChange?: (notes: Note[]) => void
): Promise<void> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container #${containerId} not found`);
  }

  try {
    const notes = await listNotes();

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="text-center text-base-content/50 py-8">
          No notes yet.<br>
          Click "New Note" to get started.
        </div>
      `;
      return;
    }

    container.innerHTML = notes.map(note => createNoteCard(note)).join('');

    // Attach event listeners
    notes.forEach(note => {
      const card = document.getElementById(`note-${note.id}`);
      if (card) {
        card.addEventListener('click', (e) => {
          // Don't trigger if clicking action buttons
          if (!e.target.closest('.delete-note-btn') && !e.target.closest('.popout-note-btn')) {
            onNoteClick(note);
          }
        });
      }

      const popoutBtn = document.getElementById(`popout-${note.id}`);
      if (popoutBtn) {
        popoutBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await handlePopoutNote(note.id);
        });
      }

      const deleteBtn = document.getElementById(`delete-${note.id}`);
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await handleDeleteNote(note.id, containerId, onNoteClick, onNotesChange);
        });
      }
    });

    if (onNotesChange) {
      onNotesChange(notes);
    }
  } catch (error) {
    console.error('Failed to load notes:', error);
    container.innerHTML = `
      <div class="alert alert-error">
        <span>Failed to load notes</span>
      </div>
    `;
  }
}

function createNoteCard(note: Note): string {
  const preview = extractTextPreview(note.content_json);
  const date = formatDate(note.updated_at);

  return `
    <div id="note-${note.id}" class="note-card card bg-base-100 hover:bg-base-200 cursor-pointer p-4 mb-2 border border-base-300">
      <div class="flex justify-between items-start">
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-lg truncate">${escapeHtml(note.title)}</h3>
          <p class="text-sm text-base-content/70 line-clamp-2 mt-1">${preview}</p>
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
}

async function handlePopoutNote(noteId: string): Promise<void> {
  try {
    await invoke('open_note_window', { noteId });
  } catch (error) {
    console.error('Failed to open sticky note:', error);
    alert('Failed to open sticky note: ' + error);
  }
}

async function handleDeleteNote(
  noteId: string,
  containerId: string,
  onNoteClick: (note: Note) => void,
  onNotesChange?: (notes: Note[]) => void
): Promise<void> {
  if (!confirm('Are you sure you want to delete this note?')) {
    return;
  }

  try {
    await deleteNote(noteId);
    // Refresh the list
    await renderNotesList(containerId, onNoteClick, onNotesChange);
  } catch (error) {
    console.error('Failed to delete note:', error);
    alert('Failed to delete note');
  }
}

function extractTextPreview(contentJson: string): string {
  try {
    const content = JSON.parse(contentJson);
    if (content.ops && Array.isArray(content.ops)) {
      // Extract text from Quill Delta
      const text = content.ops
        .map((op: any) => (typeof op.insert === 'string' ? op.insert : ''))
        .join('')
        .trim();
      return text.substring(0, 100) || 'Empty note';
    }
  } catch (e) {
    console.error('Failed to parse content:', e);
  }
  return 'Empty note';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} min${mins > 1 ? 's' : ''} ago`;
  }

  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  // Less than 1 week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  // Fallback to date
  return date.toLocaleDateString();
}

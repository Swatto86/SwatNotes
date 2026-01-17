// Note Editor Component with Quill.js integration and debounced autosave

import Quill from 'quill';
import { updateNote } from '../utils/notesApi.js';

/**
 * Create a note editor with autosave
 * @param {string} containerId - Container element ID
 * @param {Note} note - Note to edit
 * @param {Function} onSave - Callback after save (receives updated note)
 * @returns {Object} Editor instance with cleanup method
 */
export function createNoteEditor(containerId, note, onSave) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container #${containerId} not found`);
  }

  // Clear container
  container.innerHTML = `
    <div class="note-editor-wrapper">
      <input type="text" id="note-title" class="input input-bordered w-full mb-4 text-2xl font-bold"
             value="${escapeHtml(note.title)}" placeholder="Note title...">
      <div id="note-editor" class="bg-base-100 min-h-[400px]"></div>
      <div class="mt-2 text-sm text-base-content/50" id="save-status">
        Last saved: ${formatDate(note.updated_at)}
      </div>
    </div>
  `;

  const titleInput = document.getElementById('note-title');
  const editorElement = document.getElementById('note-editor');
  const saveStatus = document.getElementById('save-status');

  // Initialize Quill editor
  const quill = new Quill(editorElement, {
    theme: 'snow',
    placeholder: 'Start writing...',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        ['link', 'blockquote', 'code-block'],
        ['clean']
      ]
    }
  });

  // Load initial content
  try {
    const content = JSON.parse(note.content_json);
    quill.setContents(content);
  } catch (e) {
    console.error('Failed to parse note content:', e);
    quill.setText('');
  }

  // Debounced autosave
  let saveTimeout = null;
  let isSaving = false;

  const debouncedSave = async () => {
    if (isSaving) return;

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        isSaving = true;
        saveStatus.textContent = 'Saving...';
        saveStatus.classList.add('text-info');

        const title = titleInput.value.trim() || 'Untitled';
        const contentJson = JSON.stringify(quill.getContents());

        const updatedNote = await updateNote(note.id, title, contentJson);

        saveStatus.textContent = `Saved at ${formatDate(updatedNote.updated_at)}`;
        saveStatus.classList.remove('text-info');
        saveStatus.classList.add('text-success');

        setTimeout(() => {
          saveStatus.classList.remove('text-success');
        }, 2000);

        if (onSave) {
          onSave(updatedNote);
        }
      } catch (error) {
        console.error('Save error:', error);
        saveStatus.textContent = 'Save failed';
        saveStatus.classList.remove('text-info');
        saveStatus.classList.add('text-error');
      } finally {
        isSaving = false;
      }
    }, 500); // 500ms debounce
  };

  // Listen for changes
  quill.on('text-change', debouncedSave);
  titleInput.addEventListener('input', debouncedSave);

  // Save on blur (immediate)
  const saveImmediately = async () => {
    clearTimeout(saveTimeout);
    if (!isSaving) {
      await debouncedSave();
    }
  };

  titleInput.addEventListener('blur', saveImmediately);
  editorElement.addEventListener('blur', saveImmediately);

  // Cleanup function
  return {
    quill,
    destroy() {
      clearTimeout(saveTimeout);
      // Perform final save if needed
      if (titleInput.value !== note.title || JSON.stringify(quill.getContents()) !== note.content_json) {
        saveImmediately();
      }
    }
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

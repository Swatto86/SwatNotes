import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import Quill from 'quill';

let noteId = null;
let currentNote = null;
let editor = null;
let saveTimeout = null;
let isDirty = false;

// Get note ID from window label
const currentWindow = getCurrentWebviewWindow();
const windowLabel = currentWindow.label;
noteId = windowLabel.replace('note-', '');

// Initialize
async function init() {
  console.log('Initializing sticky note for ID:', noteId);

  // Load note
  try {
    currentNote = await invoke('get_note', { id: noteId });
    console.log('Loaded note:', currentNote);

    // Update title
    document.getElementById('sticky-note-title').textContent = currentNote.title || 'Untitled';
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

  } catch (error) {
    console.error('Failed to load note:', error);
    alert('Failed to load note: ' + error);
    currentWindow.close();
  }
}

function setupEventHandlers() {
  // Save button
  document.getElementById('save-btn').addEventListener('click', async () => {
    await saveNote();
  });

  // Close button
  document.getElementById('close-btn').addEventListener('click', async () => {
    if (isDirty) {
      await saveNote();
    }
    currentWindow.close();
  });

  // Delete button
  document.getElementById('delete-btn').addEventListener('click', async () => {
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
  window.addEventListener('beforeunload', async (e) => {
    if (isDirty) {
      await saveNote();
    }
  });
}

async function saveNote() {
  if (!isDirty) return;

  const saveBtn = document.getElementById('save-btn');
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  try {
    const content = editor.getContents();
    const contentJson = JSON.stringify(content);

    await invoke('update_note', {
      id: noteId,
      title: currentNote.title,
      contentJson: contentJson
    });

    isDirty = false;
    saveBtn.textContent = 'Saved';
    console.log('Note saved successfully');
  } catch (error) {
    console.error('Failed to save note:', error);
    saveBtn.textContent = 'Error';
    setTimeout(() => updateSaveButton(), 2000);
  }
}

function updateSaveButton() {
  const saveBtn = document.getElementById('save-btn');
  if (isDirty) {
    saveBtn.textContent = 'Save';
    saveBtn.disabled = false;
    saveBtn.classList.add('sticky-btn-primary');
  } else {
    saveBtn.textContent = 'Saved';
    saveBtn.disabled = true;
    saveBtn.classList.remove('sticky-btn-primary');
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

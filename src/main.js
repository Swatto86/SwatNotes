import { invoke } from '@tauri-apps/api/core';
import { createNote, searchNotes } from './utils/notesApi.js';
import { renderNotesList } from './components/notesList.js';
import { createNoteEditor } from './components/noteEditor.js';

// Application state
let currentEditor = null;
let currentNote = null;

// Theme management
const THEME_KEY = 'quicknotes-theme';

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const theme = getStoredTheme();
  setTheme(theme);
}

// Theme switcher
function setupThemeSwitcher() {
  const themeLinks = document.querySelectorAll('[data-theme]');
  themeLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const theme = link.getAttribute('data-theme');
      setTheme(theme);
    });
  });
}

// Test Tauri command
async function testGreet() {
  try {
    const result = await invoke('greet', { name: 'World' });
    console.log('Greet result:', result);
  } catch (error) {
    console.error('Error calling greet:', error);
  }
}

// Get app info
async function getAppInfo() {
  try {
    const info = await invoke('get_app_info');
    console.log('App info:', info);
    return info;
  } catch (error) {
    console.error('Error getting app info:', error);
    return null;
  }
}

// UI Event Handlers
function setupEventHandlers() {
  // New Note button
  const newNoteBtn = document.getElementById('new-note-btn');
  newNoteBtn?.addEventListener('click', async () => {
    await handleCreateNote();
  });

  // Settings button
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn?.addEventListener('click', () => {
    const modal = document.getElementById('settings-modal');
    modal?.showModal();
  });

  // Search input with debounce
  const searchInput = document.getElementById('search-input');
  let searchTimeout = null;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      await handleSearch(e.target.value);
    }, 300);
  });
}

// Create a new note
async function handleCreateNote() {
  try {
    const newNote = await createNote('Untitled', JSON.stringify({ ops: [{ insert: '\n' }] }));
    await refreshNotesList();
    openNoteInEditor(newNote);
  } catch (error) {
    console.error('Failed to create note:', error);
    alert('Failed to create note');
  }
}

// Search notes
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

// Refresh notes list
async function refreshNotesList() {
  await renderNotesList('notes-list', openNoteInEditor, null);
}

// Render filtered notes
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

  // Reuse the same rendering logic
  container.innerHTML = notes.map(note => {
    const preview = extractTextPreview(note.content_json);
    const date = formatRelativeDate(note.updated_at);
    return `
      <div id="note-${note.id}" class="note-card card bg-base-100 hover:bg-base-200 cursor-pointer p-4 mb-2 border border-base-300">
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-lg truncate">${escapeHtml(note.title)}</h3>
            <p class="text-sm text-base-content/70 line-clamp-2 mt-1">${preview}</p>
            <p class="text-xs text-base-content/50 mt-2">${date}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach click listeners
  notes.forEach(note => {
    const card = document.getElementById(`note-${note.id}`);
    card?.addEventListener('click', () => openNoteInEditor(note));
  });
}

// Open note in editor
function openNoteInEditor(note) {
  currentNote = note;

  // Cleanup previous editor
  if (currentEditor) {
    currentEditor.destroy();
  }

  // Update editor container
  const editorContainer = document.getElementById('editor-container');
  editorContainer.innerHTML = '<div id="note-editor-wrapper"></div>';

  // Create new editor
  currentEditor = createNoteEditor('note-editor-wrapper', note, (updatedNote) => {
    // Refresh list when note is saved
    refreshNotesList();
  });

  // Highlight selected note in list
  document.querySelectorAll('.note-card').forEach(card => {
    card.classList.remove('ring-2', 'ring-primary');
  });
  const selectedCard = document.getElementById(`note-${note.id}`);
  if (selectedCard) {
    selectedCard.classList.add('ring-2', 'ring-primary');
  }
}

// Helper functions
function extractTextPreview(contentJson) {
  try {
    const content = JSON.parse(contentJson);
    if (content.ops && Array.isArray(content.ops)) {
      const text = content.ops
        .map(op => (typeof op.insert === 'string' ? op.insert : ''))
        .join('')
        .trim();
      return text.substring(0, 100) || 'Empty note';
    }
  } catch (e) {
    console.error('Failed to parse content:', e);
  }
  return 'Empty note';
}

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} min${mins > 1 ? 's' : ''} ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize app
async function init() {
  console.log('Initializing QuickNotes...');

  // Initialize theme
  initTheme();
  setupThemeSwitcher();

  // Setup event handlers
  setupEventHandlers();

  // Test backend connection
  await testGreet();
  const appInfo = await getAppInfo();

  if (appInfo) {
    console.log('App Version:', appInfo.version);
    console.log('App Data Directory:', appInfo.app_data_dir);
  }

  // Load notes
  await refreshNotesList();

  console.log('QuickNotes initialized successfully!');
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for use in other modules
export { invoke, setTheme, getStoredTheme };

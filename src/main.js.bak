import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { createNote, searchNotes } from './utils/notesApi.js';
import { renderNotesList } from './components/notesList.js';
import { createNoteEditor } from './components/noteEditor.js';
import { createBackup, listBackups, restoreBackup } from './utils/backupApi.js';

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
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    // Set current theme as selected
    const currentTheme = getStoredTheme();
    themeSelect.value = currentTheme;

    // Listen for changes
    themeSelect.addEventListener('change', (e) => {
      const theme = e.target.value;
      setTheme(theme);
    });
  }
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
  settingsBtn?.addEventListener('click', async () => {
    const modal = document.getElementById('settings-modal');
    modal?.showModal();

    // Update theme selector to current theme
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = getStoredTheme();
    }

    // Load backups when modal opens
    await loadBackupsList();
  });

  // Settings modal close handlers
  const settingsModal = document.getElementById('settings-modal');
  const modalCloseBtn = settingsModal?.querySelector('.modal-action button');
  const modalBackdrop = settingsModal?.querySelector('.modal-backdrop');

  modalCloseBtn?.addEventListener('click', () => {
    settingsModal?.close();
  });

  modalBackdrop?.addEventListener('click', () => {
    settingsModal?.close();
  });

  // Backup now button
  const backupNowBtn = document.getElementById('backup-now-btn');
  backupNowBtn?.addEventListener('click', async () => {
    await handleBackupNow();
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
    // Open new note in floating window instead of main editor
    await invoke('open_note_window', { noteId: newNote.id });
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

// Backup handlers
async function handleBackupNow() {
  const statusEl = document.getElementById('backup-status');
  const btnEl = document.getElementById('backup-now-btn');
  const passwordInput = document.getElementById('backup-password');

  try {
    // Validate password
    const password = passwordInput?.value?.trim();
    if (!password) {
      statusEl.textContent = 'Please enter a backup password';
      statusEl.className = 'text-sm text-error';
      return;
    }

    if (password.length < 8) {
      statusEl.textContent = 'Password must be at least 8 characters';
      statusEl.className = 'text-sm text-error';
      return;
    }

    btnEl.disabled = true;
    statusEl.textContent = 'Creating encrypted backup...';
    statusEl.className = 'text-sm text-info';

    const backupPath = await createBackup(password);

    statusEl.textContent = `Encrypted backup created successfully!`;
    statusEl.className = 'text-sm text-success';

    // Clear password field
    if (passwordInput) {
      passwordInput.value = '';
    }

    // Refresh backups list
    await loadBackupsList();

    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Backup failed:', error);
    statusEl.textContent = 'Backup failed: ' + error;
    statusEl.className = 'text-sm text-error';
  } finally {
    btnEl.disabled = false;
  }
}

async function loadBackupsList() {
  const listEl = document.getElementById('backups-list');
  if (!listEl) return;

  try {
    const backups = await listBackups();

    if (backups.length === 0) {
      listEl.innerHTML = '<p class="text-sm text-base-content/50">No backups yet.</p>';
      return;
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    listEl.innerHTML = backups
      .slice(0, 5) // Show last 5
      .map(
        (backup, index) => `
      <div class="flex justify-between items-center p-2 bg-base-200 rounded mb-2">
        <div>
          <p class="text-sm font-medium">${formatDate(backup.timestamp)}</p>
          <p class="text-xs text-base-content/50">${formatFileSize(backup.size)}</p>
        </div>
        <button class="btn btn-primary btn-xs restore-btn" data-backup-index="${index}">Restore</button>
      </div>
    `
      )
      .join('');

    // Attach click listeners to restore buttons
    const recentBackups = backups.slice(0, 5);
    document.querySelectorAll('.restore-btn').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const backup = recentBackups[index];
        handleRestoreBackup(backup.path, backup.timestamp);
      });
    });
  } catch (error) {
    console.error('Failed to load backups:', error);
    listEl.innerHTML = '<p class="text-sm text-error">Failed to load backups</p>';
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Restore backup handler
async function handleRestoreBackup(backupPath, backupTimestamp) {
  const confirmed = confirm(
    `Are you sure you want to restore from backup created on ${formatDate(backupTimestamp)}?\n\n` +
    `This will replace all current data. The application will need to restart after restore.`
  );

  if (!confirmed) {
    return;
  }

  const password = prompt('Enter the backup password:');
  if (!password) {
    return;
  }

  const statusEl = document.getElementById('backup-status');

  try {
    statusEl.textContent = 'Restoring backup... Please wait.';
    statusEl.className = 'text-sm text-info';

    await restoreBackup(backupPath, password);

    statusEl.textContent = 'Restore completed! Please restart the application.';
    statusEl.className = 'text-sm text-success';

    // Show restart prompt
    setTimeout(() => {
      alert('Restore completed successfully!\n\nPlease close and restart the application to see the restored data.');
    }, 500);
  } catch (error) {
    console.error('Restore failed:', error);
    statusEl.textContent = 'Restore failed: ' + error;
    statusEl.className = 'text-sm text-error';
  }
}

// Initialize app
async function init() {
  console.log('Initializing QuickNotes...');

  // Initialize theme
  initTheme();
  setupThemeSwitcher();

  // Setup event handlers
  setupEventHandlers();

  // Setup reminder notification listener
  await setupReminderListener();

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

  // Show window after initialization to prevent white flash
  const currentWindow = getCurrentWebviewWindow();
  await currentWindow.show();
}

// Setup reminder notification listener
async function setupReminderListener() {
  await listen('reminder-triggered', (event) => {
    const { note_id, note_title } = event.payload;
    console.log('Reminder triggered for note:', note_title);

    // Show in-app alert
    alert(`Reminder: ${note_title}`);

    // Optionally open the note
    // You could add logic here to open the specific note
  });

  // Listen for create-new-note event from tray/hotkey
  await listen('create-new-note', async () => {
    console.log('Create new note triggered from tray/hotkey');
    await handleCreateNote();
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for use in other modules
export { invoke, setTheme, getStoredTheme };

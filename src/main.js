/**
 * QuickNotes - Main Application Entry Point
 * Coordinates application initialization and module setup
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { initTheme, setupThemeSwitcher } from './ui/theme.js';
import { setupEventHandlers, setupReminderListener } from './events/handlers.js';
import { renderNotesList } from './components/notesList.js';

/**
 * Test the backend connection
 */
async function testGreet() {
  try {
    const result = await invoke('greet', { name: 'World' });
    console.log('Greet result:', result);
  } catch (error) {
    console.error('Error calling greet:', error);
  }
}

/**
 * Get application information from backend
 * @returns {Promise<Object|null>} App info object or null on error
 */
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

/**
 * Refresh the notes list display
 */
async function refreshNotesList() {
  // Dummy callback since we don't open notes in main window anymore
  const dummyCallback = () => {};
  await renderNotesList('notes-list', dummyCallback, null);
}

/**
 * Initialize the application
 * Sets up all modules, loads data, and displays the window
 */
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

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

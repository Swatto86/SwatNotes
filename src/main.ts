/**
 * SwatNotes - Main Application Entry Point
 * Coordinates application initialization and module setup
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { initTheme, setupThemeSwitcher } from './ui/theme';
import { setupEventHandlers, setupReminderListener } from './events/handlers';
import { renderNotesList } from './components/notesList';
import type { AppInfo } from './types';

/**
 * Test the backend connection (disabled to reduce log noise)
 */
async function testGreet(): Promise<void> {
  // Disabled - uncomment for debugging backend connection
  // try {
  //   const result = await invoke<string>('greet', { name: 'World' });
  //   console.log('Greet result:', result);
  // } catch (error) {
  //   console.error('Error calling greet:', error);
  // }
}

/**
 * Get application information from backend
 * @returns App info object or null on error
 */
async function getAppInfo(): Promise<AppInfo | null> {
  try {
    const info = await invoke<AppInfo>('get_app_info');
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
async function refreshNotesList(): Promise<void> {
  // Dummy callback since we don't open notes in main window anymore
  const dummyCallback = () => {};
  await renderNotesList('notes-list', dummyCallback);
}

/**
 * Initialize the application
 * Sets up all modules, loads data, and displays the window
 */
async function init(): Promise<void> {
  console.log('Initializing SwatNotes...');

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
    console.log('App Version:', appInfo.version);
    console.log('App Data Directory:', appInfo.app_data_dir);
  }

  // Load notes
  await refreshNotesList();

  console.log('SwatNotes initialized successfully!');

  // NOTE: Main window stays hidden - only accessible via system tray
  // The app is tray-focused, not window-focused
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

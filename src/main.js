import { invoke } from '@tauri-apps/api/core';

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
  newNoteBtn?.addEventListener('click', () => {
    console.log('New note clicked');
    // Will be implemented in Slice 3
  });

  // Settings button
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn?.addEventListener('click', () => {
    const modal = document.getElementById('settings-modal');
    modal?.showModal();
  });

  // Search input
  const searchInput = document.getElementById('search-input');
  searchInput?.addEventListener('input', (e) => {
    console.log('Search:', e.target.value);
    // Will be implemented in Slice 3
  });
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

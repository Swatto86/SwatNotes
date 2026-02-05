/**
 * Theme Management Module
 * Handles theme selection, storage, and application
 */

import { THEME_KEY, DEFAULT_THEME } from '../config';

/**
 * Get the currently stored theme from localStorage
 * @returns {string} The theme name
 */
export function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
}

/**
 * Apply a theme to the document
 * @param {string} theme - The theme name to apply
 */
export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * Initialize the theme on app startup
 * Also sets up a listener for theme changes from other windows
 */
export function initTheme() {
  const theme = getStoredTheme();
  document.documentElement.setAttribute('data-theme', theme);

  // Listen for theme changes from other windows (e.g., settings window)
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY && event.newValue) {
      document.documentElement.setAttribute('data-theme', event.newValue);
    }
  });
}

/**
 * Setup the theme switcher UI component
 */
export function setupThemeSwitcher() {
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
  if (themeSelect) {
    // Set current theme as selected
    const currentTheme = getStoredTheme();
    themeSelect.value = currentTheme;

    // Listen for changes
    themeSelect.addEventListener('change', (e) => {
      const theme = (e.target as HTMLSelectElement).value;
      setTheme(theme);
    });
  }
}

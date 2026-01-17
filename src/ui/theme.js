/**
 * Theme Management Module
 * Handles theme selection, storage, and application
 */

import { THEME_KEY, DEFAULT_THEME } from '../config.js';

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
 */
export function initTheme() {
  const theme = getStoredTheme();
  setTheme(theme);
}

/**
 * Setup the theme switcher UI component
 */
export function setupThemeSwitcher() {
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

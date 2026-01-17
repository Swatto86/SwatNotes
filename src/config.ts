/**
 * Application Configuration
 * Central location for all constants and configuration values
 */

// Theme configuration
export const THEME_KEY = 'quicknotes-theme';
export const DEFAULT_THEME = 'light';

// Window dimensions for sticky notes
export const STICKY_NOTE_DEFAULT_WIDTH = 350;
export const STICKY_NOTE_DEFAULT_HEIGHT = 400;
export const STICKY_NOTE_MIN_WIDTH = 250;
export const STICKY_NOTE_MIN_HEIGHT = 300;

// Auto-save configuration
export const AUTO_SAVE_DELAY_MS = 1000;

// Search debounce delay
export const SEARCH_DEBOUNCE_MS = 300;

// Date formatting
export const TIME_UNITS = {
  MINUTE: 60000,
  HOUR: 3600000,
  DAY: 86400000,
  WEEK: 604800000,
};

// Backup configuration
export const MIN_PASSWORD_LENGTH = 8;
export const BACKUP_LIST_LIMIT = 5;

// Editor configuration
export const DEFAULT_NOTE_CONTENT = JSON.stringify({ ops: [{ insert: '\n' }] });
export const DEFAULT_NOTE_TITLE = 'Untitled';

// Application info
export const APP_VERSION = '0.1.0';
export const APP_NAME = 'QuickNotes';

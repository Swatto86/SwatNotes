/**
 * Tests for theme management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStoredTheme, setTheme, initTheme, setupThemeSwitcher } from './theme';

// Mock config
vi.mock('../config', () => ({
  THEME_KEY: 'swatnotes-theme',
  DEFAULT_THEME: 'light',
}));

describe('theme', () => {
  const mockLocalStorage: { [key: string]: string } = {};

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);

    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
    });

    // Reset document state
    document.documentElement.removeAttribute('data-theme');
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('getStoredTheme', () => {
    it('should return stored theme from localStorage', () => {
      mockLocalStorage['swatnotes-theme'] = 'dark';

      const theme = getStoredTheme();

      expect(theme).toBe('dark');
    });

    it('should return default theme when no theme stored', () => {
      const theme = getStoredTheme();

      expect(theme).toBe('light');
    });

    it('should return custom stored theme', () => {
      mockLocalStorage['swatnotes-theme'] = 'dracula';

      const theme = getStoredTheme();

      expect(theme).toBe('dracula');
    });
  });

  describe('setTheme', () => {
    it('should set theme on document element', () => {
      setTheme('dark');

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should store theme in localStorage', () => {
      setTheme('cupcake');

      expect(localStorage.setItem).toHaveBeenCalledWith('swatnotes-theme', 'cupcake');
    });

    it('should handle various DaisyUI themes', () => {
      const themes = [
        'light',
        'dark',
        'cupcake',
        'bumblebee',
        'emerald',
        'corporate',
        'synthwave',
        'retro',
        'cyberpunk',
        'valentine',
        'halloween',
      ];

      themes.forEach((theme) => {
        setTheme(theme);
        expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
      });
    });
  });

  describe('initTheme', () => {
    it('should apply stored theme on init', () => {
      mockLocalStorage['swatnotes-theme'] = 'dark';

      initTheme();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should apply default theme when none stored', () => {
      initTheme();

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should set up storage event listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      initTheme();

      expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('should update theme when storage event fires', () => {
      initTheme();

      // Simulate storage event from another window
      const storageEvent = new StorageEvent('storage', {
        key: 'swatnotes-theme',
        newValue: 'cyberpunk',
      });
      window.dispatchEvent(storageEvent);

      expect(document.documentElement.getAttribute('data-theme')).toBe('cyberpunk');
    });

    it('should ignore storage events for other keys', () => {
      initTheme();
      document.documentElement.setAttribute('data-theme', 'light');

      const storageEvent = new StorageEvent('storage', {
        key: 'other-key',
        newValue: 'dark',
      });
      window.dispatchEvent(storageEvent);

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should ignore storage events with null value', () => {
      initTheme();
      document.documentElement.setAttribute('data-theme', 'dark');

      const storageEvent = new StorageEvent('storage', {
        key: 'swatnotes-theme',
        newValue: null,
      });
      window.dispatchEvent(storageEvent);

      // Theme should remain unchanged
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('setupThemeSwitcher', () => {
    it('should set select value to current theme', () => {
      mockLocalStorage['swatnotes-theme'] = 'dark';

      document.body.innerHTML = `
        <select id="theme-select">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      `;

      setupThemeSwitcher();

      const select = document.getElementById('theme-select') as HTMLSelectElement;
      expect(select.value).toBe('dark');
    });

    it('should change theme when select value changes', () => {
      document.body.innerHTML = `
        <select id="theme-select">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="cupcake">Cupcake</option>
        </select>
      `;

      setupThemeSwitcher();

      const select = document.getElementById('theme-select') as HTMLSelectElement;
      select.value = 'cupcake';
      select.dispatchEvent(new Event('change'));

      expect(document.documentElement.getAttribute('data-theme')).toBe('cupcake');
      expect(localStorage.setItem).toHaveBeenCalledWith('swatnotes-theme', 'cupcake');
    });

    it('should handle missing theme-select element gracefully', () => {
      document.body.innerHTML = '';

      // Should not throw
      expect(() => setupThemeSwitcher()).not.toThrow();
    });

    it('should handle multiple theme changes', () => {
      document.body.innerHTML = `
        <select id="theme-select">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="synthwave">Synthwave</option>
        </select>
      `;

      setupThemeSwitcher();

      const select = document.getElementById('theme-select') as HTMLSelectElement;

      // Change to dark
      select.value = 'dark';
      select.dispatchEvent(new Event('change'));
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      // Change to synthwave
      select.value = 'synthwave';
      select.dispatchEvent(new Event('change'));
      expect(document.documentElement.getAttribute('data-theme')).toBe('synthwave');

      // Change back to light
      select.value = 'light';
      select.dispatchEvent(new Event('change'));
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('theme persistence', () => {
    it('should persist theme across page loads', () => {
      // First "page load"
      setTheme('halloween');

      // Simulate new page load
      document.documentElement.removeAttribute('data-theme');
      initTheme();

      expect(document.documentElement.getAttribute('data-theme')).toBe('halloween');
    });

    it('should sync theme between windows via storage events', () => {
      // Window 1 initializes
      initTheme();

      // Window 2 changes theme (simulated via storage event)
      const storageEvent = new StorageEvent('storage', {
        key: 'swatnotes-theme',
        newValue: 'retro',
      });
      window.dispatchEvent(storageEvent);

      expect(document.documentElement.getAttribute('data-theme')).toBe('retro');
    });
  });
});

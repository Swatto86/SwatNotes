/**
 * Tests for application configuration
 */

import { describe, it, expect } from 'vitest';
import {
  THEME_KEY,
  DEFAULT_THEME,
  STICKY_NOTE_DEFAULT_WIDTH,
  STICKY_NOTE_DEFAULT_HEIGHT,
  STICKY_NOTE_MIN_WIDTH,
  STICKY_NOTE_MIN_HEIGHT,
  AUTO_SAVE_DELAY_MS,
  SEARCH_DEBOUNCE_MS,
  TIME_UNITS,
  MIN_PASSWORD_LENGTH,
  BACKUP_LIST_LIMIT,
  DEFAULT_NOTE_CONTENT,
  DEFAULT_NOTE_TITLE,
  APP_VERSION,
  APP_NAME,
} from './config';

describe('config', () => {
  describe('theme configuration', () => {
    it('should have a valid theme storage key', () => {
      expect(THEME_KEY).toBe('swatnotes-theme');
      expect(typeof THEME_KEY).toBe('string');
      expect(THEME_KEY.length).toBeGreaterThan(0);
    });

    it('should have a valid default theme', () => {
      expect(DEFAULT_THEME).toBe('light');
      expect(['light', 'dark']).toContain(DEFAULT_THEME);
    });
  });

  describe('sticky note dimensions', () => {
    it('should have reasonable default dimensions', () => {
      expect(STICKY_NOTE_DEFAULT_WIDTH).toBe(350);
      expect(STICKY_NOTE_DEFAULT_HEIGHT).toBe(400);
    });

    it('should have minimum dimensions smaller than defaults', () => {
      expect(STICKY_NOTE_MIN_WIDTH).toBeLessThan(STICKY_NOTE_DEFAULT_WIDTH);
      expect(STICKY_NOTE_MIN_HEIGHT).toBeLessThan(STICKY_NOTE_DEFAULT_HEIGHT);
    });

    it('should have reasonable minimum dimensions', () => {
      expect(STICKY_NOTE_MIN_WIDTH).toBe(250);
      expect(STICKY_NOTE_MIN_HEIGHT).toBe(300);
      expect(STICKY_NOTE_MIN_WIDTH).toBeGreaterThanOrEqual(100);
      expect(STICKY_NOTE_MIN_HEIGHT).toBeGreaterThanOrEqual(100);
    });

    it('should have positive dimension values', () => {
      expect(STICKY_NOTE_DEFAULT_WIDTH).toBeGreaterThan(0);
      expect(STICKY_NOTE_DEFAULT_HEIGHT).toBeGreaterThan(0);
      expect(STICKY_NOTE_MIN_WIDTH).toBeGreaterThan(0);
      expect(STICKY_NOTE_MIN_HEIGHT).toBeGreaterThan(0);
    });
  });

  describe('timing configuration', () => {
    it('should have reasonable auto-save delay', () => {
      expect(AUTO_SAVE_DELAY_MS).toBe(1000);
      expect(AUTO_SAVE_DELAY_MS).toBeGreaterThanOrEqual(500);
      expect(AUTO_SAVE_DELAY_MS).toBeLessThanOrEqual(5000);
    });

    it('should have reasonable search debounce', () => {
      expect(SEARCH_DEBOUNCE_MS).toBe(300);
      expect(SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(100);
      expect(SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(1000);
    });
  });

  describe('time units', () => {
    it('should have correct time unit values', () => {
      expect(TIME_UNITS.MINUTE).toBe(60000);
      expect(TIME_UNITS.HOUR).toBe(3600000);
      expect(TIME_UNITS.DAY).toBe(86400000);
      expect(TIME_UNITS.WEEK).toBe(604800000);
    });

    it('should have consistent relationships between units', () => {
      expect(TIME_UNITS.HOUR).toBe(TIME_UNITS.MINUTE * 60);
      expect(TIME_UNITS.DAY).toBe(TIME_UNITS.HOUR * 24);
      expect(TIME_UNITS.WEEK).toBe(TIME_UNITS.DAY * 7);
    });

    it('should be in milliseconds', () => {
      // 1 minute = 60,000 milliseconds
      expect(TIME_UNITS.MINUTE).toBe(60 * 1000);
    });
  });

  describe('backup configuration', () => {
    it('should have reasonable minimum password length', () => {
      expect(MIN_PASSWORD_LENGTH).toBe(8);
      expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
    });

    it('should have reasonable backup list limit', () => {
      expect(BACKUP_LIST_LIMIT).toBe(5);
      expect(BACKUP_LIST_LIMIT).toBeGreaterThan(0);
      expect(BACKUP_LIST_LIMIT).toBeLessThanOrEqual(20);
    });
  });

  describe('editor configuration', () => {
    it('should have valid default note content as JSON', () => {
      expect(() => JSON.parse(DEFAULT_NOTE_CONTENT)).not.toThrow();
    });

    it('should have default content as empty Quill Delta', () => {
      const content = JSON.parse(DEFAULT_NOTE_CONTENT);
      expect(content).toHaveProperty('ops');
      expect(Array.isArray(content.ops)).toBe(true);
      expect(content.ops.length).toBe(1);
      expect(content.ops[0].insert).toBe('\n');
    });

    it('should have a default note title', () => {
      expect(DEFAULT_NOTE_TITLE).toBe('Untitled');
      expect(typeof DEFAULT_NOTE_TITLE).toBe('string');
      expect(DEFAULT_NOTE_TITLE.length).toBeGreaterThan(0);
    });
  });

  describe('application info', () => {
    it('should have valid version format', () => {
      expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have application name', () => {
      expect(APP_NAME).toBe('SwatNotes');
      expect(typeof APP_NAME).toBe('string');
      expect(APP_NAME.length).toBeGreaterThan(0);
    });
  });

  describe('configuration consistency', () => {
    it('should have all exports defined', () => {
      expect(THEME_KEY).toBeDefined();
      expect(DEFAULT_THEME).toBeDefined();
      expect(STICKY_NOTE_DEFAULT_WIDTH).toBeDefined();
      expect(STICKY_NOTE_DEFAULT_HEIGHT).toBeDefined();
      expect(STICKY_NOTE_MIN_WIDTH).toBeDefined();
      expect(STICKY_NOTE_MIN_HEIGHT).toBeDefined();
      expect(AUTO_SAVE_DELAY_MS).toBeDefined();
      expect(SEARCH_DEBOUNCE_MS).toBeDefined();
      expect(TIME_UNITS).toBeDefined();
      expect(MIN_PASSWORD_LENGTH).toBeDefined();
      expect(BACKUP_LIST_LIMIT).toBeDefined();
      expect(DEFAULT_NOTE_CONTENT).toBeDefined();
      expect(DEFAULT_NOTE_TITLE).toBeDefined();
      expect(APP_VERSION).toBeDefined();
      expect(APP_NAME).toBeDefined();
    });

    it('should have numeric values be numbers', () => {
      expect(typeof STICKY_NOTE_DEFAULT_WIDTH).toBe('number');
      expect(typeof STICKY_NOTE_DEFAULT_HEIGHT).toBe('number');
      expect(typeof STICKY_NOTE_MIN_WIDTH).toBe('number');
      expect(typeof STICKY_NOTE_MIN_HEIGHT).toBe('number');
      expect(typeof AUTO_SAVE_DELAY_MS).toBe('number');
      expect(typeof SEARCH_DEBOUNCE_MS).toBe('number');
      expect(typeof MIN_PASSWORD_LENGTH).toBe('number');
      expect(typeof BACKUP_LIST_LIMIT).toBe('number');
    });

    it('should have string values be strings', () => {
      expect(typeof THEME_KEY).toBe('string');
      expect(typeof DEFAULT_THEME).toBe('string');
      expect(typeof DEFAULT_NOTE_CONTENT).toBe('string');
      expect(typeof DEFAULT_NOTE_TITLE).toBe('string');
      expect(typeof APP_VERSION).toBe('string');
      expect(typeof APP_NAME).toBe('string');
    });
  });
});

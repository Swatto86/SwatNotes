/**
 * Tests for logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from './logger';

describe('logger', () => {
  const consoleMocks = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  beforeEach(() => {
    // Mock console methods
    vi.spyOn(console, 'debug').mockImplementation(consoleMocks.debug);
    vi.spyOn(console, 'info').mockImplementation(consoleMocks.info);
    vi.spyOn(console, 'warn').mockImplementation(consoleMocks.warn);
    vi.spyOn(console, 'error').mockImplementation(consoleMocks.error);

    // Reset logger to default state
    logger.enableAll();
    logger.configure({ timestamps: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should log debug messages when level is DEBUG', () => {
      logger.setLevel(LogLevel.DEBUG);

      logger.debug('Debug message');

      expect(consoleMocks.debug).toHaveBeenCalledWith('[DEBUG] Debug message');
    });

    it('should log info messages when level is INFO or lower', () => {
      logger.setLevel(LogLevel.INFO);

      logger.info('Info message');

      expect(consoleMocks.info).toHaveBeenCalledWith('[INFO] Info message');
    });

    it('should log warn messages when level is WARN or lower', () => {
      logger.setLevel(LogLevel.WARN);

      logger.warn('Warning message');

      expect(consoleMocks.warn).toHaveBeenCalledWith('[WARN] Warning message');
    });

    it('should log error messages when level is ERROR or lower', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.error('Error message');

      expect(consoleMocks.error).toHaveBeenCalledWith('[ERROR] Error message');
    });

    it('should not log debug when level is INFO', () => {
      logger.setLevel(LogLevel.INFO);

      logger.debug('Debug message');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
    });

    it('should not log info when level is WARN', () => {
      logger.setLevel(LogLevel.WARN);

      logger.info('Info message');

      expect(consoleMocks.info).not.toHaveBeenCalled();
    });

    it('should not log anything when level is NONE', () => {
      logger.setLevel(LogLevel.NONE);

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.warn).not.toHaveBeenCalled();
      expect(consoleMocks.error).not.toHaveBeenCalled();
    });
  });

  describe('context', () => {
    it('should include context in log message', () => {
      logger.setLevel(LogLevel.DEBUG);

      logger.debug('Message', 'TestContext');

      expect(consoleMocks.debug).toHaveBeenCalledWith('[DEBUG] [TestContext] Message');
    });

    it('should omit context when not provided', () => {
      logger.setLevel(LogLevel.INFO);

      logger.info('Message without context');

      expect(consoleMocks.info).toHaveBeenCalledWith('[INFO] Message without context');
    });

    it('should handle empty string context', () => {
      logger.setLevel(LogLevel.INFO);

      logger.info('Message', '');

      expect(consoleMocks.info).toHaveBeenCalledWith('[INFO] Message');
    });
  });

  describe('additional arguments', () => {
    it('should pass additional arguments to console', () => {
      logger.setLevel(LogLevel.DEBUG);
      const extra = { key: 'value' };

      logger.debug('Message with data', 'Context', extra);

      expect(consoleMocks.debug).toHaveBeenCalledWith('[DEBUG] [Context] Message with data', extra);
    });

    it('should handle multiple additional arguments', () => {
      logger.setLevel(LogLevel.INFO);

      logger.info('Message', 'Ctx', 'arg1', 42, { data: true });

      expect(consoleMocks.info).toHaveBeenCalledWith('[INFO] [Ctx] Message', 'arg1', 42, { data: true });
    });
  });

  describe('configure', () => {
    it('should update log level via configure', () => {
      logger.configure({ level: LogLevel.ERROR });

      logger.warn('Warning');
      logger.error('Error');

      expect(consoleMocks.warn).not.toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalled();
    });

    it('should enable timestamps via configure', () => {
      logger.configure({ timestamps: true });
      logger.setLevel(LogLevel.INFO);

      logger.info('Timestamped message');

      // Check that the first argument contains a timestamp pattern
      expect(consoleMocks.info).toHaveBeenCalled();
      const firstArg = consoleMocks.info.mock.calls[0][0];
      // Timestamp should match ISO format pattern
      expect(firstArg).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should disable logging via configure', () => {
      logger.configure({ enabled: false });

      logger.error('Critical error');

      expect(consoleMocks.error).not.toHaveBeenCalled();
    });
  });

  describe('enableAll', () => {
    it('should enable all logging', () => {
      logger.configure({ enabled: false, level: LogLevel.NONE });

      logger.enableAll();

      logger.debug('Debug');
      expect(consoleMocks.debug).toHaveBeenCalled();
    });
  });

  describe('disable', () => {
    it('should disable all logging', () => {
      logger.disable();

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.warn).not.toHaveBeenCalled();
      expect(consoleMocks.error).not.toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      logger.configure({
        level: LogLevel.WARN,
        timestamps: true,
        enabled: true
      });

      const config = logger.getConfig();

      expect(config.level).toBe(LogLevel.WARN);
      expect(config.timestamps).toBe(true);
      expect(config.enabled).toBe(true);
    });

    it('should return a copy of config', () => {
      const config = logger.getConfig();

      // Modifying returned config should not affect logger
      (config as any).level = LogLevel.NONE;

      const newConfig = logger.getConfig();
      expect(newConfig.level).not.toBe(LogLevel.NONE);
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct ordering', () => {
      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
      expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
      expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
      expect(LogLevel.ERROR).toBeLessThan(LogLevel.NONE);
    });
  });

  describe('real-world usage patterns', () => {
    it('should handle typical debug logging pattern', () => {
      logger.setLevel(LogLevel.DEBUG);

      const operation = 'loadNotes';
      const noteCount = 42;

      logger.debug(`Starting ${operation}`, 'NotesService');
      logger.debug(`Loaded ${noteCount} notes`, 'NotesService', { count: noteCount });

      expect(consoleMocks.debug).toHaveBeenCalledTimes(2);
    });

    it('should handle error logging with stack trace', () => {
      logger.setLevel(LogLevel.ERROR);
      const error = new Error('Something went wrong');

      logger.error('Operation failed', 'ErrorHandler', error);

      expect(consoleMocks.error).toHaveBeenCalledWith(
        '[ERROR] [ErrorHandler] Operation failed',
        error
      );
    });

    it('should work with production-like settings', () => {
      // Production would typically only log warnings and errors
      logger.configure({
        level: LogLevel.WARN,
        timestamps: false,
        enabled: true
      });

      logger.debug('Debug info');
      logger.info('User action');
      logger.warn('Deprecated API used');
      logger.error('Database connection failed');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.warn).toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalled();
    });
  });
});

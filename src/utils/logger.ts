/**
 * Structured Logging Utility
 *
 * Provides a centralized logging system that:
 * - Can be disabled in production builds
 * - Supports different log levels
 * - Adds timestamps and context
 * - Prevents sensitive data leakage in production
 */

/** Log levels in order of severity */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/** Logger configuration */
interface LoggerConfig {
  /** Minimum level to log (messages below this level are ignored) */
  level: LogLevel;
  /** Whether to include timestamps in log messages */
  timestamps: boolean;
  /** Whether logging is enabled at all */
  enabled: boolean;
}

/** Default configuration - enabled in development, minimal in production */
const DEFAULT_CONFIG: LoggerConfig = {
  level: (import.meta as any).env?.DEV ? LogLevel.DEBUG : LogLevel.WARN,
  timestamps: (import.meta as any).env?.DEV ?? false,
  enabled: true,
};

/** Current logger configuration */
let config: LoggerConfig = { ...DEFAULT_CONFIG };

/**
 * Format a log message with optional timestamp and context
 */
function formatMessage(level: string, context: string, message: string): string {
  const parts: string[] = [];

  if (config.timestamps) {
    parts.push(`[${new Date().toISOString()}]`);
  }

  parts.push(`[${level}]`);

  if (context) {
    parts.push(`[${context}]`);
  }

  parts.push(message);

  return parts.join(' ');
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return config.enabled && level >= config.level;
}

/**
 * Logger object with methods for each log level
 */
export const logger = {
  /**
   * Log a debug message (development only by default)
   * Use for detailed debugging information
   */
  debug(message: string, context: string = '', ...args: unknown[]): void {
    if (shouldLog(LogLevel.DEBUG)) {
      console.debug(formatMessage('DEBUG', context, message), ...args);
    }
  },

  /**
   * Log an info message
   * Use for general operational information
   */
  info(message: string, context: string = '', ...args: unknown[]): void {
    if (shouldLog(LogLevel.INFO)) {
      console.info(formatMessage('INFO', context, message), ...args);
    }
  },

  /**
   * Log a warning message
   * Use for potentially problematic situations
   */
  warn(message: string, context: string = '', ...args: unknown[]): void {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(formatMessage('WARN', context, message), ...args);
    }
  },

  /**
   * Log an error message
   * Use for error conditions
   */
  error(message: string, context: string = '', ...args: unknown[]): void {
    if (shouldLog(LogLevel.ERROR)) {
      console.error(formatMessage('ERROR', context, message), ...args);
    }
  },

  /**
   * Configure the logger
   */
  configure(newConfig: Partial<LoggerConfig>): void {
    config = { ...config, ...newConfig };
  },

  /**
   * Enable all logging (useful for debugging)
   */
  enableAll(): void {
    config.level = LogLevel.DEBUG;
    config.enabled = true;
  },

  /**
   * Disable all logging
   */
  disable(): void {
    config.enabled = false;
  },

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    config.level = level;
  },

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...config };
  },
};

// Export LogLevel for external configuration
export { LogLevel as Level };

// Expose logger globally for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).__logger = logger;
  (window as any).__LogLevel = LogLevel;
}

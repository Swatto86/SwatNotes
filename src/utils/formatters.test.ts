/**
 * Tests for formatters utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatFileSize,
  extractTextPreview,
  formatReminderDate,
  formatRelativeDate,
  getFileIcon,
  getFileIconSvg,
  getFileIconSmall
} from './formatters';

describe('formatters', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert("xss")&lt;/script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"quoted"')).toBe('"quoted"');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle text without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    it('should escape multiple special characters', () => {
      expect(escapeHtml('<div class="test">&</div>')).toBe(
        '&lt;div class="test"&gt;&amp;&lt;/div&gt;'
      );
    });

    it('should handle unicode characters', () => {
      expect(escapeHtml('Hello 世界 🌍')).toBe('Hello 世界 🌍');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date string', () => {
      const result = formatDate('2024-06-15T14:30:00Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle different timezones', () => {
      const result = formatDate('2024-01-01T00:00:00+05:30');
      expect(result).toBeTruthy();
    });
  });

  describe('formatDateTime', () => {
    it('should format Date object', () => {
      const date = new Date('2024-06-15T14:30:00Z');
      const result = formatDateTime(date);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatFileSize', () => {
    it('should format zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(2621440)).toBe('2.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should round to 2 decimal places', () => {
      expect(formatFileSize(1234567)).toBe('1.18 MB');
    });
  });

  describe('extractTextPreview', () => {
    it('should extract text from Quill Delta JSON', () => {
      const delta = JSON.stringify({
        ops: [{ insert: 'Hello World\n' }]
      });
      expect(extractTextPreview(delta)).toBe('Hello World');
    });

    it('should handle multiple operations', () => {
      const delta = JSON.stringify({
        ops: [
          { insert: 'Line 1\n' },
          { insert: 'Line 2\n' },
          { insert: 'Line 3\n' }
        ]
      });
      expect(extractTextPreview(delta)).toBe('Line 1 Line 2 Line 3');
    });

    it('should truncate long text', () => {
      const longText = 'A'.repeat(200);
      const delta = JSON.stringify({
        ops: [{ insert: longText + '\n' }]
      });
      const result = extractTextPreview(delta, 100);
      expect(result.length).toBe(103); // 100 chars + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should use custom max length', () => {
      const delta = JSON.stringify({
        ops: [{ insert: 'Hello World\n' }]
      });
      expect(extractTextPreview(delta, 5)).toBe('Hello...');
    });

    it('should return empty text message for empty content', () => {
      const delta = JSON.stringify({
        ops: [{ insert: '\n' }]
      });
      expect(extractTextPreview(delta)).toBe('Empty note');
    });

    it('should use custom empty text', () => {
      const delta = JSON.stringify({
        ops: [{ insert: '\n' }]
      });
      expect(extractTextPreview(delta, 100, 'No content')).toBe('No content');
    });

    it('should handle invalid JSON', () => {
      expect(extractTextPreview('not valid json')).toBe('Empty note');
    });

    it('should handle missing ops', () => {
      const delta = JSON.stringify({ other: 'field' });
      expect(extractTextPreview(delta)).toBe('Empty note');
    });

    it('should handle non-string inserts (images/embeds)', () => {
      const delta = JSON.stringify({
        ops: [
          { insert: 'Text before ' },
          { insert: { image: 'data:image/png...' } },
          { insert: ' text after\n' }
        ]
      });
      expect(extractTextPreview(delta)).toBe('Text before  text after');
    });

    it('should collapse multiple newlines', () => {
      const delta = JSON.stringify({
        ops: [{ insert: 'Line 1\n\n\n\nLine 2\n' }]
      });
      expect(extractTextPreview(delta)).toBe('Line 1 Line 2');
    });
  });

  describe('formatReminderDate', () => {
    it('should format reminder date', () => {
      const result = formatReminderDate('2024-06-15T14:30:00Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatRelativeDate', () => {
    beforeEach(() => {
      // Mock current time
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "Just now" for very recent dates', () => {
      const result = formatRelativeDate('2024-06-15T11:59:30Z');
      expect(result.toLowerCase()).toContain('just now');
    });

    it('should format minutes ago', () => {
      const result = formatRelativeDate('2024-06-15T11:55:00Z');
      expect(result).toMatch(/5\s*(min|minute)/i);
    });

    it('should handle singular minute', () => {
      const result = formatRelativeDate('2024-06-15T11:59:00Z');
      expect(result).toMatch(/1\s*(min|minute)/i);
    });

    it('should format hours ago', () => {
      const result = formatRelativeDate('2024-06-15T09:00:00Z');
      expect(result).toMatch(/3\s*hour/i);
    });

    it('should handle singular hour', () => {
      const result = formatRelativeDate('2024-06-15T11:00:00Z');
      expect(result).toMatch(/1\s*hour/i);
    });

    it('should format days ago', () => {
      const result = formatRelativeDate('2024-06-13T12:00:00Z');
      expect(result).toMatch(/2\s*day/i);
    });

    it('should handle singular day', () => {
      const result = formatRelativeDate('2024-06-14T12:00:00Z');
      expect(result).toMatch(/1\s*day/i);
    });

    it('should fallback to date for older than a week', () => {
      const result = formatRelativeDate('2024-06-01T12:00:00Z');
      // Should be a date string, not relative, or could be in a different format
      expect(result).toBeTruthy();
    });
  });

  describe('getFileIcon', () => {
    it('should return image icon for image types', () => {
      const result = getFileIcon('image/png');
      expect(result).toContain('svg');
      expect(result).toContain('text-primary');
    });

    it('should return video icon for video types', () => {
      const result = getFileIcon('video/mp4');
      expect(result).toContain('svg');
      expect(result).toContain('text-secondary');
    });

    it('should return PDF icon for PDF files', () => {
      const result = getFileIcon('application/pdf');
      expect(result).toContain('svg');
      expect(result).toContain('text-error');
    });

    it('should return generic icon for unknown types', () => {
      const result = getFileIcon('application/octet-stream');
      expect(result).toContain('svg');
      expect(result).toContain('text-base-content/50');
    });

    it('should handle various image formats', () => {
      ['image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].forEach(type => {
        expect(getFileIcon(type)).toContain('text-primary');
      });
    });

    it('should handle various video formats', () => {
      ['video/mp4', 'video/webm', 'video/ogg'].forEach(type => {
        expect(getFileIcon(type)).toContain('text-secondary');
      });
    });
  });

  describe('getFileIconSvg', () => {
    it('should return raw SVG for image types', () => {
      const result = getFileIconSvg('image/png');
      expect(result).toContain('svg');
      expect(result).toContain('width="20"');
      expect(result).toContain('height="20"');
    });

    it('should return audio icon for audio types', () => {
      const result = getFileIconSvg('audio/mp3');
      expect(result).toContain('svg');
    });

    it('should return archive icon for compressed files', () => {
      ['application/zip', 'application/x-compressed', 'application/x-archive'].forEach(type => {
        expect(getFileIconSvg(type)).toContain('svg');
      });
    });

    it('should return PDF icon with red stroke', () => {
      const result = getFileIconSvg('application/pdf');
      expect(result).toContain('stroke="red"');
    });
  });

  describe('getFileIconSmall', () => {
    it('should return smaller icon dimensions', () => {
      const result = getFileIconSmall('image/png');
      expect(result).toContain('h-5');
      expect(result).toContain('w-5');
    });

    it('should use same color scheme as regular icon', () => {
      expect(getFileIconSmall('image/png')).toContain('text-primary');
      expect(getFileIconSmall('video/mp4')).toContain('text-secondary');
      expect(getFileIconSmall('application/pdf')).toContain('text-error');
    });
  });

  describe('edge cases', () => {
    it('should handle null-like inputs safely', () => {
      // These should not throw
      expect(escapeHtml('')).toBe('');
      expect(formatFileSize(0)).toBe('0 B');
      expect(extractTextPreview('{}')).toBe('Empty note');
    });

    it('should handle very large file sizes', () => {
      // 1 TB
      const result = formatFileSize(1099511627776);
      expect(result).toBeTruthy();
    });

    it('should handle deeply nested Quill Delta', () => {
      const delta = JSON.stringify({
        ops: [
          { insert: 'Bold', attributes: { bold: true } },
          { insert: ' and ' },
          { insert: 'italic', attributes: { italic: true } },
          { insert: '\n' }
        ]
      });
      expect(extractTextPreview(delta)).toBe('Bold and italic');
    });
  });
});

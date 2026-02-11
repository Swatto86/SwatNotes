/**
 * Smart Paste Utility Tests
 */

import { describe, it, expect } from 'vitest';
import { processSmartPaste, isPlainText } from './smartPaste';

describe('smartPaste', () => {
  describe('isPlainText', () => {
    it('should return true for plain text', () => {
      expect(isPlainText('Hello world')).toBe(true);
      expect(isPlainText('Line 1\nLine 2')).toBe(true);
    });

    it('should return false for HTML content', () => {
      expect(isPlainText('<p>Hello</p>')).toBe(false);
      expect(isPlainText('<div>Content</div>')).toBe(false);
      expect(isPlainText('<strong>Bold</strong>')).toBe(false);
    });
  });

  describe('processSmartPaste', () => {
    describe('title detection', () => {
      it('should detect ALL CAPS titles', () => {
        const result = processSmartPaste('IMPORTANT ANNOUNCEMENT\n\nThis is the content.');

        // First op should be the title with bold and color
        expect(result.ops[0]).toMatchObject({
          insert: 'IMPORTANT ANNOUNCEMENT',
          attributes: expect.objectContaining({ bold: true, color: '#2563eb' }),
        });
        // Should have header formatting
        expect(result.ops[1]).toMatchObject({
          insert: '\n',
          attributes: { header: 1 },
        });
      });

      it('should detect short lines followed by blank lines as titles', () => {
        const result = processSmartPaste('\nProject Overview\n\nThis project aims to...');

        // Find the title op
        const titleOp = result.ops.find(
          (op) => typeof op.insert === 'string' && op.insert === 'Project Overview'
        );
        expect(titleOp?.attributes).toMatchObject({ bold: true });
      });
    });

    describe('list detection', () => {
      it('should convert bullet lists with dash', () => {
        const result = processSmartPaste('- Item 1\n- Item 2\n- Item 3');

        // Check for list formatting
        const listOps = result.ops.filter(
          (op) => op.attributes && (op.attributes as any).list === 'bullet'
        );
        expect(listOps.length).toBe(3);
      });

      it('should convert bullet lists with asterisk', () => {
        const result = processSmartPaste('* First\n* Second');

        const listOps = result.ops.filter(
          (op) => op.attributes && (op.attributes as any).list === 'bullet'
        );
        expect(listOps.length).toBe(2);
      });

      it('should convert ordered lists', () => {
        const result = processSmartPaste('1. First item\n2. Second item\n3. Third item');

        const listOps = result.ops.filter(
          (op) => op.attributes && (op.attributes as any).list === 'ordered'
        );
        expect(listOps.length).toBe(3);
      });

      it('should handle nested lists with indentation', () => {
        const result = processSmartPaste('- Parent\n  - Child\n  - Child 2');

        const indentedOps = result.ops.filter(
          (op) => op.attributes && (op.attributes as any).indent === 1
        );
        expect(indentedOps.length).toBe(2);
      });
    });

    describe('URL detection', () => {
      it('should detect and linkify URLs', () => {
        const result = processSmartPaste('Check out https://example.com for more info.');

        const linkOp = result.ops.find(
          (op) => op.attributes && (op.attributes as any).link === 'https://example.com'
        );
        expect(linkOp).toBeDefined();
        expect(linkOp?.insert).toBe('https://example.com');
        expect((linkOp?.attributes as any)?.color).toBe('#0891b2');
      });

      it('should handle www URLs and add https', () => {
        const result = processSmartPaste('Visit www.example.com today!');

        const linkOp = result.ops.find(
          (op) => op.attributes && (op.attributes as any).link === 'https://www.example.com'
        );
        expect(linkOp).toBeDefined();
      });

      it('should detect email addresses', () => {
        const result = processSmartPaste('Contact us at hello@example.com');

        const emailOp = result.ops.find(
          (op) => op.attributes && (op.attributes as any).link === 'mailto:hello@example.com'
        );
        expect(emailOp).toBeDefined();
        expect((emailOp?.attributes as any)?.color).toBe('#059669');
      });
    });

    describe('code block detection', () => {
      it('should detect fenced code blocks', () => {
        const result = processSmartPaste('```\nconst x = 1;\nconsole.log(x);\n```');

        const codeOps = result.ops.filter(
          (op) => op.attributes && (op.attributes as any)['code-block']
        );
        expect(codeOps.length).toBeGreaterThan(0);
      });
    });

    describe('mixed content', () => {
      it('should handle complex documents with multiple elements', () => {
        const complexText = `PROJECT REPORT

Summary:

This report covers the following topics:
- Background research
- Implementation details
- Test results

Key Findings

1. Performance improved by 50%
2. Memory usage reduced
3. User satisfaction increased

For more details, visit https://project.example.com or contact team@example.com`;

        const result = processSmartPaste(complexText);

        // Should have some content
        expect(result.ops.length).toBeGreaterThan(5);

        // Should have headers
        const headerOps = result.ops.filter(
          (op) =>
            op.attributes &&
            ((op.attributes as any).header === 1 || (op.attributes as any).header === 2)
        );
        expect(headerOps.length).toBeGreaterThan(0);

        // Should have bullet list
        const bulletOps = result.ops.filter(
          (op) => op.attributes && (op.attributes as any).list === 'bullet'
        );
        expect(bulletOps.length).toBe(3);

        // Should have ordered list
        const orderedOps = result.ops.filter(
          (op) => op.attributes && (op.attributes as any).list === 'ordered'
        );
        expect(orderedOps.length).toBe(3);

        // Should have links
        const linkOps = result.ops.filter((op) => op.attributes && (op.attributes as any).link);
        expect(linkOps.length).toBe(2); // URL and email
      });
    });

    describe('edge cases', () => {
      it('should handle empty text', () => {
        const result = processSmartPaste('');
        expect(result.ops).toBeDefined();
      });

      it('should handle single line text', () => {
        const result = processSmartPaste('Just a simple line');
        expect(result.ops.length).toBeGreaterThan(0);
      });

      it('should preserve blank lines', () => {
        const result = processSmartPaste('Line 1\n\nLine 2');

        // Should have at least one blank line op
        const blankOps = result.ops.filter((op) => op.insert === '\n' && !op.attributes);
        expect(blankOps.length).toBeGreaterThan(0);
      });

      it('should handle Windows line endings', () => {
        const result = processSmartPaste('Line 1\r\nLine 2\r\nLine 3');
        expect(result.ops.length).toBeGreaterThan(0);
      });
    });
  });
});

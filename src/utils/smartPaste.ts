/**
 * Smart Paste Utility
 * Analyzes plain text and converts it to rich Quill Delta format
 * with intelligent detection of titles, lists, URLs, and code blocks
 */

import type Quill from 'quill';
import type { Delta } from 'quill/core';

// ============================================================================
// Types
// ============================================================================

interface ParsedLine {
  text: string;
  type: 'title' | 'subtitle' | 'list-bullet' | 'list-ordered' | 'code' | 'paragraph' | 'blank';
  listMarker?: string;
  listNumber?: number;
  indentLevel?: number;
}

interface DeltaOp {
  insert: string | Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

// ============================================================================
// Detection Patterns
// ============================================================================

/** URL pattern - matches http, https, and www URLs */
const URL_PATTERN = /\b(https?:\/\/[^\s<>\"\']+|www\.[^\s<>\"\']+\.[^\s<>\"\']+)/gi;

/** Email pattern */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/** Bullet list markers */
const BULLET_PATTERN = /^(\s*)([-*•◦▪▸►]|\u2022|\u2023|\u25E6)\s+(.*)$/;

/** Ordered list markers */
const ORDERED_PATTERN = /^(\s*)(\d+)[.)]\s+(.*)$/;

/** Code fence pattern */
const CODE_FENCE_PATTERN = /^```(\w*)$/;

/** Indented code (4+ spaces or tab) */
const INDENTED_CODE_PATTERN = /^(\t|    )(.*)$/;

// ============================================================================
// Line Classification
// ============================================================================

/**
 * Determine if a line looks like a title
 * - Short (under 80 chars)
 * - No ending punctuation typical of sentences
 * - ALL CAPS or Title Case
 * - Not a list item
 */
function isTitleLike(line: string, nextLine: string | undefined, prevLine: string | undefined): boolean {
  const trimmed = line.trim();
  
  // Empty or too long
  if (!trimmed || trimmed.length > 80) return false;
  
  // Skip if it's a list item
  if (BULLET_PATTERN.test(line) || ORDERED_PATTERN.test(line)) return false;
  
  // Skip if it ends with sentence punctuation
  if (/[.!?,;]$/.test(trimmed)) return false;
  
  // ALL CAPS is a strong title indicator (but not single words under 4 chars)
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length > 3;
  
  // Title Case detection (most words capitalized)
  const words = trimmed.split(/\s+/);
  const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
  const isTitleCase = words.length > 1 && capitalizedWords.length >= words.length * 0.6;
  
  // Context: followed by blank line or longer paragraph
  const followedByBlank = !nextLine || nextLine.trim() === '';
  const followedByLongerText = nextLine && nextLine.trim().length > trimmed.length * 1.5;
  const precededByBlank = !prevLine || prevLine.trim() === '';
  
  // Strong indicators
  if (isAllCaps && trimmed.length < 60) return true;
  
  // Title case at start of section
  if (isTitleCase && precededByBlank && (followedByBlank || followedByLongerText)) return true;
  
  // Short line followed by blank and preceded by blank (section header)
  if (trimmed.length < 50 && precededByBlank && followedByBlank) return true;
  
  return false;
}

/**
 * Determine if a line is a subtitle (smaller heading)
 */
function isSubtitleLike(line: string, nextLine: string | undefined, prevLine: string | undefined): boolean {
  const trimmed = line.trim();
  
  if (!trimmed || trimmed.length > 60) return false;
  if (BULLET_PATTERN.test(line) || ORDERED_PATTERN.test(line)) return false;
  if (/[.!?,;]$/.test(trimmed)) return false;
  
  // Preceded by content, followed by content or blank
  const precededByContent = prevLine && prevLine.trim() !== '';
  const followedByBlank = !nextLine || nextLine.trim() === '';
  
  // Check for common subtitle patterns
  const hasColon = trimmed.endsWith(':');
  const isTitleCase = trimmed.split(/\s+/).filter(w => /^[A-Z]/.test(w)).length >= 2;
  
  if (hasColon && trimmed.length < 40) return true;
  if (isTitleCase && precededByContent && followedByBlank && trimmed.length < 50) return true;
  
  return false;
}

/**
 * Parse a single line and classify its type
 */
function parseLine(line: string, nextLine: string | undefined, prevLine: string | undefined, inCodeBlock: boolean): ParsedLine {
  // Code fence boundaries
  if (CODE_FENCE_PATTERN.test(line.trim())) {
    return { text: line, type: 'code' };
  }
  
  // Inside code block
  if (inCodeBlock) {
    return { text: line, type: 'code' };
  }
  
  // Blank line
  if (line.trim() === '') {
    return { text: '', type: 'blank' };
  }
  
  // Indented code
  const indentedMatch = INDENTED_CODE_PATTERN.exec(line);
  if (indentedMatch && !BULLET_PATTERN.test(line) && !ORDERED_PATTERN.test(line)) {
    // Only treat as code if multiple consecutive indented lines
    return { text: indentedMatch[2], type: 'code', indentLevel: 1 };
  }
  
  // Bullet list
  const bulletMatch = BULLET_PATTERN.exec(line);
  if (bulletMatch) {
    const indent = bulletMatch[1].length;
    return {
      text: bulletMatch[3],
      type: 'list-bullet',
      listMarker: bulletMatch[2],
      indentLevel: Math.floor(indent / 2)
    };
  }
  
  // Ordered list
  const orderedMatch = ORDERED_PATTERN.exec(line);
  if (orderedMatch) {
    const indent = orderedMatch[1].length;
    return {
      text: orderedMatch[3],
      type: 'list-ordered',
      listNumber: parseInt(orderedMatch[2], 10),
      indentLevel: Math.floor(indent / 2)
    };
  }
  
  // Title detection
  if (isTitleLike(line, nextLine, prevLine)) {
    return { text: line.trim(), type: 'title' };
  }
  
  // Subtitle detection
  if (isSubtitleLike(line, nextLine, prevLine)) {
    return { text: line.trim(), type: 'subtitle' };
  }
  
  // Default: paragraph
  return { text: line, type: 'paragraph' };
}

// ============================================================================
// Text Segment Processing (URLs, emails)
// ============================================================================

/**
 * Split text into segments, identifying URLs and emails
 */
function splitTextWithLinks(text: string): Array<{ text: string; type: 'text' | 'url' | 'email' }> {
  const segments: Array<{ text: string; type: 'text' | 'url' | 'email' }> = [];
  
  // Combined pattern for URLs and emails
  const combinedPattern = new RegExp(
    `(${URL_PATTERN.source})|(${EMAIL_PATTERN.source})`,
    'gi'
  );
  
  let lastIndex = 0;
  let match;
  
  while ((match = combinedPattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), type: 'text' });
    }
    
    // Determine if URL or email
    const matchedText = match[0];
    if (EMAIL_PATTERN.test(matchedText)) {
      segments.push({ text: matchedText, type: 'email' });
    } else {
      segments.push({ text: matchedText, type: 'url' });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), type: 'text' });
  }
  
  return segments.length > 0 ? segments : [{ text, type: 'text' }];
}

// ============================================================================
// Delta Generation
// ============================================================================

/** Color palette for visual enhancement */
const COLORS = {
  title: '#2563eb',      // Blue-600 - primary headings
  subtitle: '#7c3aed',   // Violet-600 - secondary headings
  url: '#0891b2',        // Cyan-600 - links
  email: '#059669',      // Emerald-600 - emails
  code: '#475569',       // Slate-600 - code text
  codeBg: '#f1f5f9',     // Slate-100 - code background
};

/**
 * Generate Delta ops for a text segment with optional formatting
 */
function generateTextOps(
  text: string,
  baseAttributes: Record<string, unknown> = {}
): DeltaOp[] {
  const segments = splitTextWithLinks(text);
  const ops: DeltaOp[] = [];
  
  for (const segment of segments) {
    if (segment.type === 'url') {
      // Ensure URL has protocol
      let url = segment.text;
      if (url.startsWith('www.')) {
        url = 'https://' + url;
      }
      ops.push({
        insert: segment.text,
        attributes: {
          ...baseAttributes,
          link: url,
          color: COLORS.url,
        }
      });
    } else if (segment.type === 'email') {
      ops.push({
        insert: segment.text,
        attributes: {
          ...baseAttributes,
          link: `mailto:${segment.text}`,
          color: COLORS.email,
        }
      });
    } else {
      if (Object.keys(baseAttributes).length > 0) {
        ops.push({ insert: segment.text, attributes: baseAttributes });
      } else {
        ops.push({ insert: segment.text });
      }
    }
  }
  
  return ops;
}

/**
 * Convert parsed lines to Quill Delta operations
 */
function generateDelta(lines: string[]): DeltaOp[] {
  const ops: DeltaOp[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    const prevLine = lines[i - 1];
    
    // Handle code fence toggle
    if (CODE_FENCE_PATTERN.test(line.trim())) {
      if (inCodeBlock) {
        // End code block - emit accumulated code
        if (codeBlockContent.length > 0) {
          ops.push({
            insert: codeBlockContent.join('\n'),
            attributes: { 'code-block': true }
          });
          ops.push({ insert: '\n', attributes: { 'code-block': true } });
          codeBlockContent = [];
        }
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    
    // Accumulate code block content
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }
    
    const parsed = parseLine(line, nextLine, prevLine, inCodeBlock);
    
    switch (parsed.type) {
      case 'title':
        ops.push(...generateTextOps(parsed.text, { bold: true, color: COLORS.title }));
        ops.push({ insert: '\n', attributes: { header: 1 } });
        break;
        
      case 'subtitle':
        ops.push(...generateTextOps(parsed.text, { bold: true, color: COLORS.subtitle }));
        ops.push({ insert: '\n', attributes: { header: 2 } });
        break;
        
      case 'list-bullet':
        ops.push(...generateTextOps(parsed.text));
        ops.push({ 
          insert: '\n', 
          attributes: { 
            list: 'bullet',
            indent: parsed.indentLevel || 0
          } 
        });
        break;
        
      case 'list-ordered':
        ops.push(...generateTextOps(parsed.text));
        ops.push({ 
          insert: '\n', 
          attributes: { 
            list: 'ordered',
            indent: parsed.indentLevel || 0
          } 
        });
        break;
        
      case 'code':
        // Single-line code or indented code
        ops.push({
          insert: parsed.text || line,
        });
        ops.push({ insert: '\n', attributes: { 'code-block': true } });
        break;
        
      case 'blank':
        ops.push({ insert: '\n' });
        break;
        
      case 'paragraph':
      default:
        ops.push(...generateTextOps(parsed.text));
        ops.push({ insert: '\n' });
        break;
    }
  }
  
  // Handle unclosed code block
  if (codeBlockContent.length > 0) {
    ops.push({
      insert: codeBlockContent.join('\n'),
    });
    ops.push({ insert: '\n', attributes: { 'code-block': true } });
  }
  
  return ops;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if text appears to be plain text (not HTML)
 */
export function isPlainText(text: string): boolean {
  // Check for common HTML tags
  const htmlPattern = /<\/?(?:p|div|span|br|h[1-6]|ul|ol|li|a|strong|em|b|i|table|tr|td|th|img)[^>]*>/i;
  return !htmlPattern.test(text);
}

/**
 * Process plain text and convert to smart-formatted Quill Delta
 */
export function processSmartPaste(text: string): { ops: DeltaOp[] } {
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');
  
  const ops = generateDelta(lines);
  
  return { ops };
}

/**
 * Apply smart paste to a Quill editor instance
 * Returns true if smart paste was applied, false if default paste should proceed
 */
export function applySmartPaste(quill: Quill, clipboardData: DataTransfer): boolean {
  // Check if there's HTML content - let Quill handle it natively
  const htmlContent = clipboardData.getData('text/html');
  if (htmlContent && !isPlainText(htmlContent)) {
    // Let Quill's native paste handle HTML
    return false;
  }
  
  // Get plain text
  const plainText = clipboardData.getData('text/plain');
  if (!plainText || plainText.trim() === '') {
    return false;
  }
  
  // Check if it's just a simple single line with no special formatting indicators
  const lines = plainText.split(/\r?\n/);
  const nonEmptyLines = lines.filter(l => l.trim() !== '');
  
  // For very simple pastes (single short line, no formatting indicators), skip smart processing
  if (nonEmptyLines.length === 1 && 
      nonEmptyLines[0].length < 100 &&
      !URL_PATTERN.test(nonEmptyLines[0]) &&
      !BULLET_PATTERN.test(nonEmptyLines[0]) &&
      !ORDERED_PATTERN.test(nonEmptyLines[0])) {
    return false;
  }
  
  // Apply smart paste
  const delta = processSmartPaste(plainText);
  
  // Get current selection
  const range = quill.getSelection(true);
  
  // Delete selected content if any
  if (range && range.length > 0) {
    quill.deleteText(range.index, range.length);
  }
  
  // Insert the formatted content
  const index = range ? range.index : quill.getLength() - 1;
  quill.updateContents({ ops: [
    { retain: index },
    ...delta.ops
  ] } as Delta);
  
  // Move cursor to end of inserted content
  const insertedLength = delta.ops.reduce((len, op) => {
    if (typeof op.insert === 'string') {
      return len + op.insert.length;
    }
    return len + 1;
  }, 0);
  quill.setSelection(index + insertedLength, 0);
  
  return true;
}

/**
 * Convert plain text to formatted Quill Delta for quick capture
 * This is used by the backend quick capture feature
 */
export function convertTextToRichDelta(text: string): string {
  const delta = processSmartPaste(text);
  return JSON.stringify(delta);
}

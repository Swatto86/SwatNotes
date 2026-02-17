/**
 * Tests for attachmentsApi
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  createAttachment,
  listAttachments,
  getAttachmentData,
  deleteAttachment,
  readFileAsBytes,
  createDataUrl,
} from './attachmentsApi';
import type { Attachment } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('attachmentsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAttachment', () => {
    it('should create an attachment', async () => {
      const mockAttachment: Attachment = {
        id: 'att-id',
        note_id: 'note-id',
        filename: 'test.txt',
        mime_type: 'text/plain',
        size: 100,
        size_bytes: 100,
        blob_hash: 'abc123',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(invoke).mockResolvedValue(mockAttachment);

      const data = new Uint8Array([1, 2, 3]);
      const result = await createAttachment('note-id', 'test.txt', 'text/plain', data);

      expect(invoke).toHaveBeenCalledWith('create_attachment', {
        noteId: 'note-id',
        filename: 'test.txt',
        mimeType: 'text/plain',
        data: Array.from(data),
      });
      expect(result).toEqual(mockAttachment);
    });

    it('should handle file size validation errors', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('File size exceeds maximum allowed size'));

      // Mock a large file without actually creating it (to avoid timeout)
      const largeData = new Uint8Array(100); // Small array for test
      await expect(
        createAttachment('note-id', 'large.bin', 'application/octet-stream', largeData)
      ).rejects.toThrow('File size exceeds maximum allowed size');
    });
  });

  describe('listAttachments', () => {
    it('should list attachments for a note', async () => {
      const mockAttachments: Attachment[] = [
        {
          id: 'att-1',
          note_id: 'note-id',
          filename: 'file1.txt',
          mime_type: 'text/plain',
          size: 100,
          size_bytes: 100,
          blob_hash: 'hash1',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'att-2',
          note_id: 'note-id',
          filename: 'image.png',
          mime_type: 'image/png',
          size: 5000,
          size_bytes: 5000,
          blob_hash: 'hash2',
          created_at: '2024-01-01T00:01:00Z',
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockAttachments);

      const result = await listAttachments('note-id');

      expect(invoke).toHaveBeenCalledWith('list_attachments', { noteId: 'note-id' });
      expect(result).toEqual(mockAttachments);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when note has no attachments', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await listAttachments('note-id');

      expect(result).toEqual([]);
    });
  });

  describe('getAttachmentData', () => {
    it('should retrieve attachment data by hash', async () => {
      const mockData = [1, 2, 3, 4, 5];
      vi.mocked(invoke).mockResolvedValue(mockData);

      const result = await getAttachmentData('hash123');

      expect(invoke).toHaveBeenCalledWith('get_attachment_data', { blobHash: 'hash123' });
      expect(result).toEqual(new Uint8Array(mockData));
    });
  });

  describe('deleteAttachment', () => {
    it('should delete attachment by id', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await deleteAttachment('att-id');

      expect(invoke).toHaveBeenCalledWith('delete_attachment', { attachmentId: 'att-id' });
    });
  });

  describe('readFileAsBytes', () => {
    it('should read file as Uint8Array', async () => {
      const mockBlob = new Blob(['test content'], { type: 'text/plain' });
      const result = await readFileAsBytes(mockBlob);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('createDataUrl', () => {
    it('should create blob URL from bytes and mime type', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in ASCII
      const mimeType = 'text/plain';

      const result = createDataUrl(data, mimeType);

      // createDataUrl uses URL.createObjectURL which returns blob: URLs
      expect(result).toMatch(/^blob:/);
      expect(result.length).toBeGreaterThan(5); // blob: prefix
    });

    it('should handle image mime types', () => {
      const data = new Uint8Array([255, 216, 255, 224]); // JPEG header
      const mimeType = 'image/jpeg';

      const result = createDataUrl(data, mimeType);

      // Should return a blob URL
      expect(result).toMatch(/^blob:/);
    });
  });
});

/**
 * Attachments API Module
 * Wraps Tauri commands for attachment operations
 */

import { invoke } from '@tauri-apps/api/core';
import type { Attachment } from '../types';

/**
 * Create an attachment
 * @param noteId - Note ID
 * @param filename - Filename
 * @param mimeType - MIME type
 * @param data - File data
 * @returns Promise resolving to the created attachment
 */
export async function createAttachment(
  noteId: string,
  filename: string,
  mimeType: string,
  data: Uint8Array
): Promise<Attachment> {
  return await invoke('create_attachment', {
    noteId,
    filename,
    mimeType,
    data: Array.from(data), // Convert to array for JSON serialization
  });
}

/**
 * List attachments for a note
 * @param noteId - Note ID
 * @returns Promise resolving to array of attachments
 */
export async function listAttachments(noteId: string): Promise<Attachment[]> {
  return await invoke('list_attachments', { noteId });
}

/**
 * Get attachment data
 * @param blobHash - Blob hash
 * @returns Promise resolving to attachment data
 */
export async function getAttachmentData(blobHash: string): Promise<Uint8Array> {
  const data = await invoke<number[]>('get_attachment_data', { blobHash });
  return new Uint8Array(data);
}

/**
 * Delete an attachment
 * @param attachmentId - Attachment ID
 * @returns Promise resolving when deletion is complete
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  return await invoke('delete_attachment', { attachmentId });
}

/**
 * Create a data URL from attachment data
 * @param data - Attachment data
 * @param mimeType - MIME type
 * @returns Data URL
 */
export function createDataUrl(data: Uint8Array, mimeType: string): string {
  // Create a copy of the buffer to ensure it's a proper ArrayBuffer
  const arrayBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Read file as Uint8Array
 * @param file - File or Blob object
 * @returns Promise resolving to file data
 */
export async function readFileAsBytes(file: File | Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

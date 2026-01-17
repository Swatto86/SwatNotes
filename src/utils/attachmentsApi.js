// Attachments API - wraps Tauri commands for attachment operations

import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Create an attachment
 * @param {string} noteId - Note ID
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 * @param {Uint8Array} data - File data
 * @returns {Promise<Attachment>}
 */
export async function createAttachment(noteId, filename, mimeType, data) {
  return await invoke('create_attachment', {
    noteId,
    filename,
    mimeType,
    data: Array.from(data), // Convert to array for JSON serialization
  });
}

/**
 * List attachments for a note
 * @param {string} noteId - Note ID
 * @returns {Promise<Attachment[]>}
 */
export async function listAttachments(noteId) {
  return await invoke('list_attachments', { noteId });
}

/**
 * Get attachment data
 * @param {string} blobHash - Blob hash
 * @returns {Promise<Uint8Array>}
 */
export async function getAttachmentData(blobHash) {
  const data = await invoke('get_attachment_data', { blobHash });
  return new Uint8Array(data);
}

/**
 * Delete an attachment
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<void>}
 */
export async function deleteAttachment(attachmentId) {
  return await invoke('delete_attachment', { attachmentId });
}

/**
 * Create a data URL from attachment data
 * @param {Uint8Array} data - Attachment data
 * @param {string} mimeType - MIME type
 * @returns {string} Data URL
 */
export function createDataUrl(data, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Read file as Uint8Array
 * @param {File} file - File object
 * @returns {Promise<Uint8Array>}
 */
export async function readFileAsBytes(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * @typedef {Object} Attachment
 * @property {string} id
 * @property {string} note_id
 * @property {string} blob_hash
 * @property {string} filename
 * @property {string} mime_type
 * @property {number} size
 * @property {string} created_at
 */

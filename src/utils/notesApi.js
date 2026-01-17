// Notes API - wraps Tauri commands for note operations

import { invoke } from '@tauri-apps/api/core';

/**
 * Create a new note
 * @param {string} title - Note title
 * @param {string} contentJson - Quill Delta JSON
 * @returns {Promise<Note>}
 */
export async function createNote(title, contentJson) {
  return await invoke('create_note', { title, contentJson });
}

/**
 * Get a note by ID
 * @param {string} id - Note ID
 * @returns {Promise<Note>}
 */
export async function getNote(id) {
  return await invoke('get_note', { id });
}

/**
 * List all notes
 * @returns {Promise<Note[]>}
 */
export async function listNotes() {
  return await invoke('list_notes');
}

/**
 * Update a note
 * @param {string} id - Note ID
 * @param {string|null} title - New title (optional)
 * @param {string|null} contentJson - New content JSON (optional)
 * @returns {Promise<Note>}
 */
export async function updateNote(id, title = null, contentJson = null) {
  return await invoke('update_note', { id, title, contentJson });
}

/**
 * Delete a note
 * @param {string} id - Note ID
 * @returns {Promise<void>}
 */
export async function deleteNote(id) {
  return await invoke('delete_note', { id });
}

/**
 * Search notes
 * @param {string} query - Search query
 * @returns {Promise<Note[]>}
 */
export async function searchNotes(query) {
  return await invoke('search_notes', { query });
}

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} title
 * @property {string} content_json
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string|null} deleted_at
 */

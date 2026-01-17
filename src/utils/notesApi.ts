/**
 * Notes API Module
 * Wraps Tauri commands for note operations
 */

import { invoke } from '@tauri-apps/api/core';
import type { Note } from '../types';

/**
 * Create a new note
 * @param title - Note title
 * @param contentJson - Quill Delta JSON
 * @returns Promise resolving to the created note
 */
export async function createNote(title: string, contentJson: string): Promise<Note> {
  return await invoke('create_note', { title, contentJson });
}

/**
 * Get a note by ID
 * @param id - Note ID
 * @returns Promise resolving to the note
 */
export async function getNote(id: string): Promise<Note> {
  return await invoke('get_note', { id });
}

/**
 * List all notes
 * @returns Promise resolving to array of notes
 */
export async function listNotes(): Promise<Note[]> {
  return await invoke('list_notes');
}

/**
 * Update a note
 * @param id - Note ID
 * @param title - New title (optional)
 * @param contentJson - New content JSON (optional)
 * @returns Promise resolving to the updated note
 */
export async function updateNote(
  id: string,
  title: string | null = null,
  contentJson: string | null = null
): Promise<Note> {
  return await invoke('update_note', { id, title, contentJson });
}

/**
 * Delete a note
 * @param id - Note ID
 * @returns Promise resolving when deletion is complete
 */
export async function deleteNote(id: string): Promise<void> {
  return await invoke('delete_note', { id });
}

/**
 * Search notes
 * @param query - Search query
 * @returns Promise resolving to array of matching notes
 */
export async function searchNotes(query: string): Promise<Note[]> {
  return await invoke('search_notes', { query });
}

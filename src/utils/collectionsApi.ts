/**
 * Collections API
 * Handles collection/folder CRUD operations via Tauri commands
 */

import { invoke } from '@tauri-apps/api/core';
import type { Collection, Note } from '../types';

/**
 * Create a new collection
 */
export async function createCollection(
  name: string,
  description?: string,
  color?: string,
  icon?: string
): Promise<Collection> {
  return await invoke('create_collection', { name, description, color, icon });
}

/**
 * Get a collection by ID
 */
export async function getCollection(id: string): Promise<Collection> {
  return await invoke('get_collection', { id });
}

/**
 * List all collections
 */
export async function listCollections(): Promise<Collection[]> {
  return await invoke('list_collections');
}

/**
 * Update a collection
 */
export async function updateCollection(
  id: string,
  updates: {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
    sort_order?: number;
  }
): Promise<Collection> {
  return await invoke('update_collection', { id, ...updates });
}

/**
 * Delete a collection
 */
export async function deleteCollection(id: string): Promise<void> {
  return await invoke('delete_collection', { id });
}

/**
 * Update a note's collection (move to folder or remove from folder)
 */
export async function updateNoteCollection(
  noteId: string,
  collectionId: string | null
): Promise<Note> {
  return await invoke('update_note_collection', { noteId, collectionId });
}

/**
 * List notes in a specific collection
 */
export async function listNotesInCollection(collectionId: string): Promise<Note[]> {
  return await invoke('list_notes_in_collection', { collectionId });
}

/**
 * List uncategorized notes (notes without a collection)
 */
export async function listUncategorizedNotes(): Promise<Note[]> {
  return await invoke('list_uncategorized_notes');
}

/**
 * Count notes in a collection
 */
export async function countNotesInCollection(collectionId: string): Promise<number> {
  return await invoke('count_notes_in_collection', { collectionId });
}

/** Predefined collection colors */
export const COLLECTION_COLORS = [
  '#6B7280', // Gray (default)
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#84CC16', // Lime
  '#22C55E', // Green
  '#10B981', // Emerald
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
  '#F43F5E', // Rose
];

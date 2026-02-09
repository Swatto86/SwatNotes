/**
 * OneNote Import API Module
 * Handles importing notes from Microsoft OneNote
 */

import { invoke } from '@tauri-apps/api/core';
import type { Note, Collection } from '../types';

/**
 * OneNote Section information
 */
export interface OneNoteSection {
  id: string;
  name: string;
  notebook_name: string;
}

/**
 * OneNote Page information
 */
export interface OneNotePage {
  id: string;
  title: string;
  content: string;
  section_id: string;
  section_name: string;
  created_at: string;
  modified_at: string;
}

/**
 * Import result from OneNote
 */
export interface OneNoteImportResult {
  notes_imported: number;
  collections_created: number;
  sections_mapped: { [section_id: string]: string }; // section_id -> collection_id
  errors: string[];
}

/**
 * Get all OneNote sections available for import
 */
export async function getOneNoteSections(): Promise<OneNoteSection[]> {
  return await invoke('get_onenote_sections');
}

/**
 * Import all notes from OneNote
 * Sections will be mapped to Collections
 */
export async function importFromOneNote(): Promise<OneNoteImportResult> {
  return await invoke('import_from_onenote');
}

/**
 * Get pages from a specific OneNote section
 */
export async function getOneNotePages(sectionId: string): Promise<OneNotePage[]> {
  return await invoke('get_onenote_pages', { sectionId });
}

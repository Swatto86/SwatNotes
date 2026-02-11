/**
 * Centralized Application State Management
 *
 * Provides a single source of truth for application state with:
 * - Type-safe state access
 * - Pub-sub pattern for reactive updates
 * - Protection against race conditions through atomic updates
 */

import type { Note } from '../types';
import type { NoteEditorInstance } from '../components/noteEditor';

// ============================================================================
// Types
// ============================================================================

/** Application state shape */
export interface AppStateData {
  /** Currently selected note in the main editor */
  currentNote: Note | null;
  /** Currently selected note ID (for sidebar highlighting) */
  selectedNoteId: string | null;
  /** Active editor instance */
  currentEditor: NoteEditorInstance | null;
  /** Current search query */
  searchQuery: string;
  /** Whether a search is currently active */
  isSearching: boolean;
}

/** State change event types */
export type StateChangeEvent =
  | 'currentNote'
  | 'selectedNoteId'
  | 'currentEditor'
  | 'searchQuery'
  | 'isSearching'
  | '*'; // Wildcard for all changes

/** Subscriber callback type */
export type StateSubscriber<K extends keyof AppStateData> = (
  newValue: AppStateData[K],
  oldValue: AppStateData[K]
) => void;

/** Generic subscriber for all changes */
export type GlobalSubscriber = (
  key: keyof AppStateData,
  newValue: unknown,
  oldValue: unknown
) => void;

// ============================================================================
// AppState Class
// ============================================================================

/**
 * Centralized state management for the application
 * Uses singleton pattern for global access
 */
class AppState {
  private state: AppStateData = {
    currentNote: null,
    selectedNoteId: null,
    currentEditor: null,
    searchQuery: '',
    isSearching: false,
  };

  private subscribers: Map<StateChangeEvent, Set<StateSubscriber<any> | GlobalSubscriber>> =
    new Map();

  // ============================================================================
  // Getters - Read state values
  // ============================================================================

  get currentNote(): Note | null {
    return this.state.currentNote;
  }

  get selectedNoteId(): string | null {
    return this.state.selectedNoteId;
  }

  get currentEditor(): NoteEditorInstance | null {
    return this.state.currentEditor;
  }

  get searchQuery(): string {
    return this.state.searchQuery;
  }

  get isSearching(): boolean {
    return this.state.isSearching;
  }

  // ============================================================================
  // Setters - Update state with notifications
  // ============================================================================

  setCurrentNote(note: Note | null): void {
    const oldValue = this.state.currentNote;
    this.state.currentNote = note;

    // Also update selectedNoteId to keep in sync
    const oldSelectedId = this.state.selectedNoteId;
    this.state.selectedNoteId = note?.id ?? null;

    this.notify('currentNote', note, oldValue);
    if (oldSelectedId !== this.state.selectedNoteId) {
      this.notify('selectedNoteId', this.state.selectedNoteId, oldSelectedId);
    }
  }

  setSelectedNoteId(id: string | null): void {
    const oldValue = this.state.selectedNoteId;
    this.state.selectedNoteId = id;
    this.notify('selectedNoteId', id, oldValue);
  }

  setCurrentEditor(editor: NoteEditorInstance | null): void {
    const oldValue = this.state.currentEditor;
    this.state.currentEditor = editor;
    this.notify('currentEditor', editor, oldValue);
  }

  setSearchQuery(query: string): void {
    const oldValue = this.state.searchQuery;
    this.state.searchQuery = query;
    this.notify('searchQuery', query, oldValue);
  }

  setIsSearching(searching: boolean): void {
    const oldValue = this.state.isSearching;
    this.state.isSearching = searching;
    this.notify('isSearching', searching, oldValue);
  }

  // ============================================================================
  // Compound Operations - Atomic multi-state updates
  // ============================================================================

  /**
   * Open a note in the editor - updates both note and editor state atomically
   */
  openNote(note: Note, editor: NoteEditorInstance): void {
    // Clean up old editor first
    if (this.state.currentEditor) {
      this.state.currentEditor.destroy();
    }

    const oldNote = this.state.currentNote;
    const oldSelectedId = this.state.selectedNoteId;
    const oldEditor = this.state.currentEditor;

    this.state.currentNote = note;
    this.state.selectedNoteId = note.id;
    this.state.currentEditor = editor;

    // Notify all changes
    this.notify('currentNote', note, oldNote);
    this.notify('selectedNoteId', note.id, oldSelectedId);
    this.notify('currentEditor', editor, oldEditor);
  }

  /**
   * Close the current note - clears note and editor state atomically
   */
  closeNote(): void {
    // Clean up editor
    if (this.state.currentEditor) {
      this.state.currentEditor.destroy();
    }

    const oldNote = this.state.currentNote;
    const oldSelectedId = this.state.selectedNoteId;
    const oldEditor = this.state.currentEditor;

    this.state.currentNote = null;
    this.state.selectedNoteId = null;
    this.state.currentEditor = null;

    // Notify all changes
    this.notify('currentNote', null, oldNote);
    this.notify('selectedNoteId', null, oldSelectedId);
    this.notify('currentEditor', null, oldEditor);
  }

  /**
   * Update the current note reference (e.g., after autosave)
   */
  updateCurrentNote(note: Note): void {
    if (this.state.currentNote && this.state.currentNote.id === note.id) {
      const oldValue = this.state.currentNote;
      this.state.currentNote = note;
      this.notify('currentNote', note, oldValue);
    }
  }

  /**
   * Clear search state
   */
  clearSearch(): void {
    const oldQuery = this.state.searchQuery;
    const oldSearching = this.state.isSearching;

    this.state.searchQuery = '';
    this.state.isSearching = false;

    this.notify('searchQuery', '', oldQuery);
    this.notify('isSearching', false, oldSearching);
  }

  // ============================================================================
  // Subscription System
  // ============================================================================

  /**
   * Subscribe to state changes
   * @param event - The state key to watch, or '*' for all changes
   * @param callback - Function called when state changes
   * @returns Unsubscribe function
   */
  subscribe<K extends keyof AppStateData>(
    event: K | '*',
    callback: K extends '*' ? GlobalSubscriber : StateSubscriber<K>
  ): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(event)?.delete(callback);
    };
  }

  /**
   * Notify subscribers of state changes
   */
  private notify<K extends keyof AppStateData>(
    key: K,
    newValue: AppStateData[K],
    oldValue: AppStateData[K]
  ): void {
    // Skip if value hasn't changed
    if (newValue === oldValue) {
      return;
    }

    // Notify specific subscribers
    this.subscribers.get(key)?.forEach((callback) => {
      (callback as StateSubscriber<K>)(newValue, oldValue);
    });

    // Notify wildcard subscribers
    this.subscribers.get('*')?.forEach((callback) => {
      (callback as GlobalSubscriber)(key, newValue, oldValue);
    });
  }

  // ============================================================================
  // Debug Utilities
  // ============================================================================

  /**
   * Get a snapshot of the current state (for debugging)
   */
  getSnapshot(): Readonly<AppStateData> {
    return { ...this.state };
  }

  /**
   * Log current state (for debugging)
   * Uses console.log directly as this is a debug utility
   */
  debug(): void {
    // Intentionally using console.log for debugging utility
    // eslint-disable-next-line no-console
    console.log('[AppState Debug]', {
      currentNote: this.state.currentNote?.id ?? null,
      currentNoteTitle: this.state.currentNote?.title ?? null,
      selectedNoteId: this.state.selectedNoteId,
      hasEditor: this.state.currentEditor !== null,
      searchQuery: this.state.searchQuery,
      isSearching: this.state.isSearching,
    });
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global application state instance */
export const appState = new AppState();

// Export for direct access in tests or debugging
if (typeof window !== 'undefined') {
  (window as any).__appState = appState;
}

/**
 * Note Editor Component
 * Quill.js integration with debounced autosave, attachments, reminders, and smart title handling
 */

import Quill from 'quill';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { updateNote } from '../utils/notesApi';
import {
  createAttachment,
  listAttachments,
  deleteAttachment,
  readFileAsBytes,
} from '../utils/attachmentsApi';
import {
  createReminder,
  listActiveReminders,
  deleteReminder,
  updateReminder,
} from '../utils/remindersApi';
import {
  listCollections,
  updateNoteCollection,
  createCollection,
  COLLECTION_COLORS,
} from '../utils/collectionsApi';
import { registerAttachmentBlots, insertInlineAttachment } from '../utils/quillAttachmentBlots';
import type { Note, Attachment, Reminder, Collection } from '../types';
import { showAlert, showPrompt } from '../utils/modal';
import { logger } from '../utils/logger';
import {
  escapeHtml,
  formatDate,
  formatFileSize,
  formatReminderDate,
  getFileIcon,
} from '../utils/formatters';
import { applySmartPaste } from '../utils/smartPaste';
import { playNotificationSound } from '../utils/notificationSound';

// Register custom blots once at module load
registerAttachmentBlots();

const LOG_CONTEXT = 'NoteEditor';

// ============================================================================
// Constants
// ============================================================================

/** Autosave debounce delay in milliseconds */
const AUTOSAVE_DEBOUNCE_MS = 500;

/** Status message timeout in milliseconds */
const STATUS_MESSAGE_TIMEOUT_MS = 2000;

// ============================================================================
// Types
// ============================================================================

/** Editor instance with cleanup method */
export interface NoteEditorInstance {
  quill: Quill;
  destroy: () => void;
}

/** Autosave state */
interface AutosaveState {
  saveTimeout: ReturnType<typeof setTimeout> | null;
  isSaving: boolean;
}

/** Title tracking state */
interface TitleState {
  isManuallyModified: boolean;
  lastAutoTitle: string;
}

// Helper functions are imported from '../utils/formatters'

/**
 * Generate a title from note content (Quill Delta)
 * Takes the first line of text, up to 50 characters
 */
function generateTitleFromContent(quill: Quill): string {
  const text = quill.getText().trim();
  if (!text) {
    return 'Untitled';
  }

  // Get first line or first 50 characters
  const firstLine = text.split('\n')[0];
  if (firstLine.length > 50) {
    return firstLine.substring(0, 50) + '...';
  }

  return firstLine || 'Untitled';
}

// ============================================================================
// Quill Editor Setup
// ============================================================================

/**
 * Initialize Quill editor with content
 */
function setupQuillEditor(element: HTMLElement, note: Note): Quill {
  const quill = new Quill(element, {
    theme: 'snow',
    placeholder: 'Start writing...',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ color: [] }, { background: [] }],
        ['link', 'blockquote', 'code-block'],
        ['clean'],
      ],
    },
  });

  // Load initial content
  try {
    const content = JSON.parse(note.content_json);
    quill.setContents(content);
  } catch (e) {
    logger.error('Failed to parse note content', LOG_CONTEXT, e);
    quill.setText('');
  }

  return quill;
}

// ============================================================================
// Autosave Functionality
// ============================================================================

/**
 * Setup autosave functionality for the note editor
 */
function setupAutosave(
  quill: Quill,
  titleInput: HTMLInputElement,
  autoTitleCheckbox: HTMLInputElement,
  saveStatus: HTMLElement,
  note: Note,
  titleState: TitleState,
  onSave?: (note: Note) => void
): {
  debouncedSave: () => Promise<void>;
  saveImmediately: () => Promise<void>;
  state: AutosaveState;
} {
  const state: AutosaveState = {
    saveTimeout: null,
    isSaving: false,
  };

  const isNoteEmpty = (): boolean => {
    const text = quill.getText().trim();
    return text.length === 0;
  };

  const updateAutoTitle = (): void => {
    if (!titleState.isManuallyModified) {
      const newTitle = generateTitleFromContent(quill);
      titleState.lastAutoTitle = newTitle;
      titleInput.value = newTitle;
    }
  };

  const debouncedSave = async (): Promise<void> => {
    if (state.isSaving) {
      return;
    }

    if (state.saveTimeout) {
      clearTimeout(state.saveTimeout);
    }

    state.saveTimeout = setTimeout(async () => {
      // Don't save empty notes
      if (isNoteEmpty()) {
        logger.debug('Skipping save for empty note', LOG_CONTEXT);
        return;
      }

      try {
        state.isSaving = true;
        saveStatus.textContent = 'Saving...';
        saveStatus.classList.add('text-info');

        const title = titleInput.value.trim() || 'Untitled';
        const contentJson = JSON.stringify(quill.getContents());

        const updatedNote = await updateNote(
          note.id,
          title,
          contentJson,
          titleState.isManuallyModified
        );

        saveStatus.textContent = `Saved at ${formatDate(updatedNote.updated_at)}`;
        saveStatus.classList.remove('text-info');
        saveStatus.classList.add('text-success');

        setTimeout(() => {
          saveStatus.classList.remove('text-success');
        }, STATUS_MESSAGE_TIMEOUT_MS);

        // Notify that notes have changed
        await emit('notes-list-changed');

        if (onSave) {
          onSave(updatedNote);
        }
      } catch (error) {
        logger.error('Save error', LOG_CONTEXT, error);
        saveStatus.textContent = 'Save failed';
        saveStatus.classList.remove('text-info');
        saveStatus.classList.add('text-error');
      } finally {
        state.isSaving = false;
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const saveImmediately = async (): Promise<void> => {
    if (state.saveTimeout) {
      clearTimeout(state.saveTimeout);
    }
    if (!state.isSaving && !isNoteEmpty()) {
      await debouncedSave();
    }
  };

  // Listen for content changes
  quill.on('text-change', () => {
    updateAutoTitle();
    debouncedSave();
  });

  // Listen for title input changes (manual modification)
  titleInput.addEventListener('input', () => {
    // If user types in title field, mark as manually modified
    if (!titleState.isManuallyModified) {
      // Only mark as modified if the value differs from auto-generated
      const autoTitle = generateTitleFromContent(quill);
      if (titleInput.value.trim() !== autoTitle) {
        titleState.isManuallyModified = true;
        autoTitleCheckbox.checked = false;
      }
    }
    debouncedSave();
  });

  titleInput.addEventListener('blur', saveImmediately);

  // Handle auto-title checkbox changes
  autoTitleCheckbox.addEventListener('change', () => {
    titleState.isManuallyModified = !autoTitleCheckbox.checked;
    if (autoTitleCheckbox.checked) {
      // Re-generate title from content
      const newTitle = generateTitleFromContent(quill);
      titleInput.value = newTitle;
      titleState.lastAutoTitle = newTitle;
    }
    debouncedSave();
  });

  return { debouncedSave, saveImmediately, state };
}

// ============================================================================
// Attachments Functionality
// ============================================================================

/** Cleanup function type for event listener removal */
type CleanupFunction = () => void;

/**
 * Setup attachments functionality
 */
function setupAttachments(
  quill: Quill,
  note: Note,
  saveStatus: HTMLElement
): { loadAttachments: () => Promise<void>; cleanup: CleanupFunction } {
  const fileInput = document.getElementById(`file-upload-${note.id}`) as HTMLInputElement;
  const editorElement = document.getElementById('note-editor');
  const cleanupFunctions: CleanupFunction[] = [];

  // Load and display attachments
  async function loadAttachments(): Promise<void> {
    const attachmentsList = document.getElementById('attachments-list');
    if (!attachmentsList) {
      return;
    }

    try {
      const attachments: Attachment[] = await listAttachments(note.id);

      if (attachments.length === 0) {
        attachmentsList.innerHTML =
          '<p class="text-base-content/50 text-sm">No attachments yet. Paste images or add files.</p>';
        return;
      }

      attachmentsList.innerHTML = attachments
        .map(
          (att) => `
        <div class="flex items-center justify-between p-3 bg-base-200 rounded-lg">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            ${getFileIcon(att.mime_type)}
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">${escapeHtml(att.filename)}</p>
              <p class="text-xs text-base-content/50">${formatFileSize(att.size)} • ${formatDate(att.created_at)}</p>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm btn-circle delete-attachment" data-id="${att.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `
        )
        .join('');

      // Attach delete handlers
      attachmentsList.querySelectorAll('.delete-attachment').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          await deleteAttachment(id!);
          await loadAttachments();
        });
      });
    } catch (error) {
      logger.error('Failed to load attachments', LOG_CONTEXT, error);
      attachmentsList.innerHTML = '<p class="text-error text-sm">Failed to load attachments</p>';
    }
  }

  async function handleFileUpload(file: File | Blob, filename?: string): Promise<void> {
    const actualFilename =
      filename || (file instanceof File ? file.name : `pasted-image-${Date.now()}.png`);
    const mimeType = file.type || 'application/octet-stream';

    try {
      saveStatus.textContent = `Uploading ${actualFilename}...`;
      saveStatus.classList.add('text-info');

      const data = await readFileAsBytes(file);
      const attachment = await createAttachment(note.id, actualFilename, mimeType, data);

      // Insert inline attachment into editor
      insertInlineAttachment(quill, attachment);

      saveStatus.textContent = `${actualFilename} uploaded`;
      saveStatus.classList.remove('text-info');
      saveStatus.classList.add('text-success');

      setTimeout(() => {
        saveStatus.classList.remove('text-success');
      }, STATUS_MESSAGE_TIMEOUT_MS);

      // Refresh attachments list
      await loadAttachments();
    } catch (error) {
      logger.error('Failed to upload file', LOG_CONTEXT, error);
      saveStatus.textContent = `Failed to upload ${actualFilename}`;
      saveStatus.classList.remove('text-info');
      saveStatus.classList.add('text-error');
    }
  }

  async function handleImagePaste(blob: Blob): Promise<void> {
    // Derive file extension from actual MIME type (e.g., image/jpeg → jpg)
    const mimeSubtype = blob.type.split('/')[1] || 'png';
    const ext = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype.split('+')[0];
    await handleFileUpload(blob, `pasted-image-${Date.now()}.${ext}`);
  }

  // Clipboard paste handler for images and smart text formatting
  const pasteHandler = async (e: ClipboardEvent) => {
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    if (!clipboardData) {
      return;
    }

    const items = clipboardData.items;

    // Check for images first - handle them specially
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          await handleImagePaste(blob);
        }
        return;
      }
    }

    // Try smart paste for plain text (detect titles, lists, URLs, etc.)
    try {
      if (applySmartPaste(quill, clipboardData)) {
        e.preventDefault();
        logger.debug('Smart paste applied', LOG_CONTEXT);
      }
      // If smart paste returns false, let Quill handle it natively (e.g., for HTML)
    } catch (err) {
      logger.warn('Smart paste failed, falling back to default', LOG_CONTEXT, err);
      // Let default paste behavior handle it
    }
  };

  // Drag and drop handlers
  const dragOverHandler = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editorElement) {
      editorElement.classList.add('drag-over');
    }
  };

  const dragLeaveHandler = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editorElement) {
      editorElement.classList.remove('drag-over');
    }
  };

  const dropHandler = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editorElement) {
      editorElement.classList.remove('drag-over');
    }

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    for (const file of Array.from(files)) {
      await handleFileUpload(file);
    }
  };

  if (editorElement) {
    editorElement.addEventListener('paste', pasteHandler as EventListener);
    editorElement.addEventListener('dragover', dragOverHandler);
    editorElement.addEventListener('dragleave', dragLeaveHandler);
    editorElement.addEventListener('drop', dropHandler);

    cleanupFunctions.push(() => {
      editorElement.removeEventListener('paste', pasteHandler as EventListener);
      editorElement.removeEventListener('dragover', dragOverHandler);
      editorElement.removeEventListener('dragleave', dragLeaveHandler);
      editorElement.removeEventListener('drop', dropHandler);
    });
  }

  // File upload handler (from attachment button - also inserts inline)
  const fileChangeHandler = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) {
      return;
    }

    for (const file of Array.from(files)) {
      await handleFileUpload(file);
    }

    // Clear input
    if (fileInput) {
      fileInput.value = '';
    }
  };

  if (fileInput) {
    fileInput.addEventListener('change', fileChangeHandler);
    cleanupFunctions.push(() => fileInput.removeEventListener('change', fileChangeHandler));
  }

  // Cleanup function to remove all event listeners
  const cleanup = () => {
    cleanupFunctions.forEach((fn) => fn());
  };

  return { loadAttachments, cleanup };
}

// ============================================================================
// Reminders Functionality
// ============================================================================

/**
 * Setup reminders functionality
 */
function setupReminders(note: Note): { loadReminders: () => Promise<void> } {
  const addReminderBtn = document.getElementById('add-reminder-btn');
  const reminderForm = document.getElementById('reminder-form');
  const saveReminderBtn = document.getElementById('save-reminder-btn');
  const cancelReminderBtn = document.getElementById('cancel-reminder-btn');
  const reminderDatetime = document.getElementById('reminder-datetime') as HTMLInputElement;

  // Track which reminder is being edited (null = creating new)
  let editingReminderId: string | null = null;

  // Set minimum datetime to now
  const now = new Date();
  const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  if (reminderDatetime) {
    reminderDatetime.min = localDatetime;
  }

  /**
   * Reset the reminder form to default state for creating a new reminder
   */
  function resetFormForCreate(): void {
    editingReminderId = null;
    if (reminderDatetime) {
      reminderDatetime.value = localDatetime;
    }
    // Reset settings toggle and checkboxes to defaults
    const settingsToggle = document.getElementById('reminder-settings-toggle') as HTMLInputElement;
    const soundEnabled = document.getElementById('reminder-sound-enabled') as HTMLInputElement;
    const soundType = document.getElementById('reminder-sound-type') as HTMLSelectElement;
    const shakeEnabled = document.getElementById('reminder-shake-enabled') as HTMLInputElement;
    const glowEnabled = document.getElementById('reminder-glow-enabled') as HTMLInputElement;

    if (settingsToggle) {
      settingsToggle.checked = false;
    }
    if (soundEnabled) {
      soundEnabled.checked = true;
    }
    if (soundType) {
      soundType.value = 'whoosh';
    }
    if (shakeEnabled) {
      shakeEnabled.checked = true;
    }
    if (glowEnabled) {
      glowEnabled.checked = true;
    }

    // Update save button text
    if (saveReminderBtn) {
      saveReminderBtn.textContent = 'Save';
    }
  }

  /**
   * Populate the form with existing reminder data for editing
   */
  function populateFormForEdit(reminder: Reminder): void {
    editingReminderId = reminder.id;

    // Convert trigger_time to local datetime-local format
    const triggerDate = new Date(reminder.trigger_time);
    const localTriggerDatetime = new Date(
      triggerDate.getTime() - triggerDate.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);

    if (reminderDatetime) {
      reminderDatetime.value = localTriggerDatetime;
    }

    // Populate settings
    const settingsToggle = document.getElementById('reminder-settings-toggle') as HTMLInputElement;
    const soundEnabled = document.getElementById('reminder-sound-enabled') as HTMLInputElement;
    const soundType = document.getElementById('reminder-sound-type') as HTMLSelectElement;
    const shakeEnabled = document.getElementById('reminder-shake-enabled') as HTMLInputElement;
    const glowEnabled = document.getElementById('reminder-glow-enabled') as HTMLInputElement;

    // If reminder has custom settings, expand the settings panel
    const hasCustomSettings =
      reminder.sound_enabled !== null ||
      reminder.sound_type !== null ||
      reminder.shake_enabled !== null ||
      reminder.glow_enabled !== null;

    if (settingsToggle) {
      settingsToggle.checked = hasCustomSettings;
    }
    if (soundEnabled) {
      soundEnabled.checked = reminder.sound_enabled ?? true;
    }
    if (soundType) {
      soundType.value = reminder.sound_type ?? 'whoosh';
    }
    if (shakeEnabled) {
      shakeEnabled.checked = reminder.shake_enabled ?? true;
    }
    if (glowEnabled) {
      glowEnabled.checked = reminder.glow_enabled ?? true;
    }

    // Update save button text
    if (saveReminderBtn) {
      saveReminderBtn.textContent = 'Update';
    }
  }

  // Load and display reminders
  async function loadReminders(): Promise<void> {
    const remindersList = document.getElementById('reminders-list');
    if (!remindersList) {
      return;
    }

    try {
      const allReminders: Reminder[] = await listActiveReminders();
      const noteReminders = allReminders.filter((r: Reminder) => r.note_id === note.id);

      if (noteReminders.length === 0) {
        remindersList.innerHTML =
          '<p class="text-base-content/50 text-sm">No active reminders.</p>';
        return;
      }

      remindersList.innerHTML = noteReminders
        .map(
          (reminder) => `
        <div class="flex items-center justify-between p-3 bg-base-200 rounded-lg">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div>
              <p class="font-medium">${formatReminderDate(reminder.trigger_time)}</p>
              <p class="text-xs text-base-content/50">Reminder will notify you at this time</p>
            </div>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm btn-circle edit-reminder" data-reminder='${JSON.stringify(reminder).replace(/'/g, '&#39;')}' title="Edit reminder">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-circle delete-reminder" data-id="${reminder.id}" title="Delete reminder">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      `
        )
        .join('');

      // Attach edit handlers
      remindersList.querySelectorAll('.edit-reminder').forEach((btn) => {
        btn.addEventListener('click', () => {
          const reminderData = btn.getAttribute('data-reminder');
          if (reminderData) {
            try {
              const reminder: Reminder = JSON.parse(reminderData);
              populateFormForEdit(reminder);
              reminderForm?.classList.remove('hidden');
            } catch (error) {
              logger.error('Failed to parse reminder data', LOG_CONTEXT, error);
            }
          }
        });
      });

      // Attach delete handlers
      remindersList.querySelectorAll('.delete-reminder').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          try {
            await deleteReminder(id!);
            await loadReminders();
          } catch (error) {
            logger.error('Failed to delete reminder', LOG_CONTEXT, error);
          }
        });
      });
    } catch (error) {
      logger.error('Failed to load reminders', LOG_CONTEXT, error);
      remindersList.innerHTML = '<p class="text-error text-sm">Failed to load reminders</p>';
    }
  }

  addReminderBtn?.addEventListener('click', () => {
    resetFormForCreate();
    reminderForm?.classList.remove('hidden');
  });

  // Play sound preview when changing the sound type dropdown
  const soundTypeSelect = document.getElementById('reminder-sound-type') as HTMLSelectElement;
  soundTypeSelect?.addEventListener('change', () => {
    playNotificationSound(soundTypeSelect.value);
  });

  cancelReminderBtn?.addEventListener('click', () => {
    reminderForm?.classList.add('hidden');
    editingReminderId = null;
  });

  saveReminderBtn?.addEventListener('click', async () => {
    const datetimeValue = reminderDatetime?.value;
    if (!datetimeValue) {
      showAlert('Please select a date and time', { title: 'Invalid Input', type: 'warning' });
      return;
    }

    try {
      const triggerDate = new Date(datetimeValue);

      // Check if settings panel was opened (user wants custom settings)
      const settingsToggle = document.getElementById(
        'reminder-settings-toggle'
      ) as HTMLInputElement;
      const soundEnabled = document.getElementById('reminder-sound-enabled') as HTMLInputElement;
      const soundType = document.getElementById('reminder-sound-type') as HTMLSelectElement;
      const shakeEnabled = document.getElementById('reminder-shake-enabled') as HTMLInputElement;
      const glowEnabled = document.getElementById('reminder-glow-enabled') as HTMLInputElement;

      // Only pass custom settings if the user opened the settings panel
      const settings = settingsToggle?.checked
        ? {
            sound_enabled: soundEnabled?.checked,
            sound_type: soundType?.value,
            shake_enabled: shakeEnabled?.checked,
            glow_enabled: glowEnabled?.checked,
          }
        : undefined;

      if (editingReminderId) {
        // Update existing reminder
        await updateReminder(editingReminderId, triggerDate, settings);
      } else {
        // Create new reminder
        await createReminder(note.id, triggerDate, settings);
      }

      reminderForm?.classList.add('hidden');
      editingReminderId = null;
      await loadReminders();
    } catch (error) {
      const action = editingReminderId ? 'update' : 'create';
      logger.error(`Failed to ${action} reminder`, LOG_CONTEXT, error);
      showAlert(`Failed to ${action} reminder: ` + error, { title: 'Error', type: 'error' });
    }
  });

  return { loadReminders };
}

// ============================================================================
// Collections Functionality
// ============================================================================

/**
 * Setup collection selector functionality
 */
function setupCollectionSelector(
  note: Note,
  onCollectionChange?: (updatedNote: Note) => void
): { loadCollections: () => Promise<void> } {
  const collectionSelect = document.getElementById('collection-select') as HTMLSelectElement;

  async function loadCollections(): Promise<void> {
    if (!collectionSelect) {
      return;
    }

    try {
      const collections: Collection[] = await listCollections();

      // Build options HTML
      let optionsHtml = '<option value="">None</option>';
      for (const collection of collections) {
        const selected = note.collection_id === collection.id ? 'selected' : '';
        optionsHtml += `<option value="${collection.id}" ${selected} data-color="${collection.color}">${escapeHtml(collection.name)}</option>`;
      }

      collectionSelect.innerHTML = optionsHtml;

      // Update visual indicator
      updateCollectionIndicator(collections);
    } catch (error) {
      logger.error('Failed to load collections', LOG_CONTEXT, error);
    }
  }

  function updateCollectionIndicator(collections: Collection[]): void {
    const selectedValue = collectionSelect?.value;
    const collection = collections.find((c) => c.id === selectedValue);

    // Add or update color indicator
    const existingIndicator = document.getElementById('collection-color-indicator');
    if (existingIndicator) {
      if (collection) {
        existingIndicator.style.backgroundColor = collection.color;
        existingIndicator.style.display = 'block';
      } else {
        existingIndicator.style.display = 'none';
      }
    }
  }

  // Handle collection change
  collectionSelect?.addEventListener('change', async () => {
    const selectedValue = collectionSelect.value || null;

    try {
      const updatedNote = await updateNoteCollection(note.id, selectedValue);
      note.collection_id = updatedNote.collection_id;
      logger.debug(`Note collection updated to: ${selectedValue}`, LOG_CONTEXT);

      // Update visual indicator
      const collections = await listCollections();
      updateCollectionIndicator(collections);

      // Notify that notes/collections have changed
      await emit('notes-list-changed');

      if (onCollectionChange) {
        onCollectionChange(updatedNote);
      }
    } catch (error) {
      logger.error('Failed to update note collection', LOG_CONTEXT, error);
      // Revert selection on error
      collectionSelect.value = note.collection_id || '';
    }
  });

  // Handle add collection button
  const addCollectionBtn = document.getElementById('add-collection-btn');
  addCollectionBtn?.addEventListener('click', async () => {
    const name = await showPrompt('Enter collection name:', {
      title: 'New Collection',
      input: { type: 'text', placeholder: 'Collection name' },
    });

    if (name && name.trim()) {
      try {
        // Pick a random color from the palette
        const color = COLLECTION_COLORS[Math.floor(Math.random() * COLLECTION_COLORS.length)];
        const newCollection = await createCollection(name.trim(), undefined, color);

        // Reload collections and select the new one
        await loadCollections();
        if (collectionSelect) {
          collectionSelect.value = newCollection.id;
        }

        // Update the note's collection
        const updatedNote = await updateNoteCollection(note.id, newCollection.id);
        note.collection_id = updatedNote.collection_id;

        const collections = await listCollections();
        updateCollectionIndicator(collections);

        // Notify that notes/collections have changed
        await emit('notes-list-changed');

        if (onCollectionChange) {
          onCollectionChange(updatedNote);
        }

        logger.debug(`Created new collection: ${newCollection.name}`, LOG_CONTEXT);
      } catch (error) {
        logger.error('Failed to create collection', LOG_CONTEXT, error);
      }
    }
  });

  return { loadCollections };
}

// ============================================================================
// HTML Template
// ============================================================================

function createEditorHTML(note: Note): string {
  const autoTitleChecked = !note.title_modified ? 'checked' : '';

  return `
    <div class="note-editor-wrapper">
      <!-- Title Section -->
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          <input type="text" id="note-title" class="input input-bordered flex-1 text-2xl font-bold"
                 value="${escapeHtml(note.title)}" placeholder="Note title...">
          <button id="expand-to-floating-btn" class="btn btn-ghost btn-sm btn-circle" title="Open in floating note window">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="auto-title-checkbox" class="checkbox checkbox-sm checkbox-primary" ${autoTitleChecked}>
          <span class="text-sm text-base-content/70">Auto-generate title from content</span>
        </label>
      </div>

      <!-- Editor -->
      <div id="note-editor" class="bg-base-100 min-h-[400px]"></div>
      <div class="mt-2 text-sm text-base-content/50" id="save-status">
        Last saved: ${formatDate(note.updated_at)}
      </div>

      <!-- Collection Section -->
      <div class="mt-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-lg">Collection</h3>
          <div class="flex items-center gap-2">
            <select id="collection-select" class="select select-bordered select-sm min-w-[150px]" data-current-collection="${note.collection_id || ''}">
              <option value="">None</option>
              <!-- Collections will be loaded dynamically -->
            </select>
            <button class="btn btn-ghost btn-sm btn-circle" id="add-collection-btn" title="Create new collection">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
        <p class="text-base-content/50 text-sm">Organize this note into a folder.</p>
      </div>

      <!-- Reminders Section -->
      <div class="mt-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-lg">Reminders</h3>
          <button id="add-reminder-btn" class="btn btn-sm btn-outline">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Set Reminder
          </button>
        </div>
        <div id="reminders-list" class="space-y-2"></div>
        <div id="reminder-form" class="hidden mt-3 p-3 bg-base-200 rounded">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Remind me on:</span>
            </label>
            <input type="datetime-local" id="reminder-datetime" class="input input-bordered input-sm w-full max-w-xs">
          </div>
          
          <!-- Per-reminder settings -->
          <div class="collapse collapse-arrow bg-base-300 mt-3">
            <input type="checkbox" id="reminder-settings-toggle" /> 
            <div class="collapse-title text-sm font-medium py-2">
              Notification Settings (optional)
            </div>
            <div class="collapse-content">
              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-3 py-1">
                  <input type="checkbox" id="reminder-sound-enabled" class="checkbox checkbox-sm checkbox-primary" checked>
                  <span class="label-text text-sm">Play sound</span>
                </label>
              </div>
              <div class="form-control ml-7 mb-2">
                <select id="reminder-sound-type" class="select select-bordered select-sm w-full max-w-xs">
                  <option value="whoosh">Whoosh (default)</option>
                  <option value="chime">Chime</option>
                  <option value="bell">Bell</option>
                  <option value="gentle">Gentle</option>
                  <option value="alert">Alert</option>
                </select>
              </div>
              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-3 py-1">
                  <input type="checkbox" id="reminder-shake-enabled" class="checkbox checkbox-sm checkbox-primary" checked>
                  <span class="label-text text-sm">Swoosh animation</span>
                </label>
              </div>
              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-3 py-1">
                  <input type="checkbox" id="reminder-glow-enabled" class="checkbox checkbox-sm checkbox-primary" checked>
                  <span class="label-text text-sm">Glow effect</span>
                </label>
              </div>
              <p class="text-xs text-base-content/50 mt-2">Leave checked to use global settings, or customize for this reminder.</p>
            </div>
          </div>
          
          <div class="mt-3 flex gap-2">
            <button id="save-reminder-btn" class="btn btn-primary btn-sm">Save</button>
            <button id="cancel-reminder-btn" class="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Attachments Section -->
      <div class="mt-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-lg">Attachments</h3>
          <label for="file-upload-${note.id}" class="btn btn-sm btn-outline">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Add File
          </label>
          <input type="file" id="file-upload-${note.id}" class="hidden" multiple>
        </div>
        <div id="attachments-list" class="space-y-2"></div>
      </div>

      <!-- Delete Note Section -->
      <div class="mt-8 pt-6 border-t border-base-300">
        <button id="delete-note-btn" class="btn btn-error btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Note
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// Main Editor Function
// ============================================================================

/**
 * Create a note editor with autosave
 * @param containerId - Container element ID
 * @param note - Note to edit
 * @param onSave - Callback after save (receives updated note)
 * @param onDelete - Callback when delete button is clicked
 * @returns Editor instance with cleanup method
 */
export function createNoteEditor(
  containerId: string,
  note: Note,
  onSave?: (note: Note) => void,
  onDelete?: () => void
): NoteEditorInstance {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container #${containerId} not found`);
  }

  // Render HTML template
  container.innerHTML = createEditorHTML(note);

  // Get DOM elements
  const titleInput = document.getElementById('note-title') as HTMLInputElement;
  const autoTitleCheckbox = document.getElementById('auto-title-checkbox') as HTMLInputElement;
  const editorElement = document.getElementById('note-editor') as HTMLElement;
  const saveStatus = document.getElementById('save-status') as HTMLElement;

  // Initialize title state
  const titleState: TitleState = {
    isManuallyModified: note.title_modified,
    lastAutoTitle: note.title,
  };

  // Setup Quill editor
  const quill = setupQuillEditor(editorElement, note);

  // Setup autosave
  const { saveImmediately, state: autosaveState } = setupAutosave(
    quill,
    titleInput,
    autoTitleCheckbox,
    saveStatus,
    note,
    titleState,
    onSave
  );

  // Setup attachments
  const { loadAttachments, cleanup: cleanupAttachments } = setupAttachments(
    quill,
    note,
    saveStatus
  );

  // Setup reminders
  const { loadReminders } = setupReminders(note);

  // Setup collection selector
  const { loadCollections } = setupCollectionSelector(note, onSave);

  // Setup delete button
  const deleteBtn = document.getElementById('delete-note-btn');
  if (deleteBtn && onDelete) {
    deleteBtn.addEventListener('click', () => {
      onDelete();
    });
  }

  // Setup expand to floating note button
  const expandBtn = document.getElementById('expand-to-floating-btn');
  if (expandBtn) {
    expandBtn.addEventListener('click', async () => {
      try {
        await invoke('open_note_window', { noteId: note.id });
      } catch (error) {
        logger.error('Failed to open floating note', LOG_CONTEXT, error);
        showAlert('Failed to open floating note: ' + error, { title: 'Error', type: 'error' });
      }
    });
  }

  // Load initial data
  loadReminders();
  loadAttachments();
  loadCollections();

  // If title is not manually modified, generate from content
  if (!note.title_modified) {
    const generatedTitle = generateTitleFromContent(quill);
    if (generatedTitle !== note.title && generatedTitle !== 'Untitled') {
      titleInput.value = generatedTitle;
      titleState.lastAutoTitle = generatedTitle;
    }
  }

  // Helper to check if note is empty
  const isNoteEmpty = (): boolean => {
    const text = quill.getText().trim();
    return text.length === 0;
  };

  // Cleanup function
  return {
    quill,
    destroy() {
      if (autosaveState.saveTimeout) {
        clearTimeout(autosaveState.saveTimeout);
      }
      // Perform final save if needed (and note is not empty)
      if (
        !isNoteEmpty() &&
        (titleInput.value !== note.title ||
          JSON.stringify(quill.getContents()) !== note.content_json)
      ) {
        saveImmediately();
      }
      // Clean up event listeners to prevent memory leaks
      cleanupAttachments();
    },
  };
}

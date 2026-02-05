/**
 * Sticky Note Window
 * Standalone floating note window with auto-save, theme support, and smart title handling
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalPosition } from '@tauri-apps/api/dpi';
import { listen, emit, Event } from '@tauri-apps/api/event';
import Quill from 'quill';
import type { Note, Reminder, ReminderSettings, Attachment } from './types';
import { showAlert } from './utils/modal';
import { createReminder, listActiveReminders, deleteReminder } from './utils/remindersApi';
import { updateNote } from './utils/notesApi';
import { logger } from './utils/logger';
import {
  createAttachment,
  listAttachments,
  getAttachmentData,
  deleteAttachment,
  createDataUrl,
  readFileAsBytes,
} from './utils/attachmentsApi';
import {
  registerAttachmentBlots,
  insertInlineAttachment,
} from './utils/quillAttachmentBlots';
import {
  escapeHtml,
  formatFileSize,
  formatReminderDate,
  getFileIconSmall,
} from './utils/formatters';
import { applySmartPaste } from './utils/smartPaste';
import { playNotificationSound } from './utils/notificationSound';
import { listCollections, updateNoteCollection, createCollection, COLLECTION_COLORS } from './utils/collectionsApi';
import { showPrompt } from './utils/modal';
import type { Collection } from './types';

// Register custom blots once at module load
registerAttachmentBlots();

const LOG_CONTEXT = 'StickyNote';

let noteId: string | null = null;
let currentNote: Note | null = null;
let editor: Quill | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isDirty = false;
let isGlowing = false;

/** Cached reminder settings */
let reminderSettings: ReminderSettings = {
  sound_enabled: true,
  sound_frequency: 880,
  sound_duration: 500,
  shake_enabled: true,
  shake_duration: 600,
  glow_enabled: true,
  sound_type: 'whoosh',
};

/** Track whether the title was manually modified */
let titleModified = false;

// Theme management
const THEME_KEY = 'swatnotes-theme';

function getStoredTheme(): string {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(): void {
  const theme = getStoredTheme();
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Load reminder settings from backend
 */
async function loadReminderSettings(): Promise<void> {
  try {
    const settings = await invoke<ReminderSettings>('get_reminder_settings');
    reminderSettings = settings;
    logger.debug('Loaded reminder settings', LOG_CONTEXT, reminderSettings);
  } catch (error) {
    logger.warn('Failed to load reminder settings, using defaults', LOG_CONTEXT, error);
  }
}

/**
 * Generate a title from note content
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

/**
 * Check if note content is empty (only whitespace)
 */
function isNoteEmpty(quill: Quill): boolean {
  const text = quill.getText().trim();
  return text.length === 0;
}

/**
 * Update the title input with auto-generated or manual title
 */
function updateTitleDisplay(): void {
  const titleInput = document.getElementById('note-title') as HTMLInputElement;
  const toggleBtn = document.getElementById('toggle-title-btn');

  if (titleInput && editor) {
    if (!titleModified) {
      // Auto-generate title from content
      const generatedTitle = generateTitleFromContent(editor);
      titleInput.value = generatedTitle;
      document.title = generatedTitle;
    }
  }

  // Update toggle button appearance
  if (toggleBtn) {
    if (titleModified) {
      toggleBtn.classList.add('text-primary');
      toggleBtn.title = 'Title is manually set. Click to enable auto-title.';
    } else {
      toggleBtn.classList.remove('text-primary');
      toggleBtn.title = 'Title is auto-generated. Click to set manual title.';
    }
  }
}

// Get note ID from window label
const currentWindow = getCurrentWebviewWindow();
const windowLabel = currentWindow.label;
noteId = windowLabel.replace('note-', '');

// Initialize
async function init(): Promise<void> {
  logger.debug(`Initializing sticky note for ID: ${noteId}`, LOG_CONTEXT);

  // Apply theme first
  applyTheme();

  // Load reminder settings
  await loadReminderSettings();

  // Listen for theme changes from main window
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      applyTheme();
    }
  });

  // Load note
  try {
    currentNote = await invoke<Note>('get_note', { id: noteId });
    logger.debug('Loaded note', LOG_CONTEXT, currentNote);

    // Set initial title modified state
    titleModified = currentNote.title_modified;

    // Initialize Quill editor with enhanced toolbar
    editor = new Quill('#sticky-note-editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'color': [] }, { 'background': [] }],
          ['link', 'blockquote', 'code-block'],
          ['clean']
        ]
      },
      placeholder: 'Start typing...'
    });

    // Load content
    try {
      const content = JSON.parse(currentNote.content_json);
      editor.setContents(content);
    } catch (e) {
      logger.error('Failed to parse note content', LOG_CONTEXT, e);
    }

    // Set initial title
    const titleInput = document.getElementById('note-title') as HTMLInputElement;
    if (titleInput) {
      if (titleModified) {
        titleInput.value = currentNote.title;
      } else {
        // Auto-generate title from content
        titleInput.value = generateTitleFromContent(editor);
      }
    }

    // Update window title
    updateTitleDisplay();

    // Setup auto-save on content changes
    editor.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user') {
        isDirty = true;
        updateSaveStatus('saving');

        // Update title from content if not manually modified
        updateTitleDisplay();

        // Debounce auto-save
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await saveNote();
        }, 1000);
      }
    });

    // Setup event handlers
    setupEventHandlers();

    // Setup title input handlers
    setupTitleHandlers();

    // Setup reminder handlers
    setupReminderHandlers();

    // Setup attachment handlers
    setupAttachmentHandlers();

    // Setup collection selector
    await setupCollectionSelector();

    // Setup reminder notification listener
    setupReminderListener();

    // Show window after content is loaded to prevent white flash
    try {
      await currentWindow.show();
      await currentWindow.setFocus();

      // Focus the editor so it's ready for typing
      editor.focus();

      // Set this as the last focused window
      try {
        await invoke('set_last_focused_note_window', { windowLabel: windowLabel });
        logger.debug(`Set initial last focused window to: ${windowLabel}`, LOG_CONTEXT);
      } catch (err) {
        logger.error('Failed to set initial last focused window', LOG_CONTEXT, err);
      }

      logger.debug('Window shown and focused, editor focused', LOG_CONTEXT);
    } catch (e) {
      logger.error('Failed to show window', LOG_CONTEXT, e);
    }

  } catch (error) {
    logger.error('Failed to load note', LOG_CONTEXT, error);
    showAlert('Failed to load note: ' + error, { title: 'Error', type: 'error' });
  }
}

function setupTitleHandlers(): void {
  const titleInput = document.getElementById('note-title') as HTMLInputElement;
  const toggleBtn = document.getElementById('toggle-title-btn');

  if (titleInput) {
    // When user types in title, mark as manually modified
    titleInput.addEventListener('input', () => {
      if (!titleModified && editor) {
        // Check if the title differs from auto-generated
        const autoTitle = generateTitleFromContent(editor);
        if (titleInput.value.trim() !== autoTitle) {
          titleModified = true;
          updateTitleDisplay();
        }
      }
      isDirty = true;
      updateSaveStatus('saving');

      // Update window title
      document.title = titleInput.value.trim() || 'Untitled';

      // Debounce save
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        await saveNote();
      }, 1000);
    });

    // Prevent editor focus when clicking title
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        editor?.focus();
      }
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      titleModified = !titleModified;
      updateTitleDisplay();

      if (!titleModified && editor) {
        // Re-generate title from content
        const generatedTitle = generateTitleFromContent(editor);
        if (titleInput) {
          titleInput.value = generatedTitle;
          document.title = generatedTitle;
        }
      }

      isDirty = true;
      updateSaveStatus('saving');

      // Save immediately when toggling
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        await saveNote();
      }, 500);
    });
  }
}

function setupEventHandlers(): void {
  // Track when this window gains focus for toggle hotkey
  currentWindow.onFocusChanged(({ payload: focused }) => {
    logger.debug(`Focus changed: ${focused} for window: ${windowLabel}`, LOG_CONTEXT);
    if (focused) {
      logger.debug(`Window gained focus, setting last focused window to: ${windowLabel}`, LOG_CONTEXT);
      invoke('set_last_focused_note_window', { windowLabel: windowLabel })
        .then(() => logger.debug('Successfully set last focused window', LOG_CONTEXT))
        .catch(err => logger.error('Failed to set last focused window', LOG_CONTEXT, err));
    }
  });

  // Listen for toggle hotkey (Ctrl+Shift+H) event
  currentWindow.listen('toggle-note-window', async () => {
    logger.debug('Toggle hotkey received', LOG_CONTEXT);

    if (!editor) {
      logger.warn('Editor not initialized', LOG_CONTEXT);
      return;
    }

    // Check if note is empty
    if (isNoteEmpty(editor)) {
      logger.debug('Note is empty, deleting and closing', LOG_CONTEXT);
      // Delete the empty note and close window
      try {
        await invoke('delete_note_and_close_window', { id: noteId });
        logger.debug('Empty note deleted and window closed', LOG_CONTEXT);
      } catch (error) {
        logger.error('Failed to delete empty note', LOG_CONTEXT, error);
        // If delete fails, just close the window
        try {
          await currentWindow.close();
        } catch (closeError) {
          logger.error('Failed to close window', LOG_CONTEXT, closeError);
        }
      }
    } else {
      logger.debug('Note has content, saving and hiding', LOG_CONTEXT);
      // Save if dirty, then hide
      if (isDirty) {
        await saveNote();
      }
      try {
        await currentWindow.hide();
      } catch (error) {
        logger.error('Failed to hide window', LOG_CONTEXT, error);
      }
    }
  });

  // Delete button - confirm and delete
  const deleteBtn = document.getElementById('delete-btn');
  deleteBtn?.addEventListener('click', async () => {
    if (!currentNote || !editor) {
      logger.warn('No current note to delete', LOG_CONTEXT);
      return;
    }

    // Use current title for confirmation
    const titleInput = document.getElementById('note-title') as HTMLInputElement;
    const noteTitle = titleInput?.value.trim() || generateTitleFromContent(editor);

    logger.info(`Deleting note: ${noteId}`, LOG_CONTEXT);
    try {
      // Use new command that both deletes and closes window
      await invoke('delete_note_and_close_window', { id: noteId });
      logger.info('Note deleted and window closed', LOG_CONTEXT);
    } catch (error) {
      logger.error('Failed to delete note', LOG_CONTEXT, error);
      showAlert('Failed to delete note: ' + error, { title: 'Error', type: 'error' });
    }
  });

  // Handle window close - delete empty notes, save non-empty ones
  currentWindow.onCloseRequested(async (event) => {
    logger.debug('Window close requested', LOG_CONTEXT);

    if (!editor) {
      logger.debug('Editor not initialized, allowing close', LOG_CONTEXT);
      return;
    }

    // Prevent default close to handle async operations
    event.preventDefault();

    if (isNoteEmpty(editor)) {
      logger.debug('Note is empty, deleting before close', LOG_CONTEXT);
      try {
        await invoke('delete_note', { id: noteId });
        logger.debug('Empty note deleted', LOG_CONTEXT);
      } catch (error) {
        logger.error('Failed to delete empty note', LOG_CONTEXT, error);
      }
    } else if (isDirty) {
      logger.debug('Note has unsaved changes, saving before close', LOG_CONTEXT);
      await saveNote();
    }

    // Now actually close the window
    try {
      await currentWindow.destroy();
    } catch (error) {
      logger.error('Failed to destroy window', LOG_CONTEXT, error);
    }
  });
}

async function saveNote(): Promise<void> {
  if (!isDirty || !editor || !currentNote) return;

  // Don't save empty notes
  if (isNoteEmpty(editor)) {
    logger.debug('Skipping save for empty note', LOG_CONTEXT);
    isDirty = false;
    return;
  }

  // Get title from input
  const titleInput = document.getElementById('note-title') as HTMLInputElement;
  const title = titleInput?.value.trim() || generateTitleFromContent(editor);

  updateSaveStatus('saving');

  try {
    const content = editor.getContents();
    const contentJson = JSON.stringify(content);

    await updateNote(noteId!, title, contentJson, titleModified);

    // Update current note reference
    if (currentNote) {
      currentNote.title = title;
      currentNote.content_json = contentJson;
      currentNote.title_modified = titleModified;
    }

    isDirty = false;
    updateSaveStatus('saved');
    logger.debug(`Note saved successfully with title: ${title}`, LOG_CONTEXT);

    // Notify main window that notes have changed
    await emit('notes-list-changed');
  } catch (error) {
    logger.error('Failed to save note', LOG_CONTEXT, error);
    updateSaveStatus('error');
    setTimeout(() => {
      if (!isDirty) {
        updateSaveStatus('saved');
      }
    }, 3000);
  }
}

function updateSaveStatus(status: 'saving' | 'saved' | 'error'): void {
  const statusEl = document.getElementById('save-status');
  if (!statusEl) return;

  switch (status) {
    case 'saving':
      statusEl.textContent = 'Saving...';
      statusEl.className = 'text-xs text-info';
      break;
    case 'saved':
      statusEl.textContent = 'Saved';
      statusEl.className = 'text-xs text-success';
      break;
    case 'error':
      statusEl.textContent = 'Save failed';
      statusEl.className = 'text-xs text-error';
      break;
  }
}

function setupReminderHandlers(): void {
  const reminderBtn = document.getElementById('reminder-btn');
  const reminderModal = document.getElementById('reminder-modal') as HTMLDialogElement;
  const saveReminderBtn = document.getElementById('save-reminder-btn');
  const cancelReminderBtn = document.getElementById('cancel-reminder-btn');
  const reminderDatetime = document.getElementById('reminder-datetime') as HTMLInputElement;

  // Set minimum datetime to now
  const now = new Date();
  const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  if (reminderDatetime) {
    reminderDatetime.min = localDatetime;
  }

  // Open reminder modal
  reminderBtn?.addEventListener('click', async () => {
    if (reminderModal) {
      reminderModal.showModal();
    }
    if (reminderDatetime) {
      reminderDatetime.value = localDatetime;
    }
    await loadReminders();
  });

  // Close reminder modal
  cancelReminderBtn?.addEventListener('click', () => {
    reminderModal?.close();
  });

  // Backdrop click is handled by the form method="dialog" in HTML

  // Save reminder
  saveReminderBtn?.addEventListener('click', async () => {
    if (!reminderDatetime || !reminderDatetime.value) {
      await showAlert('Please select a date and time', { title: 'Invalid Input', type: 'warning' });
      return;
    }

    try {
      const triggerDate = new Date(reminderDatetime.value);
      
      // Check if settings panel was opened (user wants custom settings)
      const settingsToggle = document.getElementById('reminder-settings-toggle') as HTMLInputElement;
      const soundEnabled = document.getElementById('reminder-sound-enabled') as HTMLInputElement;
      const soundType = document.getElementById('reminder-sound-type') as HTMLSelectElement;
      const shakeEnabled = document.getElementById('reminder-shake-enabled') as HTMLInputElement;
      const glowEnabled = document.getElementById('reminder-glow-enabled') as HTMLInputElement;
      
      // Only pass custom settings if the user opened the settings panel
      const settings = settingsToggle?.checked ? {
        sound_enabled: soundEnabled?.checked,
        sound_type: soundType?.value,
        shake_enabled: shakeEnabled?.checked,
        glow_enabled: glowEnabled?.checked,
      } : undefined;
      
      await createReminder(noteId!, triggerDate, settings);
      reminderModal?.close();
      
      // Reset the settings panel for next time
      if (settingsToggle) settingsToggle.checked = false;
    } catch (error) {
      logger.error('Failed to create reminder', LOG_CONTEXT, error);
      await showAlert('Failed to create reminder: ' + error, { title: 'Error', type: 'error' });
    }
  });
}

async function loadReminders(): Promise<void> {
  const activeRemindersDiv = document.getElementById('active-reminders');
  if (!activeRemindersDiv || !noteId) return;

  try {
    const allReminders: Reminder[] = await listActiveReminders();
    const noteReminders = allReminders.filter((r: Reminder) => r.note_id === noteId);

    if (noteReminders.length === 0) {
      activeRemindersDiv.innerHTML = '<p class="text-base-content/50 text-sm">No active reminders for this note.</p>';
      return;
    }

    activeRemindersDiv.innerHTML = `
      <div>
        <p class="text-xs font-semibold mb-2 text-base-content/70">Active reminders:</p>
        ${noteReminders
          .map(
            (reminder) => `
          <div class="flex items-center justify-between text-xs p-2 bg-base-200 rounded mb-1">
            <span class="text-base-content/70">${formatReminderDate(reminder.trigger_time)}</span>
            <button class="btn btn-error btn-xs delete-reminder-btn" data-reminder-id="${reminder.id}" title="Delete reminder">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Attach delete handlers
    activeRemindersDiv.querySelectorAll('.delete-reminder-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const reminderId = btn.getAttribute('data-reminder-id');
        if (!reminderId) return;

        try {
          await deleteReminder(reminderId);
          await loadReminders(); // Reload the list
        } catch (error) {
          logger.error('Failed to delete reminder', LOG_CONTEXT, error);
          await showAlert('Failed to delete reminder', { title: 'Error', type: 'error' });
        }
      });
    });
  } catch (error) {
    logger.error('Failed to load reminders', LOG_CONTEXT, error);
    activeRemindersDiv.innerHTML = '<p class="text-error text-sm">Failed to load reminders</p>';
  }
}

// Helper functions formatReminderDate, formatFileSize, escapeHtml are imported from './utils/formatters'
// getFileIcon is replaced with getFileIconSmall for the smaller sticky note variant

// ============================================================================
// Attachments Functionality
// ============================================================================

function setupAttachmentHandlers(): void {
  const attachmentsBtn = document.getElementById('attachments-btn');
  const attachmentsModal = document.getElementById('attachments-modal') as HTMLDialogElement;
  const closeAttachmentsBtn = document.getElementById('close-attachments-btn');
  const fileUploadInput = document.getElementById('file-upload-input') as HTMLInputElement;
  const editorElement = document.getElementById('sticky-note-editor');
  const saveStatus = document.getElementById('save-status');

  // Helper function to upload file and insert inline
  async function handleFileUpload(file: File | Blob, filename?: string): Promise<void> {
    if (!noteId || !editor) return;

    const actualFilename = filename || (file instanceof File ? file.name : `pasted-image-${Date.now()}.png`);
    const mimeType = file.type || 'application/octet-stream';

    try {
      if (saveStatus) {
        saveStatus.textContent = `Uploading ${actualFilename}...`;
        saveStatus.className = 'text-xs text-info';
      }

      const data = await readFileAsBytes(file);
      const attachment = await createAttachment(noteId, actualFilename, mimeType, data);

      // Insert inline attachment into editor
      insertInlineAttachment(editor, attachment);

      if (saveStatus) {
        saveStatus.textContent = `${actualFilename} uploaded`;
        saveStatus.className = 'text-xs text-success';
      }

      setTimeout(() => {
        if (saveStatus) {
          saveStatus.textContent = 'Saved';
          saveStatus.className = 'text-xs text-base-content/50';
        }
      }, 2000);

      // Refresh attachments list and count
      await loadAttachments();
      await updateAttachmentsCount();
    } catch (error) {
      logger.error('Failed to upload file', LOG_CONTEXT, error);
      if (saveStatus) {
        saveStatus.textContent = `Failed to upload ${actualFilename}`;
        saveStatus.className = 'text-xs text-error';
      }
    }
  }

  // Open attachments modal
  attachmentsBtn?.addEventListener('click', async () => {
    if (attachmentsModal) {
      attachmentsModal.showModal();
    }
    await loadAttachments();
  });

  // Close attachments modal
  closeAttachmentsBtn?.addEventListener('click', () => {
    attachmentsModal?.close();
  });

  // Backdrop click is handled by the form method="dialog" in HTML

  // File upload handler (from attachments modal - also inserts inline)
  fileUploadInput?.addEventListener('change', async (e) => {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0 || !noteId) return;

    for (const file of Array.from(files)) {
      await handleFileUpload(file);
    }

    // Clear input
    fileUploadInput.value = '';
  });

  // Clipboard paste handler for images and smart text formatting
  const pasteHandler = async (e: ClipboardEvent) => {
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    if (!clipboardData) return;
    
    const items = clipboardData.items;

    // Check for images first - handle them specially
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          await handleFileUpload(blob, `pasted-image-${Date.now()}.png`);
        }
        return;
      }
    }
    
    // Try smart paste for plain text (detect titles, lists, URLs, etc.)
    if (editor) {
      try {
        if (applySmartPaste(editor, clipboardData)) {
          e.preventDefault();
          logger.debug('Smart paste applied', LOG_CONTEXT);
        }
        // If smart paste returns false, let Quill handle it natively (e.g., for HTML)
      } catch (err) {
        logger.warn('Smart paste failed, falling back to default', LOG_CONTEXT, err);
        // Let default paste behavior handle it
      }
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
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      await handleFileUpload(file);
    }
  };

  // Attach event listeners to editor
  if (editorElement) {
    editorElement.addEventListener('paste', pasteHandler as EventListener);
    editorElement.addEventListener('dragover', dragOverHandler);
    editorElement.addEventListener('dragleave', dragLeaveHandler);
    editorElement.addEventListener('drop', dropHandler);
  }

  // Initial attachment count update
  updateAttachmentsCount();
}

async function updateAttachmentsCount(): Promise<void> {
  const attachmentsCountSpan = document.getElementById('attachments-count');
  if (!attachmentsCountSpan || !noteId) return;

  try {
    const attachments: Attachment[] = await listAttachments(noteId);
    if (attachments.length > 0) {
      attachmentsCountSpan.textContent = `(${attachments.length})`;
    } else {
      attachmentsCountSpan.textContent = '';
    }
  } catch (error) {
    logger.error('Failed to get attachments count', LOG_CONTEXT, error);
    attachmentsCountSpan.textContent = '';
  }
}

async function loadAttachments(): Promise<void> {
  const attachmentsList = document.getElementById('attachments-list');
  if (!attachmentsList || !noteId) return;

  try {
    const attachments: Attachment[] = await listAttachments(noteId);

    // Update count
    await updateAttachmentsCount();

    if (attachments.length === 0) {
      attachmentsList.innerHTML = '<p class="text-base-content/50 text-sm text-center py-4">No attachments yet.<br>Add files using the button above.</p>';
      return;
    }

    attachmentsList.innerHTML = attachments
      .map(
        (att) => `
        <div class="flex items-center justify-between p-2 bg-base-200 rounded-lg text-sm">
          <div class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer view-attachment" data-id="${att.id}" data-hash="${att.blob_hash}" data-mime="${att.mime_type}" data-filename="${escapeHtml(att.filename)}">
            ${getFileIconSmall(att.mime_type)}
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate text-xs">${escapeHtml(att.filename)}</p>
              <p class="text-xs text-base-content/50">${formatFileSize(att.size)}</p>
            </div>
          </div>
          <button class="btn btn-ghost btn-xs btn-circle delete-attachment-btn" data-id="${att.id}" title="Delete attachment">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `
      )
      .join('');

    // Attach view handlers
    attachmentsList.querySelectorAll('.view-attachment').forEach((el) => {
      el.addEventListener('click', async () => {
        const blobHash = el.getAttribute('data-hash');
        const mimeType = el.getAttribute('data-mime');
        const filename = el.getAttribute('data-filename');

        if (!blobHash || !mimeType) return;

        try {
          const data = await getAttachmentData(blobHash);
          const url = createDataUrl(data, mimeType);

          // For images, open in new window; for others, trigger download
          if (mimeType.startsWith('image/')) {
            window.open(url, '_blank');
          } else {
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'attachment';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        } catch (error) {
          logger.error('Failed to view attachment', LOG_CONTEXT, error);
          await showAlert('Failed to open attachment', { title: 'Error', type: 'error' });
        }
      });
    });

    // Attach delete handlers
    attachmentsList.querySelectorAll('.delete-attachment-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent triggering view
        const id = btn.getAttribute('data-id');
        if (!id) return;

        try {
          await deleteAttachment(id);
          await loadAttachments();
        } catch (error) {
          logger.error('Failed to delete attachment', LOG_CONTEXT, error);
          await showAlert('Failed to delete attachment', { title: 'Error', type: 'error' });
        }
      });
    });
  } catch (error) {
    logger.error('Failed to load attachments', LOG_CONTEXT, error);
    attachmentsList.innerHTML = '<p class="text-error text-sm">Failed to load attachments</p>';
  }
}

// ============================================================================
// Collection Selector Functionality
// ============================================================================

async function setupCollectionSelector(): Promise<void> {
  const collectionSelect = document.getElementById('collection-select') as HTMLSelectElement;
  const colorIndicator = document.getElementById('collection-color-indicator');

  if (!collectionSelect || !currentNote) return;

  async function loadCollections(): Promise<void> {
    try {
      const collections: Collection[] = await listCollections();

      // Build options HTML
      let optionsHtml = '<option value="">No folder</option>';
      for (const collection of collections) {
        const selected = currentNote?.collection_id === collection.id ? 'selected' : '';
        optionsHtml += `<option value="${collection.id}" ${selected} data-color="${collection.color}">${escapeHtml(collection.name)}</option>`;
      }

      collectionSelect.innerHTML = optionsHtml;
      updateColorIndicator(collections);
    } catch (error) {
      logger.error('Failed to load collections', LOG_CONTEXT, error);
    }
  }

  function updateColorIndicator(collections: Collection[]): void {
    const selectedValue = collectionSelect?.value;
    const collection = collections.find(c => c.id === selectedValue);

    if (colorIndicator) {
      if (collection) {
        colorIndicator.style.backgroundColor = collection.color;
        colorIndicator.classList.remove('hidden');
      } else {
        colorIndicator.classList.add('hidden');
      }
    }
  }

  // Handle collection change
  collectionSelect.addEventListener('change', async () => {
    const selectedValue = collectionSelect.value || null;

    if (!noteId) return;

    try {
      const updatedNote = await updateNoteCollection(noteId, selectedValue);
      if (currentNote) {
        currentNote.collection_id = updatedNote.collection_id;
      }
      logger.debug(`Note collection updated to: ${selectedValue}`, LOG_CONTEXT);

      // Update color indicator
      const collections = await listCollections();
      updateColorIndicator(collections);

      // Notify main window that notes have changed
      await emit('notes-list-changed');
    } catch (error) {
      logger.error('Failed to update note collection', LOG_CONTEXT, error);
      // Revert selection on error
      collectionSelect.value = currentNote?.collection_id || '';
    }
  });

  // Handle add collection button
  const addCollectionBtn = document.getElementById('add-collection-btn');
  addCollectionBtn?.addEventListener('click', async () => {
    const name = await showPrompt('Enter collection name:', {
      title: 'New Collection',
      input: { type: 'text', placeholder: 'Collection name' }
    });

    if (name && name.trim()) {
      try {
        // Pick a random color from the palette
        const color = COLLECTION_COLORS[Math.floor(Math.random() * COLLECTION_COLORS.length)];
        const newCollection = await createCollection(name.trim(), undefined, color);

        // Reload collections and select the new one
        await loadCollections();
        collectionSelect.value = newCollection.id;

        // Update the note's collection
        if (noteId) {
          const updatedNote = await updateNoteCollection(noteId, newCollection.id);
          if (currentNote) {
            currentNote.collection_id = updatedNote.collection_id;
          }
          const collections = await listCollections();
          updateColorIndicator(collections);
        }

        // Notify main window that collections/notes have changed
        await emit('notes-list-changed');

        logger.debug(`Created new collection: ${newCollection.name}`, LOG_CONTEXT);
      } catch (error) {
        logger.error('Failed to create collection', LOG_CONTEXT, error);
      }
    }
  });

  // Initial load
  await loadCollections();
}

/** Reminder triggered event payload */
interface ReminderTriggeredPayload {
  note_id: string;
  note_title?: string;
  /** Per-reminder sound setting (null = use global default) */
  sound_enabled: boolean | null;
  /** Per-reminder sound type (null = use global default) */
  sound_type: string | null;
  /** Per-reminder shake animation setting (null = use global default) */
  shake_enabled: boolean | null;
  /** Per-reminder glow effect setting (null = use global default) */
  glow_enabled: boolean | null;
}

async function setupReminderListener(): Promise<void> {
  logger.debug(`Setting up reminder listener for note: ${noteId}`, LOG_CONTEXT);

  await listen<ReminderTriggeredPayload>('reminder-triggered', async (event) => {
    logger.debug('Received reminder-triggered event', LOG_CONTEXT, event.payload);
    const { note_id, sound_enabled, sound_type, shake_enabled, glow_enabled } = event.payload;

    // Only respond if this is our note
    if (note_id === noteId) {
      logger.info('Reminder triggered for this note!', LOG_CONTEXT);

      // Reload global settings in case they changed (used as fallback)
      await loadReminderSettings();
      
      // Determine effective settings: per-reminder overrides global
      const effectiveSoundEnabled = sound_enabled ?? reminderSettings.sound_enabled;
      const effectiveSoundType = sound_type ?? reminderSettings.sound_type;
      const effectiveShakeEnabled = shake_enabled ?? reminderSettings.shake_enabled;
      const effectiveGlowEnabled = glow_enabled ?? reminderSettings.glow_enabled;

      // The backend already handles:
      // - Centering the window on screen
      // - Setting always on top (without focus)
      // - Showing the window

      // Add a small delay to ensure the window is fully visible and rendered
      // before applying visual effects. This ensures animations are visible.
      await new Promise(resolve => setTimeout(resolve, 150));

      // Apply visual and audio effects based on effective settings (per-reminder or global)
      try {
        // Play notification sound first (if enabled) - doesn't need visual rendering
        if (effectiveSoundEnabled) {
          playNotificationSound(effectiveSoundType);
        }

        // Shake the window (if enabled)
        if (effectiveShakeEnabled) {
          await shakeWindow();
        }

        // Start pulsing glow effect (if enabled)
        if (effectiveGlowEnabled) {
          startGlowEffect();
        }

        // Remove always-on-top after interaction or timeout
        // The user can dismiss by interacting with the window
        setTimeout(async () => {
          try {
            await currentWindow.setAlwaysOnTop(false);
          } catch (error) {
            logger.error('Failed to remove always-on-top', LOG_CONTEXT, error);
          }
        }, 5000); // 5 seconds before auto-removing always-on-top
      } catch (error) {
        logger.error('Failed to handle reminder trigger', LOG_CONTEXT, error);
      }
    }
  });

  // Setup listeners to stop glow on interaction
  setupGlowStopListeners();
}

async function shakeWindow(): Promise<void> {
  try {
    // Get current window position (set by backend after centering)
    const currentPos = await currentWindow.outerPosition();
    const windowSize = await currentWindow.outerSize();

    // Use the current position as the target (backend already centered the window)
    // This ensures we work correctly with the position the backend calculated
    const targetX = currentPos.x;
    const targetY = currentPos.y;

    // Start from off-screen top-left corner for dramatic swoosh effect
    const startX = -windowSize.width - 100;
    const startY = -windowSize.height - 100;

    // Move window to start position instantly
    await currentWindow.setPosition(new LogicalPosition(startX, startY));

    // Animation settings - fast and snappy
    const duration = Math.min(reminderSettings.shake_duration || 600, 800); // Max 800ms for swoosh
    const frames = 30; // Fewer frames for snappier animation
    const frameDelay = duration / frames;

    // Easing function for smooth swoosh (ease-out quart for dramatic deceleration)
    const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

    // Animate swoosh from top-left to center
    for (let i = 0; i <= frames; i++) {
      const progress = i / frames;
      const easedProgress = easeOutQuart(progress);

      // Add an arc to the path (curves down then up to center)
      const arcOffset = Math.sin(progress * Math.PI) * 80;

      const currentX = startX + (targetX - startX) * easedProgress;
      const currentY = startY + (targetY - startY) * easedProgress + arcOffset;

      await currentWindow.setPosition(new LogicalPosition(Math.round(currentX), Math.round(currentY)));
      await new Promise(resolve => setTimeout(resolve, frameDelay));
    }

    // Quick bounce/wiggle at the end
    const bounceFrames = [
      { x: 15, y: -10 },
      { x: -10, y: 8 },
      { x: 8, y: -5 },
      { x: -5, y: 3 },
      { x: 0, y: 0 }
    ];

    for (const offset of bounceFrames) {
      await currentWindow.setPosition(new LogicalPosition(targetX + offset.x, targetY + offset.y));
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    // Ensure we end at exact center position
    await currentWindow.setPosition(new LogicalPosition(targetX, targetY));
    logger.debug(`Window swoosh animation completed - centered at ${targetX}, ${targetY}`, LOG_CONTEXT);
  } catch (error) {
    logger.error('Failed to animate window', LOG_CONTEXT, error);
  }
}

function startGlowEffect(): void {
  if (isGlowing) return;

  const container = document.getElementById('sticky-note-container');
  if (!container) return;

  isGlowing = true;
  container.classList.add('reminder-glow');
  logger.debug('Glow effect started', LOG_CONTEXT);
}

function stopGlowEffect(): void {
  if (!isGlowing) return;

  const container = document.getElementById('sticky-note-container');
  if (!container) return;

  isGlowing = false;
  container.classList.remove('reminder-glow');
  logger.debug('Glow effect stopped', LOG_CONTEXT);
}

function setupGlowStopListeners(): void {
  // Stop glow on any click within the window
  document.addEventListener('click', () => {
    if (isGlowing) {
      stopGlowEffect();
    }
  });

  // Stop glow on any keypress
  document.addEventListener('keydown', () => {
    if (isGlowing) {
      stopGlowEffect();
    }
  });

  // Stop glow when editor gets focus
  const editorElement = document.getElementById('sticky-note-editor');
  if (editorElement) {
    editorElement.addEventListener('focus', () => {
      if (isGlowing) {
        stopGlowEffect();
      }
    }, true);
  }

  // Listen for window focus events
  currentWindow.listen('tauri://focus', () => {
    if (isGlowing) {
      stopGlowEffect();
    }
  });
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

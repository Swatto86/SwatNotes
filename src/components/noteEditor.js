// Note Editor Component with Quill.js integration and debounced autosave

import Quill from 'quill';
import { updateNote } from '../utils/notesApi.js';
import {
  createAttachment,
  listAttachments,
  getAttachmentData,
  deleteAttachment,
  createDataUrl,
  readFileAsBytes,
} from '../utils/attachmentsApi.js';
import { createReminder, listActiveReminders } from '../utils/remindersApi.js';

/**
 * Create a note editor with autosave
 * @param {string} containerId - Container element ID
 * @param {Note} note - Note to edit
 * @param {Function} onSave - Callback after save (receives updated note)
 * @returns {Object} Editor instance with cleanup method
 */
export function createNoteEditor(containerId, note, onSave) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container #${containerId} not found`);
  }

  // Clear container
  container.innerHTML = `
    <div class="note-editor-wrapper">
      <input type="text" id="note-title" class="input input-bordered w-full mb-4 text-2xl font-bold"
             value="${escapeHtml(note.title)}" placeholder="Note title...">
      <div id="note-editor" class="bg-base-100 min-h-[400px]"></div>
      <div class="mt-2 text-sm text-base-content/50" id="save-status">
        Last saved: ${formatDate(note.updated_at)}
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
    </div>
  `;

  const titleInput = document.getElementById('note-title');
  const editorElement = document.getElementById('note-editor');
  const saveStatus = document.getElementById('save-status');

  // Initialize Quill editor
  const quill = new Quill(editorElement, {
    theme: 'snow',
    placeholder: 'Start writing...',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        ['link', 'blockquote', 'code-block'],
        ['clean']
      ]
    }
  });

  // Load initial content
  try {
    const content = JSON.parse(note.content_json);
    quill.setContents(content);
  } catch (e) {
    console.error('Failed to parse note content:', e);
    quill.setText('');
  }

  // Debounced autosave
  let saveTimeout = null;
  let isSaving = false;

  const debouncedSave = async () => {
    if (isSaving) return;

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        isSaving = true;
        saveStatus.textContent = 'Saving...';
        saveStatus.classList.add('text-info');

        const title = titleInput.value.trim() || 'Untitled';
        const contentJson = JSON.stringify(quill.getContents());

        const updatedNote = await updateNote(note.id, title, contentJson);

        saveStatus.textContent = `Saved at ${formatDate(updatedNote.updated_at)}`;
        saveStatus.classList.remove('text-info');
        saveStatus.classList.add('text-success');

        setTimeout(() => {
          saveStatus.classList.remove('text-success');
        }, 2000);

        if (onSave) {
          onSave(updatedNote);
        }
      } catch (error) {
        console.error('Save error:', error);
        saveStatus.textContent = 'Save failed';
        saveStatus.classList.remove('text-info');
        saveStatus.classList.add('text-error');
      } finally {
        isSaving = false;
      }
    }, 500); // 500ms debounce
  };

  // Listen for changes
  quill.on('text-change', debouncedSave);
  titleInput.addEventListener('input', debouncedSave);

  // Save on blur (immediate)
  const saveImmediately = async () => {
    clearTimeout(saveTimeout);
    if (!isSaving) {
      await debouncedSave();
    }
  };

  titleInput.addEventListener('blur', saveImmediately);
  editorElement.addEventListener('blur', saveImmediately);

  // Clipboard paste handler for images
  editorElement.addEventListener('paste', async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    const items = clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        await handleImagePaste(blob);
        break;
      }
    }
  });

  async function handleImagePaste(blob) {
    try {
      saveStatus.textContent = 'Uploading image...';
      saveStatus.classList.add('text-info');

      const data = await readFileAsBytes(blob);
      const filename = `pasted-image-${Date.now()}.png`;
      const attachment = await createAttachment(note.id, filename, blob.type, data);

      // Insert image into editor at cursor
      const range = quill.getSelection(true);
      const dataUrl = await loadAttachmentAsDataUrl(attachment);
      quill.insertEmbed(range.index, 'image', dataUrl);
      quill.setSelection(range.index + 1);

      saveStatus.textContent = 'Image uploaded';
      saveStatus.classList.remove('text-info');
      saveStatus.classList.add('text-success');

      setTimeout(() => {
        saveStatus.classList.remove('text-success');
      }, 2000);

      // Refresh attachments list
      await loadAttachments();
    } catch (error) {
      console.error('Failed to upload image:', error);
      saveStatus.textContent = 'Image upload failed';
      saveStatus.classList.remove('text-info');
      saveStatus.classList.add('text-error');
    }
  }

  // File upload handler
  const fileInput = document.getElementById(`file-upload-${note.id}`);
  fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let file of files) {
      try {
        saveStatus.textContent = `Uploading ${file.name}...`;
        saveStatus.classList.add('text-info');

        const data = await readFileAsBytes(file);
        await createAttachment(note.id, file.name, file.type || 'application/octet-stream', data);

        saveStatus.textContent = `${file.name} uploaded`;
        saveStatus.classList.remove('text-info');
        saveStatus.classList.add('text-success');

        setTimeout(() => {
          saveStatus.classList.remove('text-success');
        }, 2000);
      } catch (error) {
        console.error('Failed to upload file:', error);
        saveStatus.textContent = `Failed to upload ${file.name}`;
        saveStatus.classList.remove('text-info');
        saveStatus.classList.add('text-error');
      }
    }

    // Clear input
    fileInput.value = '';

    // Refresh attachments list
    await loadAttachments();
  });

  // Load and display attachments
  async function loadAttachments() {
    const attachmentsList = document.getElementById('attachments-list');
    if (!attachmentsList) return;

    try {
      const attachments = await listAttachments(note.id);

      if (attachments.length === 0) {
        attachmentsList.innerHTML = '<p class="text-base-content/50 text-sm">No attachments yet. Paste images or add files.</p>';
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
          if (confirm('Delete this attachment?')) {
            await deleteAttachment(id);
            await loadAttachments();
          }
        });
      });
    } catch (error) {
      console.error('Failed to load attachments:', error);
      attachmentsList.innerHTML = '<p class="text-error text-sm">Failed to load attachments</p>';
    }
  }

  async function loadAttachmentAsDataUrl(attachment) {
    const data = await getAttachmentData(attachment.blob_hash);
    return createDataUrl(data, attachment.mime_type);
  }

  // Reminder handling
  const addReminderBtn = document.getElementById('add-reminder-btn');
  const reminderForm = document.getElementById('reminder-form');
  const saveReminderBtn = document.getElementById('save-reminder-btn');
  const cancelReminderBtn = document.getElementById('cancel-reminder-btn');
  const reminderDatetime = document.getElementById('reminder-datetime');

  // Set minimum datetime to now
  const now = new Date();
  const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  reminderDatetime.min = localDatetime;

  addReminderBtn?.addEventListener('click', () => {
    reminderForm.classList.remove('hidden');
    reminderDatetime.value = localDatetime;
  });

  cancelReminderBtn?.addEventListener('click', () => {
    reminderForm.classList.add('hidden');
  });

  saveReminderBtn?.addEventListener('click', async () => {
    const datetimeValue = reminderDatetime.value;
    if (!datetimeValue) {
      alert('Please select a date and time');
      return;
    }

    try {
      const triggerDate = new Date(datetimeValue);
      await createReminder(note.id, triggerDate);
      reminderForm.classList.add('hidden');
      await loadReminders();
    } catch (error) {
      console.error('Failed to create reminder:', error);
      alert('Failed to create reminder: ' + error);
    }
  });

  // Load and display reminders
  async function loadReminders() {
    const remindersList = document.getElementById('reminders-list');
    if (!remindersList) return;

    try {
      const allReminders = await listActiveReminders();
      const noteReminders = allReminders.filter(r => r.note_id === note.id);

      if (noteReminders.length === 0) {
        remindersList.innerHTML = '<p class="text-base-content/50 text-sm">No active reminders.</p>';
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
        </div>
      `
        )
        .join('');
    } catch (error) {
      console.error('Failed to load reminders:', error);
      remindersList.innerHTML = '<p class="text-error text-sm">Failed to load reminders</p>';
    }
  }

  function formatReminderDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString();
  }

  // Load reminders and attachments on init
  loadReminders();
  loadAttachments();

  // Cleanup function
  return {
    quill,
    destroy() {
      clearTimeout(saveTimeout);
      // Perform final save if needed
      if (titleInput.value !== note.title || JSON.stringify(quill.getContents()) !== note.content_json) {
        saveImmediately();
      }
    },
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>`;
  } else if (mimeType.startsWith('video/')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>`;
  } else if (mimeType.includes('pdf')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>`;
  } else {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>`;
  }
}

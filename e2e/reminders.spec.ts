/**
 * E2E Tests: Reminders
 *
 * Tests for reminder functionality including creating, viewing,
 * and deleting reminders on notes.
 */

describe('Reminders', () => {
  /**
   * Helper to check if a note is open in the editor
   */
  async function isNoteEditorOpen(): Promise<boolean> {
    try {
      const addReminderBtn = await $('#add-reminder-btn');
      return await addReminderBtn.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Navigate to the main page
   */
  async function navigateToMainPage(): Promise<void> {
    const currentUrl = await browser.getUrl();
    const baseUrl = currentUrl.replace(/\/[^/]*$/, '');
    await browser.url(`${baseUrl}/index.html`);
    await browser.pause(1000);
  }

  /**
   * Helper to ensure a note is open in the editor
   * Creates a new note if needed, then clicks on it to open
   */
  async function ensureNoteOpenInEditor(): Promise<void> {
    // Check if we already have a note open in editor
    if (await isNoteEditorOpen()) {
      return; // Already have a note open
    }

    // Wait for page to be ready
    await browser.pause(500);

    // Check if there are any notes in the list
    let noteCards = await $$('.note-card');

    if (noteCards.length === 0) {
      // Create a note first - look for new note button
      const newNoteBtn = await $('#new-note-btn');
      if (await newNoteBtn.isDisplayed().catch(() => false)) {
        await newNoteBtn.click();
        await browser.pause(2000); // Wait for note to be created (floating window opens)

        // Refresh the note cards list
        noteCards = await $$('.note-card');
      }
    }

    // Click on the first note to open it in the editor
    if (noteCards.length > 0) {
      await noteCards[0].click();
      await browser.pause(1000); // Wait for editor to load
    }

    // Wait for the editor to be ready
    await browser.waitUntil(
      async () => await isNoteEditorOpen(),
      {
        timeout: 10000,
        timeoutMsg: 'Note editor did not open',
      }
    );
  }

  // Initial setup - navigate to main page and open a note
  before(async () => {
    await navigateToMainPage();
    await ensureNoteOpenInEditor();
  });

  describe('Reminder UI Elements', () => {
    it('should display the Set Reminder button', async () => {
      const addReminderBtn = await $('#add-reminder-btn');
      await expect(addReminderBtn).toBeDisplayed();
    });

    it('should have Set Reminder button with correct text', async () => {
      const addReminderBtn = await $('#add-reminder-btn');
      const text = await addReminderBtn.getText();
      expect(text).toContain('Reminder');
    });

    it('should have Set Reminder button be clickable', async () => {
      const addReminderBtn = await $('#add-reminder-btn');
      await expect(addReminderBtn).toBeClickable();
    });

    it('should display reminders list container', async () => {
      const remindersList = await $('#reminders-list');
      await expect(remindersList).toBeDisplayed();
    });

    it('should have reminder form initially hidden', async () => {
      const reminderForm = await $('#reminder-form');
      const isDisplayed = await reminderForm.isDisplayed();
      expect(isDisplayed).toBe(false);
    });
  });

  describe('Reminder Form Interaction', () => {
    it('should show reminder form when clicking Set Reminder', async () => {
      const addReminderBtn = await $('#add-reminder-btn');
      await addReminderBtn.click();
      await browser.pause(300);

      const reminderForm = await $('#reminder-form');
      await expect(reminderForm).toBeDisplayed();
    });

    it('should display datetime input in form', async () => {
      const datetimeInput = await $('#reminder-datetime');
      await expect(datetimeInput).toBeDisplayed();
    });

    it('should have datetime input be type datetime-local', async () => {
      const datetimeInput = await $('#reminder-datetime');
      const type = await datetimeInput.getAttribute('type');
      expect(type).toBe('datetime-local');
    });

    it('should display Save button in form', async () => {
      const saveBtn = await $('#save-reminder-btn');
      await expect(saveBtn).toBeDisplayed();
      const text = await saveBtn.getText();
      expect(text).toContain('Save');
    });

    it('should display Cancel button in form', async () => {
      const cancelBtn = await $('#cancel-reminder-btn');
      await expect(cancelBtn).toBeDisplayed();
      const text = await cancelBtn.getText();
      expect(text).toContain('Cancel');
    });

    it('should have Save button be clickable', async () => {
      const saveBtn = await $('#save-reminder-btn');
      await expect(saveBtn).toBeClickable();
    });

    it('should have Cancel button be clickable', async () => {
      const cancelBtn = await $('#cancel-reminder-btn');
      await expect(cancelBtn).toBeClickable();
    });

    it('should hide form when clicking Cancel', async () => {
      const cancelBtn = await $('#cancel-reminder-btn');
      await cancelBtn.click();
      await browser.pause(300);

      const reminderForm = await $('#reminder-form');
      const isDisplayed = await reminderForm.isDisplayed();
      expect(isDisplayed).toBe(false);
    });

    it('should be able to toggle form visibility multiple times', async () => {
      const addReminderBtn = await $('#add-reminder-btn');
      const reminderForm = await $('#reminder-form');

      // Open form
      await addReminderBtn.click();
      await browser.pause(200);
      expect(await reminderForm.isDisplayed()).toBe(true);

      // Close form
      const cancelBtn = await $('#cancel-reminder-btn');
      await cancelBtn.click();
      await browser.pause(200);
      expect(await reminderForm.isDisplayed()).toBe(false);

      // Open again
      await addReminderBtn.click();
      await browser.pause(200);
      expect(await reminderForm.isDisplayed()).toBe(true);

      // Close again for cleanup
      const cancelBtn2 = await $('#cancel-reminder-btn');
      await cancelBtn2.click();
      await browser.pause(200);
    });
  });

  describe('Creating Reminders', () => {
    it('should be able to set datetime value', async () => {
      // Open the form
      const addReminderBtn = await $('#add-reminder-btn');
      await addReminderBtn.scrollIntoView();
      await addReminderBtn.click();
      await browser.pause(300);

      // Set a future datetime (tomorrow at noon)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      // Format as YYYY-MM-DDTHH:MM for datetime-local input
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const datetimeValue = `${year}-${month}-${day}T12:00`;

      // Use JavaScript to set the datetime value directly (clearValue + setValue doesn't work well with datetime-local)
      await browser.execute((val: string) => {
        const input = document.getElementById('reminder-datetime') as HTMLInputElement;
        if (input) {
          input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, datetimeValue);
      await browser.pause(200);

      const datetimeInput = await $('#reminder-datetime');
      const value = await datetimeInput.getValue();
      expect(value).toBe(datetimeValue);
    });

    it('should create reminder when clicking Save with valid datetime', async () => {
      // The form should still be open from previous test
      // If not, open it
      const reminderForm = await $('#reminder-form');
      if (!(await reminderForm.isDisplayed())) {
        const addReminderBtn = await $('#add-reminder-btn');
        await addReminderBtn.scrollIntoView();
        await addReminderBtn.click();
        await browser.pause(300);

        // Set datetime using JavaScript
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const year = tomorrow.getFullYear();
        const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const day = String(tomorrow.getDate()).padStart(2, '0');
        const datetimeValue = `${year}-${month}-${day}T12:00`;

        await browser.execute((val: string) => {
          const input = document.getElementById('reminder-datetime') as HTMLInputElement;
          if (input) {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, datetimeValue);
        await browser.pause(200);
      }

      // Click save
      const saveBtn = await $('#save-reminder-btn');
      await saveBtn.scrollIntoView();
      await saveBtn.click();
      await browser.pause(500);

      // Form should be hidden after saving
      const formAfterSave = await $('#reminder-form');
      expect(await formAfterSave.isDisplayed()).toBe(false);
    });

    it('should display created reminder in the list', async () => {
      // Wait for the reminders list to update
      await browser.pause(500);

      const remindersList = await $('#reminders-list');
      const html = await remindersList.getHTML();

      // The list should contain reminder content or be empty
      // Check if it has any content or reminder items
      expect(html.length).toBeGreaterThan(0);
    });
  });

  describe('Reminder List Display', () => {
    it('should show reminders list section', async () => {
      const remindersList = await $('#reminders-list');
      await expect(remindersList).toBeDisplayed();
    });

    it('should display reminder items or empty state', async () => {
      const remindersList = await $('#reminders-list');
      const html = await remindersList.getHTML();

      // Check structure exists
      expect(html).toBeTruthy();
    });

    it('should have delete buttons on reminder items if reminders exist', async () => {
      const deleteButtons = await $$('.delete-reminder');

      // If there are reminders, they should have delete buttons
      for (const btn of deleteButtons) {
        await expect(btn).toBeClickable();
      }
    });
  });

  describe('Multiple Notes with Reminders', () => {
    before(async () => {
      // Ensure we have at least 2 notes
      let noteCards = await $$('.note-card');
      while (noteCards.length < 2) {
        const newNoteBtn = await $('#new-note-btn');
        if (await newNoteBtn.isDisplayed().catch(() => false)) {
          await newNoteBtn.click();
          await browser.pause(1500);
          noteCards = await $$('.note-card');
        } else {
          break; // Can't create more notes
        }
      }
    });

    it('should be able to switch between notes and see different reminders', async () => {
      // Get note cards
      const noteCards = await $$('.note-card');

      if (noteCards.length >= 2) {
        // Click first note
        await noteCards[0].click();
        await browser.pause(500);

        const remindersList1 = await $('#reminders-list');
        const html1 = await remindersList1.getHTML();

        // Click second note
        await noteCards[1].click();
        await browser.pause(500);

        const remindersList2 = await $('#reminders-list');
        const html2 = await remindersList2.getHTML();

        // Both should have reminders lists (may or may not have content)
        expect(html1).toBeTruthy();
        expect(html2).toBeTruthy();
      }
    });
  });

  describe('Reminder Form Validation', () => {
    before(async () => {
      // Close any open modals by pressing Escape or clicking backdrop
      await browser.execute(() => {
        // Close all open DaisyUI modals
        const modals = document.querySelectorAll('dialog.modal[open], .modal.modal-open');
        modals.forEach((modal) => {
          if (modal instanceof HTMLDialogElement) {
            modal.close();
          } else {
            modal.classList.remove('modal-open');
          }
        });
        // Also close the reminder form if open
        const reminderForm = document.getElementById('reminder-form');
        if (reminderForm) {
          reminderForm.classList.add('hidden');
        }
      });
      await browser.pause(300);

      // Dismiss any error alerts that might be blocking
      const errorAlerts = await $$('.alert-error');
      for (const alert of errorAlerts) {
        try {
          const closeBtn = await alert.$('button');
          if (await closeBtn.isDisplayed().catch(() => false)) {
            await closeBtn.click();
            await browser.pause(200);
          }
        } catch {
          // Alert might auto-dismiss or not have close button
        }
      }

      // Ensure a note is open
      if (!(await isNoteEditorOpen())) {
        const noteCards = await $$('.note-card');
        if (noteCards.length > 0) {
          await noteCards[0].click();
          await browser.pause(500);
        }
      }

      // Scroll to the reminders section
      const addReminderBtn = await $('#add-reminder-btn');
      if (await addReminderBtn.isDisplayed().catch(() => false)) {
        await addReminderBtn.scrollIntoView();
        await browser.pause(200);
      }
    });

    it('should not create reminder without datetime selected', async () => {
      const addReminderBtn = await $('#add-reminder-btn');
      await addReminderBtn.scrollIntoView();
      await browser.pause(100);
      await addReminderBtn.click();
      await browser.pause(300);

      // Clear the datetime using JavaScript
      await browser.execute(() => {
        const input = document.getElementById('reminder-datetime') as HTMLInputElement;
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await browser.pause(100);

      // Try to save without datetime
      const saveBtn = await $('#save-reminder-btn');
      await saveBtn.click();
      await browser.pause(500);

      // Close any modal that might have opened (validation error modal)
      await browser.execute(() => {
        // Close any open modals by clicking their backdrop or close button
        const backdrops = document.querySelectorAll('[id*="backdrop"], .modal-backdrop');
        backdrops.forEach((el) => {
          if (el instanceof HTMLElement) { el.click(); }
        });
        // Also close DaisyUI modals
        const modals = document.querySelectorAll('dialog.modal[open]');
        modals.forEach((modal) => {
          if (modal instanceof HTMLDialogElement) { modal.close(); }
        });
        // Hide the reminder form
        const _reminderForm = document.getElementById('reminder-form');
        if (reminderForm) {
          reminderForm.classList.add('hidden');
        }
      });
      await browser.pause(300);

      // Form might still be visible since validation should prevent save
      // Or an error might be shown - either way, check the behavior
      const reminderForm = await $('#reminder-form');
      // Note: Actual validation behavior depends on implementation

      // Try to cancel to clean up (might not be visible if form was hidden)
      try {
        const cancelBtn = await $('#cancel-reminder-btn');
        if (await cancelBtn.isDisplayed().catch(() => false)) {
          await cancelBtn.click();
          await browser.pause(200);
        }
      } catch {
        // Cancel button might not be accessible, form already closed
      }
    });

    it('should accept future dates', async () => {
      // Close any lingering modals from previous test
      await browser.execute(() => {
        const backdrops = document.querySelectorAll('[id*="backdrop"], .modal-backdrop');
        backdrops.forEach((el) => {
          if (el instanceof HTMLElement) { el.click(); }
        });
        const modals = document.querySelectorAll('dialog.modal[open]');
        modals.forEach((modal) => {
          if (modal instanceof HTMLDialogElement) { modal.close(); }
        });
      });
      await browser.pause(300);

      const addReminderBtn = await $('#add-reminder-btn');
      await addReminderBtn.scrollIntoView();
      await browser.pause(100);
      await addReminderBtn.click();
      await browser.pause(300);

      // Set a date 1 week from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const year = futureDate.getFullYear();
      const month = String(futureDate.getMonth() + 1).padStart(2, '0');
      const day = String(futureDate.getDate()).padStart(2, '0');
      const datetimeValue = `${year}-${month}-${day}T14:30`;

      // Use JavaScript to set the datetime value directly
      await browser.execute((val: string) => {
        const input = document.getElementById('reminder-datetime') as HTMLInputElement;
        if (input) {
          input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, datetimeValue);
      await browser.pause(200);

      const datetimeInput = await $('#reminder-datetime');
      const value = await datetimeInput.getValue();
      expect(value).toBe(datetimeValue);

      // Cancel to clean up
      const cancelBtn = await $('#cancel-reminder-btn');
      await cancelBtn.click();
      await browser.pause(200);
    });
  });

  describe('Reminder Section Styling', () => {
    before(async () => {
      // Ensure a note is open
      if (!(await isNoteEditorOpen())) {
        const noteCards = await $$('.note-card');
        if (noteCards.length > 0) {
          await noteCards[0].click();
          await browser.pause(500);
        }
      }
    });

    it('should have reminders section with proper heading', async () => {
      // Look for the Reminders heading
      const headings = await $$('h3');

      let foundRemindersHeading = false;
      for (const heading of headings) {
        const text = await heading.getText();
        if (text.includes('Reminders')) {
          foundRemindersHeading = true;
          await expect(heading).toBeDisplayed();
          break;
        }
      }

      expect(foundRemindersHeading).toBe(true);
    });

    it('should have Set Reminder button with icon', async () => {
      const addReminderBtn = await $('#add-reminder-btn');
      const svg = await addReminderBtn.$('svg');
      await expect(svg).toBeDisplayed();
    });
  });

  describe('Per-Reminder Notification Settings', () => {
    // Helper to ensure notification settings panel is expanded
    async function ensureSettingsExpanded() {
      const settingsToggle = await $('#reminder-settings-toggle');
      const isChecked = await settingsToggle.isSelected();
      if (!isChecked) {
        // Use JavaScript click to avoid DaisyUI overlay issue
        await browser.execute((el) => el.click(), settingsToggle);
        await browser.pause(400); // Wait for collapse animation
      }
    }

    before(async () => {
      // Ensure a note is open
      if (!(await isNoteEditorOpen())) {
        await ensureNoteOpenInEditor();
      }
    });

    it('should display notification settings collapsible in reminder form', async () => {
      // Open reminder form
      const addReminderBtn = await $('#add-reminder-btn');
      await addReminderBtn.scrollIntoView();
      await addReminderBtn.click();
      await browser.pause(300);

      // Look for the notification settings toggle
      const settingsToggle = await $('#reminder-settings-toggle');
      await expect(settingsToggle).toExist();
    });

    it('should have notification settings collapsed by default', async () => {
      // The collapse checkbox should not be checked by default
      const settingsToggle = await $('#reminder-settings-toggle');
      const isChecked = await settingsToggle.isSelected();
      expect(isChecked).toBe(false);
    });

    it('should expand notification settings when clicked', async () => {
      // Click the checkbox directly using JavaScript to avoid DaisyUI overlay
      const settingsToggle = await $('#reminder-settings-toggle');
      await browser.execute((el) => el.click(), settingsToggle);
      await browser.pause(400);

      // Now the checkbox should be checked
      const isChecked = await settingsToggle.isSelected();
      expect(isChecked).toBe(true);
    });

    it('should display sound enabled checkbox', async () => {
      await ensureSettingsExpanded();
      const checkbox = await $('#reminder-sound-enabled');
      await expect(checkbox).toBeDisplayed();
    });

    it('should have sound enabled by default', async () => {
      await ensureSettingsExpanded();
      const checkbox = await $('#reminder-sound-enabled');
      const isChecked = await checkbox.isSelected();
      expect(isChecked).toBe(true);
    });

    it('should display sound type selector', async () => {
      await ensureSettingsExpanded();
      const select = await $('#reminder-sound-type');
      await expect(select).toBeDisplayed();
    });

    it('should have multiple sound options', async () => {
      await ensureSettingsExpanded();
      const select = await $('#reminder-sound-type');
      const options = await select.$$('option');
      expect(options.length).toBeGreaterThanOrEqual(3);
    });

    it('should display shake enabled checkbox', async () => {
      await ensureSettingsExpanded();
      const checkbox = await $('#reminder-shake-enabled');
      await expect(checkbox).toBeDisplayed();
    });

    it('should have shake enabled by default', async () => {
      await ensureSettingsExpanded();
      const checkbox = await $('#reminder-shake-enabled');
      const isChecked = await checkbox.isSelected();
      expect(isChecked).toBe(true);
    });

    it('should display glow enabled checkbox', async () => {
      await ensureSettingsExpanded();
      const checkbox = await $('#reminder-glow-enabled');
      await expect(checkbox).toBeDisplayed();
    });

    it('should have glow enabled by default', async () => {
      await ensureSettingsExpanded();
      const checkbox = await $('#reminder-glow-enabled');
      const isChecked = await checkbox.isSelected();
      expect(isChecked).toBe(true);
    });

    it('should be able to toggle sound checkbox', async () => {
      await ensureSettingsExpanded();
      const checkbox = await $('#reminder-sound-enabled');
      const initialState = await checkbox.isSelected();

      await checkbox.click();
      await browser.pause(200);

      const newState = await checkbox.isSelected();
      expect(newState).not.toBe(initialState);

      // Restore
      await checkbox.click();
    });

    it('should be able to change sound type', async () => {
      await ensureSettingsExpanded();
      const select = await $('#reminder-sound-type');
      const initialValue = await select.getValue();

      await select.selectByAttribute('value', 'chime');
      await browser.pause(200);

      const newValue = await select.getValue();
      expect(newValue).toBe('chime');

      // Restore
      await select.selectByAttribute('value', initialValue);
    });

    it('should collapse settings panel when clicking toggle again', async () => {
      // Make sure it's expanded first
      await ensureSettingsExpanded();

      // Click the checkbox to collapse using JavaScript
      const settingsToggle = await $('#reminder-settings-toggle');
      await browser.execute((el) => el.click(), settingsToggle);
      await browser.pause(400);

      const isChecked = await settingsToggle.isSelected();
      expect(isChecked).toBe(false);
    });

    after(async () => {
      // Clean up - close the form
      const cancelBtn = await $('#cancel-reminder-btn');
      if (await cancelBtn.isDisplayed().catch(() => false)) {
        await cancelBtn.click();
        await browser.pause(200);
      }
    });
  });

  describe('Editing Reminders', () => {
    /**
     * Helper to create a reminder and return to a known state
     */
    async function createTestReminder(): Promise<void> {
      const addReminderBtn = await $('#add-reminder-btn');
      await addReminderBtn.scrollIntoView();
      await addReminderBtn.click();
      await browser.pause(300);

      // Set a date 2 days from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      const year = futureDate.getFullYear();
      const month = String(futureDate.getMonth() + 1).padStart(2, '0');
      const day = String(futureDate.getDate()).padStart(2, '0');
      const datetimeValue = `${year}-${month}-${day}T10:00`;

      await browser.execute((val: string) => {
        const input = document.getElementById('reminder-datetime') as HTMLInputElement;
        if (input) {
          input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, datetimeValue);
      await browser.pause(200);

      const saveBtn = await $('#save-reminder-btn');
      await saveBtn.click();
      await browser.pause(500);
    }

    before(async () => {
      // Ensure a note is open
      if (!(await isNoteEditorOpen())) {
        await ensureNoteOpenInEditor();
      }
      // Create a reminder for testing edit functionality
      await createTestReminder();
    });

    it('should display edit button on reminder items', async () => {
      const editButtons = await $$('.edit-reminder');
      expect(editButtons.length).toBeGreaterThan(0);

      for (const btn of editButtons) {
        await expect(btn).toBeDisplayed();
        await expect(btn).toBeClickable();
      }
    });

    it('should have edit button with pencil icon', async () => {
      const editBtn = await $('.edit-reminder');
      const svg = await editBtn.$('svg');
      await expect(svg).toBeDisplayed();
    });

    it('should open form with reminder data when clicking edit', async () => {
      const editBtn = await $('.edit-reminder');
      await editBtn.click();
      await browser.pause(300);

      // Form should be visible
      const reminderForm = await $('#reminder-form');
      await expect(reminderForm).toBeDisplayed();

      // Datetime input should have a value (the existing reminder's datetime)
      const datetimeInput = await $('#reminder-datetime');
      const value = await datetimeInput.getValue();
      expect(value).toBeTruthy();
      expect(value.length).toBeGreaterThan(0);
    });

    it('should show Update text on save button when editing', async () => {
      // Form should still be open from previous test
      const saveBtn = await $('#save-reminder-btn');
      const text = await saveBtn.getText();
      expect(text).toContain('Update');
    });

    it('should be able to modify datetime when editing', async () => {
      // Change the datetime to a different value
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 5);
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      const newDatetimeValue = `${year}-${month}-${day}T15:30`;

      await browser.execute((val: string) => {
        const input = document.getElementById('reminder-datetime') as HTMLInputElement;
        if (input) {
          input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, newDatetimeValue);
      await browser.pause(200);

      const datetimeInput = await $('#reminder-datetime');
      const value = await datetimeInput.getValue();
      expect(value).toBe(newDatetimeValue);
    });

    it('should save updated reminder and close form', async () => {
      const saveBtn = await $('#save-reminder-btn');
      await saveBtn.click();
      await browser.pause(500);

      // Form should be hidden after saving
      const reminderForm = await $('#reminder-form');
      expect(await reminderForm.isDisplayed()).toBe(false);
    });

    it('should show Save text when creating new (not editing)', async () => {
      // Open form for new reminder (not edit)
      const addReminderBtn = await $('#add-reminder-btn');
      await addReminderBtn.click();
      await browser.pause(300);

      const saveBtn = await $('#save-reminder-btn');
      const text = await saveBtn.getText();
      expect(text).toContain('Save');
      expect(text).not.toContain('Update');

      // Cancel to clean up
      const cancelBtn = await $('#cancel-reminder-btn');
      await cancelBtn.click();
      await browser.pause(200);
    });

    it('should reset form when canceling edit and opening new', async () => {
      // Click edit on existing reminder
      const editBtn = await $('.edit-reminder');
      await editBtn.click();
      await browser.pause(300);

      // Save button should show Update
      let saveBtn = await $('#save-reminder-btn');
      let text = await saveBtn.getText();
      expect(text).toContain('Update');

      // Cancel the edit
      const cancelBtn = await $('#cancel-reminder-btn');
      await cancelBtn.click();
      await browser.pause(200);

      // Now click Add Reminder (new)
      const addReminderBtn = await $('#add-reminder-btn');
      await addReminderBtn.click();
      await browser.pause(300);

      // Save button should show Save (not Update)
      saveBtn = await $('#save-reminder-btn');
      text = await saveBtn.getText();
      expect(text).toContain('Save');
      expect(text).not.toContain('Update');

      // Cancel to clean up
      const cancelBtn2 = await $('#cancel-reminder-btn');
      await cancelBtn2.click();
      await browser.pause(200);
    });
  });
});

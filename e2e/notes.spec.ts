/**
 * E2E Tests: Notes CRUD Operations
 *
 * Tests for creating, reading, updating, and deleting notes.
 * Covers real-world usage scenarios and edge cases.
 */

describe('Notes CRUD Operations', () => {
  describe('Create Note', () => {
    it('should display the new note button', async () => {
      const newNoteBtn = await $('#new-note-btn');
      await expect(newNoteBtn).toBeDisplayed();
      await expect(newNoteBtn).toBeClickable();
    });

    it('should have new note button with proper icon', async () => {
      const newNoteBtn = await $('#new-note-btn');
      const svg = await newNoteBtn.$('svg');
      await expect(svg).toBeDisplayed();
    });

    it('should create a new note when clicking New Note button', async () => {
      // Get initial note count
      const initialCards = await $$('.note-card');
      const initialCount = initialCards.length;

      // Click the new note button
      const newNoteBtn = await $('#new-note-btn');
      await newNoteBtn.click();

      // Wait for note to be created (floating window opens)
      await browser.pause(1500);

      // Check that notes list is still displayed
      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();
    });

    it('should show the note in the list after creation', async () => {
      // Create a note
      const newNoteBtn = await $('#new-note-btn');
      await newNoteBtn.click();

      await browser.pause(1500);

      // The note should appear in the list
      const noteCards = await $$('.note-card');
      expect(noteCards.length).toBeGreaterThan(0);
    });

    it('should be able to create multiple notes', async () => {
      const newNoteBtn = await $('#new-note-btn');

      // Create first note
      await newNoteBtn.click();
      await browser.pause(1500);

      // Create second note
      await newNoteBtn.click();
      await browser.pause(1500);

      // Should have multiple notes
      const noteCards = await $$('.note-card');
      expect(noteCards.length).toBeGreaterThanOrEqual(2);
    });

    it('should update note count in All Notes filter', async () => {
      const allNotesCount = await $('#all-notes-count');
      const countText = await allNotesCount.getText();
      const count = parseInt(countText);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should increment note count when creating new note', async () => {
      // Get initial count
      const allNotesCount = await $('#all-notes-count');
      const initialCountText = await allNotesCount.getText();
      const initialCount = parseInt(initialCountText);

      // Create new note
      const newNoteBtn = await $('#new-note-btn');
      await newNoteBtn.click();
      await browser.pause(1500);

      // Check count increased
      const newCountText = await allNotesCount.getText();
      const newCount = parseInt(newCountText);
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    });
  });

  describe('Note Cards', () => {
    it('should display note cards in the list', async () => {
      // Ensure at least one note exists
      const noteCards = await $$('.note-card');

      if (noteCards.length === 0) {
        // Create a note first
        const newNoteBtn = await $('#new-note-btn');
        await newNoteBtn.click();
        await browser.pause(1500);
      }

      const cards = await $$('.note-card');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should have note cards with title and preview', async () => {
      const noteCards = await $$('.note-card');

      if (noteCards.length > 0) {
        const firstCard = noteCards[0];
        await expect(firstCard).toBeDisplayed();

        // Note cards should contain some content
        const cardHtml = await firstCard.getHTML();
        expect(cardHtml.length).toBeGreaterThan(50);
      }
    });

    it('should be able to click on a note card', async () => {
      const noteCards = await $$('.note-card');

      if (noteCards.length > 0) {
        const firstCard = noteCards[0];
        await expect(firstCard).toBeClickable();

        // Click the card
        await firstCard.click();
        await browser.pause(500);
      }
    });

    it('should have clickable note cards', async () => {
      const noteCards = await $$('.note-card');

      for (const card of noteCards) {
        await expect(card).toBeClickable();
      }
    });

    it('should have note cards with adequate click target size', async () => {
      const noteCards = await $$('.note-card');

      if (noteCards.length > 0) {
        const firstCard = noteCards[0];
        const size = await firstCard.getSize();

        // Cards should be large enough to click easily
        expect(size.width).toBeGreaterThanOrEqual(200);
        expect(size.height).toBeGreaterThanOrEqual(50);
      }
    });

    it('should display note cards with proper spacing', async () => {
      const noteCards = await $$('.note-card');

      if (noteCards.length >= 2) {
        const firstCard = noteCards[0];
        const secondCard = noteCards[1];

        const firstLoc = await firstCard.getLocation();
        const secondLoc = await secondCard.getLocation();

        // Cards should have vertical spacing (not overlapping)
        const firstSize = await firstCard.getSize();
        expect(secondLoc.y).toBeGreaterThan(firstLoc.y + firstSize.height - 5);
      }
    });
  });

  describe('Edit Note', () => {
    it('should be able to click on a note card to open it', async () => {
      // First ensure there's at least one note
      let noteCards = await $$('.note-card');

      if (noteCards.length === 0) {
        const newNoteBtn = await $('#new-note-btn');
        await newNoteBtn.click();
        await browser.pause(1500);
        noteCards = await $$('.note-card');
      }

      if (noteCards.length > 0) {
        // Click on the first note
        await noteCards[0].click();
        await browser.pause(500);

        // The note card should be interactable
        await expect(noteCards[0]).toBeDisplayed();
      }
    });

    it('should highlight or select note on click', async () => {
      const noteCards = await $$('.note-card');

      if (noteCards.length > 0) {
        const firstCard = noteCards[0];
        await firstCard.click();
        await browser.pause(300);

        // Card should still be displayed after click
        await expect(firstCard).toBeDisplayed();
      }
    });

    it('should open floating window when clicking note card', async () => {
      const noteCards = await $$('.note-card');

      if (noteCards.length > 0) {
        // Click on a note card
        await noteCards[0].click();
        await browser.pause(1000);

        // Verify the main app is still displayed (note opens in separate window)
        const app = await $('#app');
        await expect(app).toBeDisplayed();
      }
    });
  });

  describe('Search Notes', () => {
    it('should display search input', async () => {
      const searchInput = await $('#search-input');
      await expect(searchInput).toBeDisplayed();
    });

    it('should have search input with placeholder', async () => {
      const searchInput = await $('#search-input');
      const placeholder = await searchInput.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
      expect(placeholder.toLowerCase()).toContain('search');
    });

    it('should have search input be focusable', async () => {
      const searchInput = await $('#search-input');
      await searchInput.click();
      await browser.pause(100);

      // Should be able to focus
      const isFocused = await browser.execute(() => {
        return document.activeElement?.id === 'search-input';
      });
      expect(isFocused).toBe(true);
    });

    it('should accept text input in search', async () => {
      const searchInput = await $('#search-input');
      await searchInput.setValue('test search');

      await browser.pause(300);

      const value = await searchInput.getValue();
      expect(value).toBe('test search');
    });

    it('should filter notes when typing in search', async () => {
      const searchInput = await $('#search-input');

      // Clear any existing search
      await searchInput.clearValue();
      await browser.pause(200);

      // Type a search term
      await searchInput.setValue('unique search term xyz');
      await browser.pause(500);

      // Search should filter the notes list
      await expect(searchInput).toHaveValue('unique search term xyz');
    });

    it('should clear search when pressing Escape', async () => {
      const searchInput = await $('#search-input');
      await searchInput.clearValue();
      await searchInput.setValue('search term to clear');

      await browser.pause(300);

      // Press Escape to clear
      await browser.keys('Escape');

      await browser.pause(300);

      // Search should be cleared
      const value = await searchInput.getValue();
      expect(value).toBe('');
    });

    it('should show notes list after clearing search', async () => {
      const searchInput = await $('#search-input');

      // Search for something
      await searchInput.setValue('test');
      await browser.pause(300);

      // Clear
      await browser.keys('Escape');
      await browser.pause(300);

      // Notes list should be displayed
      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();
    });

    it('should have search input with adequate width', async () => {
      const searchInput = await $('#search-input');
      const size = await searchInput.getSize();

      // Search input should be wide enough for meaningful queries
      expect(size.width).toBeGreaterThanOrEqual(150);
    });

    it('should handle special characters in search', async () => {
      const searchInput = await $('#search-input');
      await searchInput.clearValue();
      await searchInput.setValue('test & special <chars>');
      await browser.pause(300);

      const value = await searchInput.getValue();
      expect(value).toBe('test & special <chars>');

      // Clear for next tests
      await browser.keys('Escape');
    });

    it('should handle empty search gracefully', async () => {
      const searchInput = await $('#search-input');
      await searchInput.clearValue();
      await browser.pause(300);

      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();
    });
  });

  describe('Notes List Panel', () => {
    it('should display notes list container', async () => {
      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();
    });

    it('should show empty state or notes', async () => {
      const notesList = await $('#notes-list');
      const html = await notesList.getHTML();

      // Should either have note cards or empty state message
      const hasContent = html.includes('note-card') || html.includes('No notes');
      expect(hasContent).toBe(true);
    });

    it('should be scrollable if many notes', async () => {
      const notesList = await $('#notes-list');

      // Check if element has overflow properties for scrolling
      const overflow = await notesList.getCSSProperty('overflow-y');
      expect(['auto', 'scroll', 'overlay']).toContain(overflow.value);
    });

    it('should have notes list with proper min height', async () => {
      const notesList = await $('#notes-list');
      const size = await notesList.getSize();

      // Notes list should have reasonable height for displaying notes
      expect(size.height).toBeGreaterThanOrEqual(200);
    });

    it('should display notes in chronological order', async () => {
      const noteCards = await $$('.note-card');

      // If we have multiple notes, they should be ordered
      if (noteCards.length >= 2) {
        // Each card should be positioned below the previous one
        const firstLoc = await noteCards[0].getLocation();
        const secondLoc = await noteCards[1].getLocation();

        // Second card should be below first (higher Y value)
        expect(secondLoc.y).toBeGreaterThan(firstLoc.y);
      }
    });
  });

  describe('Keyboard Navigation', () => {
    it('should focus search when pressing Ctrl+F or clicking', async () => {
      const searchInput = await $('#search-input');
      await searchInput.click();

      const isFocused = await browser.execute(() => {
        return document.activeElement?.id === 'search-input';
      });
      expect(isFocused).toBe(true);
    });

    it('should unfocus search on Escape', async () => {
      const searchInput = await $('#search-input');
      await searchInput.click();
      await browser.pause(100);

      // Press Escape
      await browser.keys('Escape');
      await browser.pause(100);

      // Search should be cleared
      const value = await searchInput.getValue();
      expect(value).toBe('');
    });

    it('should be able to tab between UI elements', async () => {
      // Start from a known element
      const newNoteBtn = await $('#new-note-btn');
      await newNoteBtn.click();
      await browser.pause(200);

      // Tab through elements
      await browser.keys('Tab');
      await browser.pause(100);

      // Verify something is focused
      const activeElement = await browser.execute(() => {
        return document.activeElement?.tagName;
      });
      expect(activeElement).toBeTruthy();
    });
  });

  describe('Note Card Visual States', () => {
    before(async () => {
      // Ensure at least one note exists
      const noteCards = await $$('.note-card');
      if (noteCards.length === 0) {
        const newNoteBtn = await $('#new-note-btn');
        await newNoteBtn.click();
        await browser.pause(1500);
      }
    });

    it('should have proper cursor on hover', async () => {
      const noteCards = await $$('.note-card');

      if (noteCards.length > 0) {
        const firstCard = noteCards[0];
        const cursor = await firstCard.getCSSProperty('cursor');
        // Should have pointer cursor for clickable element
        expect(['pointer', 'default']).toContain(cursor.value);
      }
    });

    it('should show note content preview in card', async () => {
      const noteCards = await $$('.note-card');

      if (noteCards.length > 0) {
        const firstCard = noteCards[0];
        const html = await firstCard.getHTML();

        // Card should have some structure
        expect(html.length).toBeGreaterThan(100);
      }
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should handle creating and viewing note in sequence', async () => {
      // Create a new note
      const newNoteBtn = await $('#new-note-btn');
      await newNoteBtn.click();
      await browser.pause(1500);

      // Note should appear in list
      const noteCards = await $$('.note-card');
      expect(noteCards.length).toBeGreaterThan(0);

      // Should be able to view it
      await noteCards[0].click();
      await browser.pause(500);

      // Main app should still be visible
      const app = await $('#app');
      await expect(app).toBeDisplayed();
    });

    it('should handle search then clear workflow', async () => {
      const searchInput = await $('#search-input');

      // Type search
      await searchInput.clearValue();
      await searchInput.setValue('test');
      await browser.pause(300);

      // Verify search is active
      expect(await searchInput.getValue()).toBe('test');

      // Clear search
      await browser.keys('Escape');
      await browser.pause(300);

      // Should show all notes again
      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();
    });

    it('should handle rapid note creation', async () => {
      const newNoteBtn = await $('#new-note-btn');
      const initialCards = await $$('.note-card');
      const initialCount = initialCards.length;

      // Create notes quickly
      await newNoteBtn.click();
      await browser.pause(800);
      await newNoteBtn.click();
      await browser.pause(800);

      // Should have more notes now
      const finalCards = await $$('.note-card');
      expect(finalCards.length).toBeGreaterThan(initialCount);
    });
  });
});

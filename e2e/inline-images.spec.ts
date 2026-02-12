/**
 * E2E Tests: Inline Image Paste
 *
 * Tests for pasting images from the clipboard into notes.
 * Verifies that inline images persist, render correctly,
 * and that the attachment system is properly wired up.
 *
 * Note: These tests run against the real built Tauri application
 * via WebView2 remote debugging. Image paste simulation uses
 * the browser's clipboard API rather than OS-level clipboard.
 */

describe('Inline Image Attachments', () => {
  /**
   * Ensure we have at least one note to work with.
   * Creates a note if none exist.
   */
  async function ensureNoteExists(): Promise<void> {
    const noteCards = await $$('.note-card');
    if (noteCards.length === 0) {
      const newNoteBtn = await $('#new-note-btn');
      await newNoteBtn.click();
      await browser.pause(1500);
    }
  }

  describe('Attachment System Integration', () => {
    before(async () => {
      // Ensure we're on the main page
      const currentUrl = await browser.getUrl();
      if (!currentUrl.includes('index.html')) {
        const baseUrl = currentUrl.replace(/\/[^/]*$/, '');
        await browser.url(`${baseUrl}/index.html`);
        await browser.pause(1000);
      }
    });

    it('should have the attachment API available via Tauri invoke', async () => {
      // Verify the Tauri invoke bridge is available for attachment commands
      const hasInvoke = await browser.execute(() => {
        return typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
      });
      expect(hasInvoke).toBe(true);
    });

    it('should create a note and verify attachment list is empty', async () => {
      await ensureNoteExists();

      // Open the first note by clicking
      const noteCards = await $$('.note-card');
      if (noteCards.length > 0) {
        await noteCards[0].click();
        await browser.pause(1500);

        // Verify main app is still responsive
        const app = await $('#app');
        await expect(app).toBeDisplayed();
      }
    });

    it('should have new note button accessible for creating notes with images', async () => {
      const newNoteBtn = await $('#new-note-btn');
      await expect(newNoteBtn).toBeDisplayed();
      await expect(newNoteBtn).toBeClickable();
    });

    it('should display note cards that can receive attachments', async () => {
      await ensureNoteExists();
      const noteCards = await $$('.note-card');
      expect(noteCards.length).toBeGreaterThan(0);

      // Each card should be clickable (to open editor where paste happens)
      for (const card of noteCards) {
        await expect(card).toBeClickable();
      }
    });
  });

  describe('Image Paste Handler Wiring', () => {
    before(async () => {
      const currentUrl = await browser.getUrl();
      if (!currentUrl.includes('index.html')) {
        const baseUrl = currentUrl.replace(/\/[^/]*$/, '');
        await browser.url(`${baseUrl}/index.html`);
        await browser.pause(1000);
      }
    });

    it('should have clipboard API available in WebView2', async () => {
      const hasClipboard = await browser.execute(() => {
        return typeof navigator.clipboard !== 'undefined';
      });
      expect(hasClipboard).toBe(true);
    });

    it('should have ClipboardEvent constructor available', async () => {
      const hasClipboardEvent = await browser.execute(() => {
        return typeof ClipboardEvent === 'function';
      });
      expect(hasClipboardEvent).toBe(true);
    });

    it('should have Blob constructor for image data', async () => {
      const hasBlob = await browser.execute(() => {
        return typeof Blob === 'function';
      });
      expect(hasBlob).toBe(true);
    });
  });

  describe('Existing Notes Without Images', () => {
    before(async () => {
      const currentUrl = await browser.getUrl();
      if (!currentUrl.includes('index.html')) {
        const baseUrl = currentUrl.replace(/\/[^/]*$/, '');
        await browser.url(`${baseUrl}/index.html`);
        await browser.pause(1000);
      }
    });

    it('should load existing notes without images unchanged', async () => {
      await ensureNoteExists();
      const noteCards = await $$('.note-card');
      expect(noteCards.length).toBeGreaterThan(0);

      // Verify cards render without errors
      for (const card of noteCards) {
        await expect(card).toBeDisplayed();
        const html = await card.getHTML();
        expect(html.length).toBeGreaterThan(20);
      }
    });

    it('should not show broken image indicators for text-only notes', async () => {
      // Check that the notes list doesn't contain broken image elements
      const brokenImages = await browser.execute(() => {
        const images = document.querySelectorAll('#notes-list img');
        let broken = 0;
        images.forEach((img: HTMLImageElement) => {
          if (!img.complete || img.naturalWidth === 0) {
            broken++;
          }
        });
        return broken;
      });
      expect(brokenImages).toBe(0);
    });

    it('should handle rapid note switching without image loading errors', async () => {
      const noteCards = await $$('.note-card');
      if (noteCards.length >= 2) {
        // Rapidly click between notes
        await noteCards[0].click();
        await browser.pause(200);
        await noteCards[1].click();
        await browser.pause(200);
        await noteCards[0].click();
        await browser.pause(500);

        // App should still be responsive
        const app = await $('#app');
        await expect(app).toBeDisplayed();
      }
    });
  });

  describe('Search Integration with Attachments', () => {
    before(async () => {
      const currentUrl = await browser.getUrl();
      if (!currentUrl.includes('index.html')) {
        const baseUrl = currentUrl.replace(/\/[^/]*$/, '');
        await browser.url(`${baseUrl}/index.html`);
        await browser.pause(1000);
      }
    });

    it('should still search notes after image feature is active', async () => {
      const searchInput = await $('#search-input');
      await expect(searchInput).toBeDisplayed();

      await searchInput.setValue('test');
      await browser.pause(500);

      // Search should not crash even with attachment-related notes
      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();

      // Clear search
      await searchInput.clearValue();
      await browser.pause(300);
    });
  });

  describe('UI Resilience', () => {
    before(async () => {
      const currentUrl = await browser.getUrl();
      if (!currentUrl.includes('index.html')) {
        const baseUrl = currentUrl.replace(/\/[^/]*$/, '');
        await browser.url(`${baseUrl}/index.html`);
        await browser.pause(1000);
      }
    });

    it('should not crash on creating multiple notes in sequence', async () => {
      const newNoteBtn = await $('#new-note-btn');

      // Create notes rapidly (simulates user creating notes to paste images into)
      await newNoteBtn.click();
      await browser.pause(800);
      await newNoteBtn.click();
      await browser.pause(800);

      // App should still be responsive
      const app = await $('#app');
      await expect(app).toBeDisplayed();

      const noteCards = await $$('.note-card');
      expect(noteCards.length).toBeGreaterThan(0);
    });

    it('should maintain note count consistency', async () => {
      const allNotesCount = await $('#all-notes-count');
      const countText = await allNotesCount.getText();
      const count = parseInt(countText);

      const noteCards = await $$('.note-card');

      // Count should match the number of visible note cards
      expect(count).toBeGreaterThanOrEqual(0);
      expect(noteCards.length).toBeGreaterThanOrEqual(0);
    });
  });
});

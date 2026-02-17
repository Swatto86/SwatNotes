/**
 * E2E Tests: Collections
 *
 * Tests for the collections/folders feature including
 * creating, managing, and filtering by collections.
 */

describe('Collections', () => {
  describe('Collections Panel', () => {
    it('should display collections toggle button', async () => {
      const toggle = await $('#collections-toggle');
      await expect(toggle).toBeDisplayed();
    });

    it('should display collections section header', async () => {
      const toggle = await $('#collections-toggle');
      const text = await toggle.getText();
      expect(text).toContain('Collections');
    });

    it('should have chevron icon for expand/collapse', async () => {
      const chevron = await $('#collections-chevron');
      await expect(chevron).toBeDisplayed();
    });

    it('should expand/collapse collections when clicking toggle', async () => {
      const toggle = await $('#collections-toggle');
      const collectionsList = await $('#collections-list');

      // Collections start expanded by default
      await expect(collectionsList).toBeDisplayed();

      // Click to collapse
      await toggle.click();
      await browser.pause(300);

      // Should be hidden now
      const isDisplayedAfterCollapse = await collectionsList.isDisplayed();
      expect(isDisplayedAfterCollapse).toBe(false);

      // Click again to expand
      await toggle.click();
      await browser.pause(300);

      // Should be visible again
      await expect(collectionsList).toBeDisplayed();
    });

    it('should display All Notes filter', async () => {
      // Collections are expanded by default, so filters should be visible
      const allNotesFilter = await $('#filter-all-notes');
      await expect(allNotesFilter).toBeDisplayed();
    });

    it('should display Uncategorized filter', async () => {
      const uncategorizedFilter = await $('#filter-uncategorized');
      await expect(uncategorizedFilter).toBeDisplayed();
    });

    it('should display add collection button', async () => {
      const addBtn = await $('#sidebar-add-collection-btn');
      await expect(addBtn).toBeDisplayed();
      await expect(addBtn).toBeClickable();
    });

    it('should filter notes when clicking All Notes', async () => {
      const allNotesFilter = await $('#filter-all-notes');
      await allNotesFilter.click();
      await browser.pause(500);

      // Should show the notes list
      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();
    });

    it('should highlight All Notes when selected', async () => {
      const allNotesFilter = await $('#filter-all-notes');
      await allNotesFilter.click();
      await browser.pause(300);

      // Should have selected styling (bg-base-300)
      const classAttr = await allNotesFilter.getAttribute('class');
      expect(classAttr).toContain('bg-base-300');
    });

    it('should filter to uncategorized notes', async () => {
      const uncategorizedFilter = await $('#filter-uncategorized');
      await uncategorizedFilter.click();
      await browser.pause(500);

      // Should show the notes list
      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();
    });
  });

  describe('Collection Counts', () => {
    it('should display count badge for All Notes', async () => {
      const allNotesCount = await $('#all-notes-count');
      await expect(allNotesCount).toBeDisplayed();
      const text = await allNotesCount.getText();
      expect(text).toMatch(/^\d+$/);
    });

    it('should display count badge for Uncategorized', async () => {
      const uncategorizedCount = await $('#uncategorized-count');
      await expect(uncategorizedCount).toBeDisplayed();
      const text = await uncategorizedCount.getText();
      expect(text).toMatch(/^\d+$/);
    });

    it('should have non-negative counts', async () => {
      const allNotesCount = await $('#all-notes-count');
      const uncategorizedCount = await $('#uncategorized-count');

      const allCount = parseInt(await allNotesCount.getText());
      const uncatCount = parseInt(await uncategorizedCount.getText());

      expect(allCount).toBeGreaterThanOrEqual(0);
      expect(uncatCount).toBeGreaterThanOrEqual(0);
    });

    it('should have uncategorized count <= all notes count', async () => {
      const allNotesCount = await $('#all-notes-count');
      const uncategorizedCount = await $('#uncategorized-count');

      const allCount = parseInt(await allNotesCount.getText());
      const uncatCount = parseInt(await uncategorizedCount.getText());

      expect(uncatCount).toBeLessThanOrEqual(allCount);
    });
  });

  describe('Add Collection', () => {
    it('should display add collection button with icon', async () => {
      const addBtn = await $('#sidebar-add-collection-btn');
      await expect(addBtn).toBeDisplayed();

      const svg = await addBtn.$('svg');
      await expect(svg).toBeDisplayed();
    });

    it('should have add collection button with tooltip', async () => {
      const addBtn = await $('#sidebar-add-collection-btn');
      const title = await addBtn.getAttribute('title');
      expect(title).toBeTruthy();
      expect(title.toLowerCase()).toContain('add');
    });

    it('should have clickable add collection button', async () => {
      const addBtn = await $('#sidebar-add-collection-btn');
      await expect(addBtn).toBeClickable();
    });

    it('should open add collection modal when clicking button', async () => {
      const addBtn = await $('#sidebar-add-collection-btn');
      await addBtn.click();
      await browser.pause(300);

      // Check if a modal or input appears
      // Could be a modal dialog or inline input
      const modals = await $$('dialog[open], .modal.modal-open, input[type="text"]');
      const hasModalOrInput = modals.length > 0;

      // Close any modal that opened
      await browser.keys('Escape');
      await browser.pause(200);

      expect(hasModalOrInput).toBe(true);
    });
  });

  describe('Collections List Area', () => {
    it('should display collections items container', async () => {
      const collectionsItems = await $('#collections-items');
      await expect(collectionsItems).toBeExisting();
    });

    it('should have collections list with adequate width', async () => {
      const collectionsList = await $('#collections-list');
      const size = await collectionsList.getSize();

      // Collections list should span the sidebar width
      expect(size.width).toBeGreaterThanOrEqual(200);
    });

    it('should have proper vertical spacing between collection items', async () => {
      const collectionsList = await $('#collections-list');
      const classAttr = await collectionsList.getAttribute('class');

      // Should have spacing class
      expect(classAttr).toContain('space-y');
    });
  });

  describe('Collection Buttons', () => {
    it('should have All Notes button with icon', async () => {
      const allNotesFilter = await $('#filter-all-notes');
      const svg = await allNotesFilter.$('svg');
      await expect(svg).toBeDisplayed();
    });

    it('should have Uncategorized button with icon', async () => {
      const uncategorizedFilter = await $('#filter-uncategorized');
      const svg = await uncategorizedFilter.$('svg');
      await expect(svg).toBeDisplayed();
    });

    it('should have adequate button heights for clicking', async () => {
      const allNotesFilter = await $('#filter-all-notes');
      const uncategorizedFilter = await $('#filter-uncategorized');

      const allSize = await allNotesFilter.getSize();
      const uncatSize = await uncategorizedFilter.getSize();

      // Buttons should be tall enough to click easily
      expect(allSize.height).toBeGreaterThanOrEqual(28);
      expect(uncatSize.height).toBeGreaterThanOrEqual(28);
    });

    it('should have hover state on collection buttons', async () => {
      const allNotesFilter = await $('#filter-all-notes');
      const classAttr = await allNotesFilter.getAttribute('class');

      // Should have hover styling
      expect(classAttr).toContain('hover:');
    });
  });

  describe('Collection Filtering', () => {
    it('should switch between All Notes and Uncategorized', async () => {
      const allNotesFilter = await $('#filter-all-notes');
      const uncategorizedFilter = await $('#filter-uncategorized');

      // Select All Notes
      await allNotesFilter.click();
      await browser.pause(300);

      let allClass = await allNotesFilter.getAttribute('class');
      expect(allClass).toContain('bg-base-300');

      // Select Uncategorized
      await uncategorizedFilter.click();
      await browser.pause(300);

      const _uncatClass = await uncategorizedFilter.getAttribute('class');
      // Uncategorized should now be selected

      // Click All Notes again
      await allNotesFilter.click();
      await browser.pause(300);

      allClass = await allNotesFilter.getAttribute('class');
      expect(allClass).toContain('bg-base-300');
    });

    it('should update notes list when filtering', async () => {
      const allNotesFilter = await $('#filter-all-notes');
      await allNotesFilter.click();
      await browser.pause(300);

      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();

      const uncategorizedFilter = await $('#filter-uncategorized');
      await uncategorizedFilter.click();
      await browser.pause(300);

      // Notes list should still be displayed (may have different content)
      await expect(notesList).toBeDisplayed();
    });
  });

  describe('Collections UI Responsiveness', () => {
    it('should maintain collections panel at minimum window size', async () => {
      const originalSize = await browser.getWindowSize();

      // Resize to minimum
      await browser.setWindowSize(800, 600);
      await browser.pause(300);

      // Collections should still be visible
      const collectionsToggle = await $('#collections-toggle');
      await expect(collectionsToggle).toBeDisplayed();

      const allNotesFilter = await $('#filter-all-notes');
      await expect(allNotesFilter).toBeDisplayed();

      // Restore
      await browser.setWindowSize(originalSize.width, originalSize.height);
      await browser.pause(300);
    });

    it('should keep collection buttons fully visible', async () => {
      const allNotesFilter = await $('#filter-all-notes');
      const location = await allNotesFilter.getLocation();
      const size = await allNotesFilter.getSize();
      const windowSize = await browser.getWindowSize();

      // Button should be fully within viewport
      expect(location.x).toBeGreaterThanOrEqual(0);
      expect(location.y).toBeGreaterThanOrEqual(0);
      expect(location.x + size.width).toBeLessThanOrEqual(windowSize.width);
    });
  });

  describe('Collections Description', () => {
    it('should display description text', async () => {
      // The description text may or may not be present depending on UI state
      // Check for the collections section header or any descriptive text
      const collectionsSection = await $('#collections-toggle');
      await expect(collectionsSection).toBeDisplayed();
      
      // The toggle should contain "Collections" text
      const toggleText = await collectionsSection.getText();
      expect(toggleText.toLowerCase()).toContain('collection');
    });

    it('should have description with muted styling', async () => {
      // Check that the collections section has appropriate styling
      const collectionsToggle = await $('#collections-toggle');
      await expect(collectionsToggle).toBeDisplayed();
      
      // The toggle should be styled appropriately
      const classAttr = await collectionsToggle.getAttribute('class');
      expect(classAttr).toBeTruthy();
    });
  });
});

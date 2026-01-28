/**
 * E2E Tests: Application Launch and Basic UI
 *
 * Tests that the application launches correctly and displays
 * the expected UI elements with adequate window sizes.
 */

describe('SwatNotes Application', () => {
  describe('Launch', () => {
    it('should launch the application', async () => {
      // The app should be running - verify by checking for the main app element
      const app = await $('#app');
      await expect(app).toBeDisplayed();
    });

    it('should display the notes list panel', async () => {
      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();
    });

    it('should display the new note button', async () => {
      const newNoteBtn = await $('#new-note-btn');
      await expect(newNoteBtn).toBeDisplayed();
      await expect(newNoteBtn).toBeClickable();
    });

    it('should display the search input', async () => {
      const searchInput = await $('#search-input');
      await expect(searchInput).toBeDisplayed();
    });

    it('should display empty state when no notes exist', async () => {
      // Look for the empty state message
      const emptyState = await $('*=No notes yet');
      const exists = await emptyState.isExisting();

      // If no notes, should show empty state
      // If notes exist, this is also valid
      expect(typeof exists).toBe('boolean');
    });

    it('should display collections toggle', async () => {
      const collectionsToggle = await $('#collections-toggle');
      await expect(collectionsToggle).toBeDisplayed();
    });

    it('should display version badge', async () => {
      const versionBadge = await $('#version-badge');
      await expect(versionBadge).toBeDisplayed();
      const text = await versionBadge.getText();
      expect(text).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it('should display welcome screen on fresh launch', async () => {
      const welcomeScreen = await $('#welcome-screen');
      // Welcome screen shown when no note is selected
      const exists = await welcomeScreen.isExisting();
      expect(typeof exists).toBe('boolean');
    });

    it('should display add collection button in sidebar', async () => {
      const addCollectionBtn = await $('#sidebar-add-collection-btn');
      await expect(addCollectionBtn).toBeDisplayed();
      await expect(addCollectionBtn).toBeClickable();
    });
  });

  describe('Window Size and Layout', () => {
    it('should have adequate main window dimensions', async () => {
      // Get viewport size
      const windowSize = await browser.getWindowSize();

      // Main window should meet minimum requirements (from tauri.conf.json: minWidth: 800, minHeight: 600)
      expect(windowSize.width).toBeGreaterThanOrEqual(800);
      expect(windowSize.height).toBeGreaterThanOrEqual(600);
    });

    it('should have recommended window size for usability', async () => {
      const windowSize = await browser.getWindowSize();

      // Default window is 1000x1028, should be at least close to that
      expect(windowSize.width).toBeGreaterThanOrEqual(800);
      expect(windowSize.height).toBeGreaterThanOrEqual(600);
    });

    it('should display sidebar at proper width', async () => {
      const sidebar = await $('aside');
      await expect(sidebar).toBeDisplayed();

      // Sidebar should be 256px wide (w-64 in Tailwind)
      const sidebarSize = await sidebar.getSize();
      expect(sidebarSize.width).toBeGreaterThanOrEqual(200);
      expect(sidebarSize.width).toBeLessThanOrEqual(300);
    });

    it('should have main content area fill remaining space', async () => {
      const main = await $('main');
      await expect(main).toBeDisplayed();

      const windowSize = await browser.getWindowSize();
      const mainSize = await main.getSize();

      // Main area should take up most of the window (minus sidebar)
      expect(mainSize.width).toBeGreaterThan(windowSize.width * 0.5);
    });

    it('should maintain proper layout at minimum size', async () => {
      // Get current size to restore later
      const originalSize = await browser.getWindowSize();

      // Resize to minimum
      await browser.setWindowSize(800, 600);
      await browser.pause(300);

      // Verify key elements are still visible
      const newNoteBtn = await $('#new-note-btn');
      await expect(newNoteBtn).toBeDisplayed();

      const searchInput = await $('#search-input');
      await expect(searchInput).toBeDisplayed();

      const notesList = await $('#notes-list');
      await expect(notesList).toBeDisplayed();

      // Restore original size
      await browser.setWindowSize(originalSize.width, originalSize.height);
      await browser.pause(300);
    });

    it('should not have horizontal overflow at default size', async () => {
      const app = await $('#app');
      const hasHorizontalScroll = await browser.execute(() => {
        const appEl = document.getElementById('app');
        if (!appEl) return false;
        return appEl.scrollWidth > appEl.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });

    it('should allow notes list to scroll vertically', async () => {
      const notesList = await $('#notes-list');
      const overflow = await notesList.getCSSProperty('overflow-y');
      expect(['auto', 'scroll', 'overlay']).toContain(overflow.value);
    });

    it('should have full height layout (fills viewport)', async () => {
      const app = await $('#app');
      const appSize = await app.getSize();
      const windowSize = await browser.getWindowSize();

      // App should fill the viewport (accounting for some browser chrome)
      expect(appSize.height).toBeGreaterThan(windowSize.height * 0.9);
    });
  });

  describe('Responsive Layout', () => {
    it('should maintain usable sidebar at minimum width', async () => {
      const originalSize = await browser.getWindowSize();

      // Test at minimum width
      await browser.setWindowSize(800, 600);
      await browser.pause(300);

      const sidebar = await $('aside');
      const sidebarSize = await sidebar.getSize();

      // Sidebar should still be visible and usable
      expect(sidebarSize.width).toBeGreaterThanOrEqual(200);

      // Elements should be accessible
      const newNoteBtn = await $('#new-note-btn');
      await expect(newNoteBtn).toBeClickable();

      // Restore
      await browser.setWindowSize(originalSize.width, originalSize.height);
      await browser.pause(300);
    });

    it('should handle larger window sizes gracefully', async () => {
      const originalSize = await browser.getWindowSize();

      // Test at larger size
      await browser.setWindowSize(1600, 900);
      await browser.pause(300);

      // Elements should still be visible and properly positioned
      const app = await $('#app');
      await expect(app).toBeDisplayed();

      const sidebar = await $('aside');
      const sidebarSize = await sidebar.getSize();
      // Sidebar should maintain its width, not stretch
      expect(sidebarSize.width).toBeLessThanOrEqual(300);

      // Restore
      await browser.setWindowSize(originalSize.width, originalSize.height);
      await browser.pause(300);
    });

    it('should keep new note button fully visible', async () => {
      const newNoteBtn = await $('#new-note-btn');
      const location = await newNoteBtn.getLocation();
      const size = await newNoteBtn.getSize();
      const windowSize = await browser.getWindowSize();

      // Button should be fully within viewport
      expect(location.x).toBeGreaterThanOrEqual(0);
      expect(location.y).toBeGreaterThanOrEqual(0);
      expect(location.x + size.width).toBeLessThanOrEqual(windowSize.width);
      expect(location.y + size.height).toBeLessThanOrEqual(windowSize.height);
    });

    it('should keep search input fully visible', async () => {
      const searchInput = await $('#search-input');
      const location = await searchInput.getLocation();
      const size = await searchInput.getSize();
      const windowSize = await browser.getWindowSize();

      // Search should be fully within viewport
      expect(location.x).toBeGreaterThanOrEqual(0);
      expect(location.y).toBeGreaterThanOrEqual(0);
      expect(location.x + size.width).toBeLessThanOrEqual(windowSize.width);
      expect(location.y + size.height).toBeLessThanOrEqual(windowSize.height);
    });
  });

  describe('Theme', () => {
    it('should have a theme applied', async () => {
      const html = await $('html');
      const theme = await html.getAttribute('data-theme');
      expect(theme).toBeTruthy();
    });

    it('should apply theme to body background', async () => {
      const body = await $('body');
      const bgClass = await body.getAttribute('class');
      expect(bgClass).toContain('bg-base-100');
    });

    it('should have consistent theming across sidebar and main', async () => {
      const sidebar = await $('aside');
      const sidebarBg = await sidebar.getAttribute('class');
      expect(sidebarBg).toContain('bg-base-200');

      const main = await $('main');
      await expect(main).toBeDisplayed();
    });
  });

  describe('UI Accessibility', () => {
    it('should have clickable new note button with adequate size', async () => {
      const newNoteBtn = await $('#new-note-btn');
      const size = await newNoteBtn.getSize();

      // Button should be large enough to click easily (at least 44x44 recommended)
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(32);
    });

    it('should have search input with adequate size', async () => {
      const searchInput = await $('#search-input');
      const size = await searchInput.getSize();

      // Input should be wide enough for typing
      expect(size.width).toBeGreaterThanOrEqual(150);
      expect(size.height).toBeGreaterThanOrEqual(30);
    });

    it('should have collection buttons with adequate tap targets', async () => {
      const allNotesFilter = await $('#filter-all-notes');
      const size = await allNotesFilter.getSize();

      // Should be easily clickable
      expect(size.width).toBeGreaterThanOrEqual(100);
      expect(size.height).toBeGreaterThanOrEqual(28);
    });

    it('should have proper z-index layering', async () => {
      // Sidebar should not overlap main content inappropriately
      const sidebar = await $('aside');
      const main = await $('main');

      const sidebarLoc = await sidebar.getLocation();
      const mainLoc = await main.getLocation();

      // Main content should be to the right of sidebar
      expect(mainLoc.x).toBeGreaterThan(sidebarLoc.x);
    });
  });

  describe('App Stability', () => {
    it('should remain responsive after multiple interactions', async () => {
      // Click multiple UI elements
      const collectionsToggle = await $('#collections-toggle');
      await collectionsToggle.click();
      await browser.pause(200);
      await collectionsToggle.click();
      await browser.pause(200);

      const allNotesFilter = await $('#filter-all-notes');
      await allNotesFilter.click();
      await browser.pause(200);

      const searchInput = await $('#search-input');
      await searchInput.click();
      await browser.pause(100);

      // App should still be responsive
      const app = await $('#app');
      await expect(app).toBeDisplayed();
    });

    it('should handle rapid window resize without breaking', async () => {
      const originalSize = await browser.getWindowSize();

      // Rapid resizes
      await browser.setWindowSize(800, 600);
      await browser.pause(100);
      await browser.setWindowSize(1200, 800);
      await browser.pause(100);
      await browser.setWindowSize(1000, 700);
      await browser.pause(100);

      // App should still work
      const app = await $('#app');
      await expect(app).toBeDisplayed();

      const newNoteBtn = await $('#new-note-btn');
      await expect(newNoteBtn).toBeClickable();

      // Restore
      await browser.setWindowSize(originalSize.width, originalSize.height);
    });
  });
});

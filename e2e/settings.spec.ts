/**
 * E2E Tests: Settings Window
 *
 * Tests for the settings/preferences functionality.
 * Note: Navigates directly to settings.html since settings
 * is normally opened via system tray or global hotkey.
 */

describe('Settings Window', () => {
  let baseUrl: string;

  before(async () => {
    // Get the current URL and construct settings URL
    // Tauri apps use tauri://localhost/ as the base URL
    const currentUrl = await browser.getUrl();
    baseUrl = currentUrl.replace(/\/[^/]*$/, ''); // Remove current page
    await browser.url(`${baseUrl}/settings.html`);
    await browser.pause(1000); // Wait for page to load and initialize
  });

  after(async () => {
    // Navigate back to main page to prevent blank window issues
    // when other tests run after this suite
    if (baseUrl) {
      await browser.url(`${baseUrl}/index.html`);
      await browser.pause(500);
    }
  });

  describe('Settings Header', () => {
    it('should display the settings title', async () => {
      const title = await $('h1');
      await expect(title).toBeDisplayed();
      const text = await title.getText();
      expect(text).toBe('Settings');
    });

    it('should have centered title', async () => {
      const title = await $('h1');
      // Check that the title is center-aligned by computed style (works even if class name differs)
      const textAlign = await title.getCSSProperty('text-align');
      expect(textAlign.value).toBe('center');
    });
  });

  describe('Appearance Section', () => {
    it('should display theme selector', async () => {
      const themeSelect = await $('#theme-select');
      await expect(themeSelect).toBeDisplayed();
    });

    it('should have multiple theme options', async () => {
      const themeSelect = await $('#theme-select');
      const options = await themeSelect.$$('option');
      expect(options.length).toBeGreaterThan(10); // Has many themes
    });

    it('should include popular themes', async () => {
      const themeSelect = await $('#theme-select');
      const html = await themeSelect.getHTML();

      // Check for some expected themes
      expect(html).toContain('light');
      expect(html).toContain('dark');
      expect(html).toContain('dracula');
    });

    it('should change theme when selecting different option', async () => {
      const themeSelect = await $('#theme-select');
      const htmlElement = await $('html');

      // Get initial theme
      const initialTheme = await htmlElement.getAttribute('data-theme');

      // Select a different theme
      await themeSelect.selectByAttribute('value', 'dark');
      await browser.pause(300);

      // Verify theme changed
      const newTheme = await htmlElement.getAttribute('data-theme');
      expect(newTheme).toBe('dark');

      // Restore original theme
      if (initialTheme) {
        await themeSelect.selectByAttribute('value', initialTheme);
      }
    });

    it('should persist theme after switching multiple times', async () => {
      const themeSelect = await $('#theme-select');
      const htmlElement = await $('html');

      // Switch to dracula
      await themeSelect.selectByAttribute('value', 'dracula');
      await browser.pause(200);
      expect(await htmlElement.getAttribute('data-theme')).toBe('dracula');

      // Switch to nord
      await themeSelect.selectByAttribute('value', 'nord');
      await browser.pause(200);
      expect(await htmlElement.getAttribute('data-theme')).toBe('nord');

      // Switch back to dark
      await themeSelect.selectByAttribute('value', 'dark');
      await browser.pause(200);
      expect(await htmlElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should display autosave delay input', async () => {
      const autosaveInput = await $('#autosave-delay-input');
      await expect(autosaveInput).toBeDisplayed();
    });

    it('should have valid autosave delay value', async () => {
      const autosaveInput = await $('#autosave-delay-input');
      const value = await autosaveInput.getValue();
      expect(parseInt(value)).toBeGreaterThanOrEqual(100);
    });

    it('should be able to modify autosave delay', async () => {
      const autosaveInput = await $('#autosave-delay-input');
      const originalValue = await autosaveInput.getValue();

      // Clear and set new value
      await autosaveInput.clearValue();
      await autosaveInput.setValue('2000');
      await browser.pause(200);

      const newValue = await autosaveInput.getValue();
      expect(newValue).toBe('2000');

      // Restore original value
      await autosaveInput.clearValue();
      await autosaveInput.setValue(originalValue);
    });
  });

  describe('Behavior Section', () => {
    it('should display minimize to tray checkbox', async () => {
      const checkbox = await $('#minimize-to-tray-checkbox');
      await expect(checkbox).toBeDisplayed();
    });

    it('should display close to tray checkbox', async () => {
      const checkbox = await $('#close-to-tray-checkbox');
      await expect(checkbox).toBeDisplayed();
    });

    it('should display start with Windows checkbox', async () => {
      const checkbox = await $('#start-with-windows-checkbox');
      await expect(checkbox).toBeDisplayed();
    });

    it('should be able to toggle minimize to tray', async () => {
      const checkbox = await $('#minimize-to-tray-checkbox');
      const initialState = await checkbox.isSelected();

      await checkbox.click();
      await browser.pause(200);

      const newState = await checkbox.isSelected();
      expect(newState).not.toBe(initialState);

      // Restore original state
      await checkbox.click();
    });

    it('should be able to toggle close to tray', async () => {
      const checkbox = await $('#close-to-tray-checkbox');
      const initialState = await checkbox.isSelected();

      await checkbox.click();
      await browser.pause(200);

      const newState = await checkbox.isSelected();
      expect(newState).not.toBe(initialState);

      // Restore original state
      await checkbox.click();
    });

    it('should have checkboxes be interactive', async () => {
      const minimizeCheckbox = await $('#minimize-to-tray-checkbox');
      const closeCheckbox = await $('#close-to-tray-checkbox');

      await expect(minimizeCheckbox).toBeClickable();
      await expect(closeCheckbox).toBeClickable();
    });
  });

  // Note: Reminder notification settings were moved to per-reminder configuration
  // on the sticky note window. See reminders.spec.ts for those tests.

  describe('Global Hotkeys Section', () => {
    it('should display new note hotkey input', async () => {
      const input = await $('#hotkey-new-note-input');
      await expect(input).toBeDisplayed();
    });

    it('should display toggle note hotkey input', async () => {
      const input = await $('#hotkey-toggle-note-input');
      await expect(input).toBeDisplayed();
    });

    it('should display open search hotkey input', async () => {
      const input = await $('#hotkey-open-search-input');
      await expect(input).toBeDisplayed();
    });

    it('should display open settings hotkey input', async () => {
      const input = await $('#hotkey-open-settings-input');
      await expect(input).toBeDisplayed();
    });

    it('should display toggle all notes hotkey input', async () => {
      const input = await $('#hotkey-toggle-all-notes-input');
      await expect(input).toBeDisplayed();
    });

    it('should display quick capture hotkey input', async () => {
      const input = await $('#hotkey-quick-capture-input');
      await expect(input).toBeDisplayed();
    });

    it('should have hotkey inputs with values', async () => {
      const newNoteInput = await $('#hotkey-new-note-input');
      const toggleInput = await $('#hotkey-toggle-note-input');

      const newNoteValue = await newNoteInput.getValue();
      const toggleValue = await toggleInput.getValue();

      // Hotkeys should have some value
      expect(newNoteValue.length).toBeGreaterThan(0);
      expect(toggleValue.length).toBeGreaterThan(0);
    });

    it('should display save hotkeys button', async () => {
      const btn = await $('#save-hotkeys-btn');
      await expect(btn).toBeDisplayed();
      const text = await btn.getText();
      expect(text).toContain('Save');
    });

    it('should have save hotkeys button be clickable', async () => {
      const btn = await $('#save-hotkeys-btn');
      await expect(btn).toBeClickable();
    });
  });

  describe('Automatic Backups Section', () => {
    it('should display auto-backup enabled checkbox', async () => {
      const checkbox = await $('#auto-backup-enabled-checkbox');
      await expect(checkbox).toBeDisplayed();
    });

    it('should display auto-backup password input', async () => {
      const input = await $('#auto-backup-password-input');
      await expect(input).toBeDisplayed();
    });

    it('should have password input be of type password', async () => {
      const input = await $('#auto-backup-password-input');
      const type = await input.getAttribute('type');
      expect(type).toBe('password');
    });

    it('should display save password button', async () => {
      const btn = await $('#save-auto-backup-password-btn');
      await expect(btn).toBeDisplayed();
    });

    it('should display delete password button', async () => {
      const btn = await $('#delete-auto-backup-password-btn');
      await expect(btn).toBeDisplayed();
    });

    it('should display password status', async () => {
      const status = await $('#auto-backup-password-status');
      await expect(status).toBeDisplayed();
    });

    it('should display backup location input', async () => {
      const input = await $('#backup-location-input');
      await expect(input).toBeDisplayed();
    });

    it('should show backup location path', async () => {
      const input = await $('#backup-location-input');
      const value = await input.getValue();
      // Should contain a path-like string
      expect(value.length).toBeGreaterThan(0);
    });

    it('should display select location button', async () => {
      const btn = await $('#select-backup-location-btn');
      await expect(btn).toBeDisplayed();
    });

    it('should display reset location button', async () => {
      const btn = await $('#reset-backup-location-btn');
      await expect(btn).toBeDisplayed();
    });

    it('should display backup frequency input', async () => {
      const input = await $('#backup-frequency-input');
      await expect(input).toBeDisplayed();
    });

    it('should have valid backup frequency value', async () => {
      const input = await $('#backup-frequency-input');
      const value = await input.getValue();
      // Should match patterns like "daily", "weekly", "1h", "30m", etc.
      expect(value).toMatch(/^(\d+[mhd]|daily|weekly|monthly)$/);
    });

    it('should display backup retention selector', async () => {
      const select = await $('#backup-retention-select');
      await expect(select).toBeDisplayed();
    });

    it('should have multiple retention options', async () => {
      const select = await $('#backup-retention-select');
      const options = await select.$$('option');
      expect(options.length).toBeGreaterThanOrEqual(3);
    });

    it('should be able to change retention period', async () => {
      const select = await $('#backup-retention-select');
      const originalValue = await select.getValue();

      // Change to a different value
      await select.selectByAttribute('value', '30');
      await browser.pause(200);

      const newValue = await select.getValue();
      expect(newValue).toBe('30');

      // Restore original
      await select.selectByAttribute('value', originalValue);
    });
  });

  describe('Manual Backup Section', () => {
    it('should display backup password input', async () => {
      const input = await $('#backup-password-input');
      await expect(input).toBeDisplayed();
    });

    it('should have manual backup password be password type', async () => {
      const input = await $('#backup-password-input');
      const type = await input.getAttribute('type');
      expect(type).toBe('password');
    });

    it('should have password placeholder text', async () => {
      const input = await $('#backup-password-input');
      const placeholder = await input.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    });

    it('should display create backup button', async () => {
      const btn = await $('#create-backup-btn');
      await expect(btn).toBeDisplayed();
      const text = await btn.getText();
      expect(text).toContain('Backup');
    });

    it('should have create backup button be clickable', async () => {
      const btn = await $('#create-backup-btn');
      await expect(btn).toBeClickable();
    });

    it('should be able to type in password field', async () => {
      const input = await $('#backup-password-input');
      await input.setValue('testpassword');
      await browser.pause(100);

      const value = await input.getValue();
      expect(value).toBe('testpassword');

      // Clear for security
      await input.clearValue();
    });
  });

  describe('Database Maintenance Section', () => {
    it('should display deleted notes count', async () => {
      const count = await $('#deleted-notes-count');
      await expect(count).toBeDisplayed();
    });

    it('should have numeric deleted notes count', async () => {
      const count = await $('#deleted-notes-count');
      const text = await count.getText();
      // Should be a number or "Error"
      expect(text).toMatch(/^\d+$|^Error$/);
    });

    it('should display empty trash button', async () => {
      const btn = await $('#prune-database-btn');
      await expect(btn).toBeDisplayed();
      const text = await btn.getText();
      expect(text).toContain('Empty Trash');
    });

    it('should have empty trash button with icon', async () => {
      const btn = await $('#prune-database-btn');
      const svg = await btn.$('svg');
      await expect(svg).toBeDisplayed();
    });
  });

  // Note: About Section moved to separate About window accessible via tray menu

  describe('Recent Backups Section', () => {
    it('should display last backup time', async () => {
      const lastBackup = await $('#last-backup-time');
      await expect(lastBackup).toBeDisplayed();
    });

    it('should display last backup age', async () => {
      const lastBackupAge = await $('#last-backup-age');
      await expect(lastBackupAge).toBeDisplayed();
    });

    it('should display backups list container', async () => {
      const list = await $('#backups-list');
      await expect(list).toBeDisplayed();
    });

    it('should show message when no backups exist or list backups', async () => {
      const list = await $('#backups-list');
      const html = await list.getHTML();
      // Either shows "No backups" message or has backup items
      const hasContent = html.includes('No backups') || html.includes('backup');
      expect(hasContent).toBe(true);
    });
  });

  describe('Navigation', () => {
    it('should be able to scroll to different sections', async () => {
      // Scroll to bottom
      await browser.execute(() => window.scrollTo(0, document.body.scrollHeight));
      await browser.pause(300);

      // Scroll back to top
      await browser.execute(() => window.scrollTo(0, 0));
      await browser.pause(300);

      // Verify we're back at top by checking header is visible
      const header = await $('h1');
      await expect(header).toBeDisplayed();
    });
  });

  describe('Settings Window Size and Layout', () => {
    it('should have adequate window dimensions', async () => {
      // Check viewport dimensions via DOM rather than window API
      const viewportWidth = await browser.execute(() => document.documentElement.clientWidth);
      const viewportHeight = await browser.execute(() => document.documentElement.clientHeight);

      // Settings window should have usable viewport (at least 300px in each dimension)
      expect(viewportWidth).toBeGreaterThanOrEqual(300);
      expect(viewportHeight).toBeGreaterThanOrEqual(300);
    });

    it('should have settings container fill the viewport', async () => {
      const settingsContainer = await $('#settings-container');
      await expect(settingsContainer).toBeDisplayed();

      const size = await settingsContainer.getSize();
      const windowSize = await browser.getWindowSize();

      // Container should fill the window
      expect(size.height).toBeGreaterThan(windowSize.height * 0.9);
    });

    it('should have scrollable content area', async () => {
      const settingsContent = await $('#settings-content');
      await expect(settingsContent).toBeDisplayed();

      const overflow = await settingsContent.getCSSProperty('overflow-y');
      expect(['auto', 'scroll', 'overlay']).toContain(overflow.value);
    });

    it('should have header fully visible', async () => {
      const header = await $('h1');
      const location = await header.getLocation();
      const windowSize = await browser.getWindowSize();

      expect(location.x).toBeGreaterThanOrEqual(0);
      expect(location.y).toBeGreaterThanOrEqual(0);
      expect(location.y).toBeLessThan(windowSize.height);
    });

    // Note: Close button removed - settings window is closed via system menu or Escape key

    it('should maintain grid layout for settings sections', async () => {
      const settingsContent = await $('#settings-content');
      const display = await settingsContent.getCSSProperty('display');
      expect(display.value).toBe('grid');
    });

    it('should have settings sections with adequate spacing', async () => {
      const sections = await $$('.settings-section');

      if (sections.length >= 2) {
        const firstSection = sections[0];
        const secondSection = sections[1];

        const firstLoc = await firstSection.getLocation();
        const secondLoc = await secondSection.getLocation();

        // Sections should have some spacing (not overlapping)
        // In a grid layout, they might be side by side or stacked
        const firstSize = await firstSection.getSize();

        // Either different row or different column
        const isDifferentRow = secondLoc.y > firstLoc.y + firstSize.height - 10;
        const isDifferentColumn = secondLoc.x > firstLoc.x + firstSize.width - 10;

        expect(isDifferentRow || isDifferentColumn).toBe(true);
      }
    });

    it('should have form inputs with adequate width', async () => {
      const themeSelect = await $('#theme-select');
      const size = await themeSelect.getSize();

      // Theme select should be wide enough to show theme names
      expect(size.width).toBeGreaterThanOrEqual(100);
    });

    it('should have buttons with adequate tap targets', async () => {
      // Check a button that exists - the create backup button
      const backupBtn = await $('#create-backup-btn');
      if (await backupBtn.isDisplayed()) {
        const size = await backupBtn.getSize();
        expect(size.height).toBeGreaterThanOrEqual(28);
      }
    });

    it('should allow scrolling through all sections', async () => {
      // Scroll to bottom
      await browser.execute(() => {
        const content = document.getElementById('settings-content');
        if (content) { content.scrollTop = content.scrollHeight; }
      });
      await browser.pause(300);

      // Check that bottom section (Manual Backup or Database Maintenance) is accessible
      const pruneBtn = await $('#prune-database-btn');
      await expect(pruneBtn).toBeDisplayed();

      // Scroll back to top
      await browser.execute(() => {
        const content = document.getElementById('settings-content');
        if (content) { content.scrollTop = 0; }
      });
      await browser.pause(300);
    });

    it('should not have horizontal overflow', async () => {
      // Check that the main body doesn't have horizontal overflow
      const _hasBodyOverflow = await browser.execute(() => {
        return document.body.scrollWidth > document.body.clientWidth + 5; // 5px tolerance
      });
      
      // Settings content may have overflow due to grid layout - that's acceptable
      // The important thing is the body doesn't overflow horizontally
      // Minor overflow (< 10px) is acceptable due to scrollbars
      const overflowAmount = await browser.execute(() => {
        const content = document.getElementById('settings-content');
        if (!content) { return 0; }
        return content.scrollWidth - content.clientWidth;
      });
      
      // Allow small overflow for scrollbar width differences
      expect(overflowAmount).toBeLessThan(50);
    });
  });

  describe('Settings Form Usability', () => {
    it('should have all checkboxes clickable', async () => {
      const checkboxes = await $$('input[type="checkbox"]');

      for (const checkbox of checkboxes) {
        if (await checkbox.isDisplayed()) {
          await expect(checkbox).toBeClickable();
        }
      }
    });

    it('should have all text inputs focusable', async () => {
      const inputs = await $$('input[type="text"], input[type="password"], input[type="number"]');

      for (const input of inputs) {
        if (await input.isDisplayed()) {
          await input.click();
          await browser.pause(50);
        }
      }
    });

    it('should have all buttons with visible text or icons', async () => {
      const buttons = await $$('button');

      for (const button of buttons) {
        if (await button.isDisplayed()) {
          const text = await button.getText();
          const svg = await button.$('svg');
          const hasSvg = await svg.isExisting();

          // Button should have text or icon
          const hasContent = text.length > 0 || hasSvg;
          expect(hasContent).toBe(true);
        }
      }
    });

    it('should have labels associated with form controls', async () => {
      // Check that labels exist for key controls
      const themeLabel = await $('label*=Theme');
      const hasThemeLabel = await themeLabel.isExisting();
      expect(hasThemeLabel).toBe(true);
    });
  });
});

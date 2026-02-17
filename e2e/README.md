# SwatNotes E2E Tests

End-to-end tests using Tauri WebDriver and WebdriverIO v7.

## Prerequisites

### 1. Install tauri-driver

```bash
cargo install tauri-driver
```

### 2. Install Microsoft Edge WebDriver

1. Check your Edge version: Open Edge → Settings → About Microsoft Edge
2. Download matching driver from: https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/
3. Extract `msedgedriver.exe`
4. **Add to PATH** (important!):
   - Move `msedgedriver.exe` to a folder in your PATH, or
   - Add its folder to your PATH environment variable

To verify it's in PATH:
```powershell
where msedgedriver
```

### 3. Build the Tauri Application

```powershell
npm run tauri build
```

This creates `src-tauri/target/release/SwatNotes.exe`

### 4. Install npm dependencies

```powershell
npm install
```

## Running Tests

```powershell
npm run test:e2e
```

This will:
1. Start `tauri-driver` automatically
2. Launch your SwatNotes app
3. Run all E2E tests
4. Close everything when done

## Test Files

| File | Description |
|------|-------------|
| `app.spec.ts` | Application launch, UI elements, theme, window size validation |
| `notes.spec.ts` | Note creation, editing, search, real-world usage scenarios |
| `collections.spec.ts` | Collections panel, filters, add collection, counts |
| `reminders.spec.ts` | Reminder creation, form validation, reminder list display |
| `settings.spec.ts` | Settings sections, form controls, backup settings |
| `windows.spec.ts` | Window sizes, viewport tests, responsive layout, touch targets |

## Test Coverage

### Window Size Tests
- Minimum window dimensions (800x600)
- Recommended window size (1000x1028)
- Viewport filling behavior
- Responsive layout at different sizes
- Element visibility at boundaries
- Touch target sizes (accessibility)
- Resize behavior and stability

### UI Element Tests
- All interactive elements are displayed
- Buttons are clickable with adequate tap targets
- Inputs are focusable and accept text
- Scroll behavior works correctly
- No horizontal overflow

### Real-World Usage Tests
- Creating and viewing notes in sequence
- Search and clear workflow
- Rapid note creation
- Switching between collections
- Theme switching

## Writing Tests

Tests use WebdriverIO's API:

```typescript
describe('Feature', () => {
  it('should do something', async () => {
    // Find elements
    const button = await $('#button-id');
    const text = await $('*=Some text');

    // Assertions
    await expect(button).toBeDisplayed();
    await expect(button).toBeClickable();

    // Interactions
    await button.click();
    await $('input').setValue('text');

    // Window size tests
    const windowSize = await browser.getWindowSize();
    expect(windowSize.width).toBeGreaterThanOrEqual(800);

    // Resize window
    await browser.setWindowSize(1200, 800);

    // Wait
    await browser.pause(1000);
  });
});
```

## Troubleshooting

### "can not find binary msedgedriver.exe in the PATH"

Add msedgedriver.exe to your system PATH:

1. Find where you extracted msedgedriver.exe
2. Open System Properties → Environment Variables
3. Edit "Path" under User or System variables
4. Add the folder containing msedgedriver.exe
5. Restart your terminal

### "tauri-driver not found"

Install it: `cargo install tauri-driver`

### Tests timing out

Increase the timeout in `wdio.conf.cjs`:
```javascript
mochaOpts: {
  timeout: 120000,
}
```

### Window size tests failing

Some systems may have different DPI scaling. The tests account for this by using minimum thresholds rather than exact values.

### "Application not found"

Build the app first: `npm run tauri build`

### Version mismatch errors

Make sure your Edge browser version matches your msedgedriver version.

### "no msedge binary at SwatNotes.exe"

This error occurs when msedgedriver doesn't recognize the Tauri app as a WebView2 application.
The configuration includes `useWebView: true` to tell msedgedriver this is a WebView2 app.

If this error persists:
1. Try an older version of msedgedriver (e.g., version 120 or earlier)
2. Ensure WebView2 Runtime is installed on your system
3. Verify Edge and msedgedriver versions match

### Alternative: Direct msedgedriver connection

If tauri-driver issues persist, you can bypass it and connect directly to msedgedriver:

1. Start msedgedriver manually: `msedgedriver --port=4444`
2. Modify `wdio.conf.cjs` to remove the `onPrepare`/`onComplete` hooks
3. Change `browserName` from `'wry'` to `'MicrosoftEdge'`
4. Keep only the `ms:edgeOptions` capability

## References

- [Tauri WebDriver Docs](https://v2.tauri.app/develop/tests/webdriver/)
- [WebdriverIO Docs](https://webdriver.io/)

# Icons

This directory should contain the following icon files for the QuickNotes application:

## Required Icons

- `icon.png` - System tray icon (recommended: 32x32 or 64x64 px)
- `32x32.png` - App icon 32x32
- `128x128.png` - App icon 128x128
- `128x128@2x.png` - App icon 128x128 @ 2x (256x256)
- `icon.icns` - macOS app icon
- `icon.ico` - Windows app icon

## Icon Design Guidelines

- Keep the design simple and recognizable at small sizes
- Use a transparent background for PNG files
- The icon should represent note-taking (e.g., notepad, document, pen)
- Ensure good contrast for visibility in both light and dark themes

## Generating Icons

You can use tools like:
- [Tauri Icon](https://tauri.app/v1/guides/features/icons) - Official Tauri icon generator
- [ImageMagick](https://imagemagick.org/) - Convert between formats
- Design tools like Figma, Sketch, or Inkscape

## Temporary Solution

For development, you can create a simple colored square as a placeholder:

```bash
# Using ImageMagick
convert -size 512x512 xc:blue -fill white -pointsize 200 -gravity center -annotate +0+0 "QN" icon.png
```

Then use Tauri's icon generator to create all required formats:

```bash
npm install -g @tauri-apps/cli
tauri icon icon.png
```

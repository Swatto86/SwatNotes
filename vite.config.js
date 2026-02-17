import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'pages/index.html'),
        'sticky-note': resolve(__dirname, 'pages/sticky-note.html'),
        settings: resolve(__dirname, 'pages/settings.html'),
        about: resolve(__dirname, 'pages/about.html'),
        'update-required': resolve(__dirname, 'pages/update-required.html'),
      },
    },
  },
});

import { defineConfig } from 'vite';

// Minimal config: project root is the folder containing index.html.
// Relative paths keep the built site portable (works from any subpath).
export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths so the built game runs from any folder or static host
  base: './',
  build: {
    chunkSizeWarningLimit: 1400,
  },
});

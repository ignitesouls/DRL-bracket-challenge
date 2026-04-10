import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // base path for GitHub Pages — must match the repo name
  base: '/DRL-bracket-challenge/',
  build: {
    outDir: 'dist',
    // Sourcemaps off for prod so we don't ship the full TypeScript source
    // to GitHub Pages. Flip back to true temporarily to debug a prod crash.
    sourcemap: false,
  },
});

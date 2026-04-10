import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // base path for GitHub Pages — must match the repo name
  base: '/DRL-bracket-challenge/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

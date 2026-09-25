import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173 },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 800 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    css: false,
    testTimeout: 20000,
  },
});

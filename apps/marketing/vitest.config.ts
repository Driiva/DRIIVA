import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Vitest 2.x bundles its own copy of vite which can drift from the project's vite
// types, causing a benign type-only mismatch on the plugins array. The cast keeps
// runtime behaviour identical while satisfying tsc.
const reactPlugin = react() as unknown as never;

export default defineConfig({
  plugins: [reactPlugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});

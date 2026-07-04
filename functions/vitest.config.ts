import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  css: { postcss: {} },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/types.ts'],
    },
    setupFiles: ['src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      // Mirrors the root vitest.config.ts alias so `cd functions && npm test`
      // (this package's own canonical test command, gated by CI) resolves
      // the same as the root `npx vitest run`.
      '@driiva/contracts': path.resolve(__dirname, '..', 'packages', 'contracts', 'src'),
    },
  },
});

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./client/src/__tests__/setup.ts'],
    include: [
      'client/src/**/*.test.{ts,tsx}',
      'functions/src/**/*.test.ts',
      'server/**/*.test.ts',
      'shared/**/*.test.ts',
      'packages/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'functions/src/__tests__/triggers/damoovRegistration.test.ts',
      // Rules-emulator suite needs the Firestore emulator running — run it via
      // `npm run test:rules`, not the default suite. See vitest.rules.config.ts.
      'tests/rules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: [
        'client/src/lib/**',
        'functions/src/utils/**',
        'shared/**',
      ],
      thresholds: {
        lines: 4,
        functions: 2,
        branches: 7,
        statements: 4,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@driiva/contracts': path.resolve(__dirname, 'packages', 'contracts', 'src'),
      '@driiva/scoring': path.resolve(__dirname, 'packages', 'scoring', 'src'),
    },
  },
});

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    /*
     * 5s is vitest's default and it is too tight for this suite. The heaviest
     * client tests render a whole page into jsdom, drive it through
     * testing-library and wait on async auth mocks; in isolation each takes
     * around a second, but 50-odd test files run in parallel on a machine that
     * is also running a dev server and emulators, and they tip over the limit.
     *
     * The symptom was three to five failures per run, a DIFFERENT three to
     * five each time, all of which passed on their own. That reads as a
     * regression every time somebody sees it, so it costs more attention than
     * the tests are worth. Nothing here indicates a product defect.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,
    setupFiles: ['./client/src/__tests__/setup.ts'],
    include: [
      'client/src/**/*.test.{ts,tsx}',
      'functions/src/**/*.test.ts',
      'server/**/*.test.ts',
      'shared/**/*.test.ts',
      'packages/**/*.test.{ts,tsx}',
      // Cross-context unit tests that cannot live beside their subject. See
      // tests/unit/mobile-waitlist.test.ts for why.
      'tests/unit/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'functions/src/__tests__/triggers/damoovRegistration.test.ts',
      // Rules-emulator suite needs the Firestore emulator running; run it via
      // `npm run test:rules`, not the default suite. See vitest.rules.config.ts.
      'tests/rules/**',
      // Auth+Firestore integration suite needs live emulators; run it via
      // `npm run test:integration`, not the default suite. See
      // vitest.integration.config.ts.
      'tests/integration/**',
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

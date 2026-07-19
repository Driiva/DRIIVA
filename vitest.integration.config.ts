import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Config for the Auth+Firestore integration suite (tests/integration/**).
 * Kept separate from vitest.config.ts (like vitest.rules.config.ts) because
 * this suite needs a plain 'node' environment and live auth/firestore
 * emulators; it must never run inside the default `npx vitest run`.
 *
 * Run via `npm run test:integration`, which boots the emulators first.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // Real emulator round-trips (user creation, Firestore writes, a
    // transaction inside provisionUser) are slower than the mocked default
    // suite's unit tests.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@driiva/contracts': path.resolve(__dirname, 'packages', 'contracts', 'src'),
      // Force every import of firebase-admin in this suite - including the
      // one inside functions/src/triggers/provisionUserOnSignup.ts, which
      // tests/integration/identity.test.ts imports directly - to resolve to
      // the SAME physical module the Cloud Functions codebase uses. See the
      // module-instance note in tests/integration/helpers.ts.
      'firebase-admin': path.resolve(__dirname, 'functions', 'node_modules', 'firebase-admin'),
    },
  },
});

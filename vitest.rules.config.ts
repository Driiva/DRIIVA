import { defineConfig } from 'vitest/config';

/**
 * Config for the Firestore rules-emulator suite (tests/rules/**). Kept
 * separate from vitest.config.ts because this suite needs a plain 'node'
 * environment (no jsdom, no client setupFiles) and a live Firestore
 * emulator — it must never run inside the default `npx vitest run`.
 *
 * Run via `npm run test:rules`, which boots the emulator first.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
  },
});

/**
 * Proves the two rules fixes for this task (see firestore.rules):
 *
 * 1. Merge conflict at the `leaderboard` block resolved: the emulator
 *    loading the file at all is the proof (a file with `<<<<<<<` markers
 *    fails `initializeTestEnvironment`), plus the read behaviour below.
 * 2. New top-level `achievements/{achId}` catalogue rule (audit quirk 6.9 /
 *    DATA-22); previously missing, so every read fell through to the
 *    catch-all deny.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createTestEnv } from './helpers';

describe('firestore.rules: achievements + leaderboard', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv('driiva-rules-achievements');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('achievements/first-trip').set({ name: 'First Trip', points: 10 });
      await db.doc('leaderboard/weekly').set({ userId: 'alice', displayName: 'Alice', score: 90 });
    });
  });

  describe('achievements/{achId}: badge-definition catalogue (fix 2)', () => {
    it('allows an authenticated user to read', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertSucceeds(alice.firestore().doc('achievements/first-trip').get());
    });

    it('denies an unauthenticated read', async () => {
      const anon = testEnv.unauthenticatedContext();
      await assertFails(anon.firestore().doc('achievements/first-trip').get());
    });

    it('denies any client write, even from an authenticated user', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(
        alice.firestore().doc('achievements/first-trip').set({ name: 'Tampered', points: 999 }),
      );
    });

    it('denies an authenticated user creating a new achievement definition', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(alice.firestore().doc('achievements/new-badge').set({ name: 'New Badge' }));
    });
  });

  describe('leaderboard/{leaderboardId} (fix 1: conflict resolved)', () => {
    it('allows an authenticated user to read', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertSucceeds(alice.firestore().doc('leaderboard/weekly').get());
    });

    it('denies an unauthenticated read', async () => {
      const anon = testEnv.unauthenticatedContext();
      await assertFails(anon.firestore().doc('leaderboard/weekly').get());
    });

    it('denies any client write (Cloud Functions only)', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(alice.firestore().doc('leaderboard/weekly').set({ score: 100 }));
    });
  });
});

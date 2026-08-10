/**
 * Rules for the `feedback` collection, tightened in Wave D.
 *
 * Create used to be `isAuthenticated()` and nothing else, so anyone signed in
 * could file feedback under another user's uid, with a rating off the scale
 * and a message of unbounded length. The collection exists to be evidence of
 * what users think; unvalidated, it is evidence of nothing.
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

import { createTestEnv } from './helpers';

const ALICE = 'alice-uid';
const MALLORY = 'mallory-uid';

let env: RulesTestEnvironment;

const valid = {
  uid: ALICE,
  rating: 4,
  message: 'The score breakdown is clear.',
  appVersion: '1.0.0',
  platform: 'web',
  screenContext: 'settings',
};

beforeAll(async () => { env = await createTestEnv('driiva-rules-feedback'); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('feedback', () => {
  it('accepts well-formed feedback from the user filing it', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'feedback', 'f1'), { ...valid, timestamp: serverTimestamp() }),
    );
  });

  it('refuses feedback filed under somebody else’s uid', async () => {
    const mallory = env.authenticatedContext(MALLORY).firestore();
    await assertFails(
      setDoc(doc(mallory, 'feedback', 'f2'), { ...valid, timestamp: serverTimestamp() }),
    );
  });

  it('refuses an anonymous filing', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anon, 'feedback', 'f3'), { ...valid, uid: ALICE }));
  });

  it('refuses a rating off the 1 to 5 scale', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    for (const rating of [0, 6, -1, 100]) {
      await assertFails(setDoc(doc(alice, 'feedback', `r${rating}`), { ...valid, rating }));
    }
  });

  it('refuses a non-integer rating', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(alice, 'feedback', 'f4'), { ...valid, rating: 4.5 }));
    await assertFails(setDoc(doc(alice, 'feedback', 'f5'), { ...valid, rating: 'five' }));
  });

  it('refuses an unbounded message', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(alice, 'feedback', 'f6'), { ...valid, message: 'x'.repeat(2001) }),
    );
  });

  it('accepts a message right up to the limit', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'feedback', 'f7'), { ...valid, message: 'x'.repeat(2000) }),
    );
  });

  it('refuses an unknown platform', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(alice, 'feedback', 'f8'), { ...valid, platform: 'smartfridge' }));
  });

  // Write-only: a user files feedback and cannot then read, edit or withdraw
  // it, and certainly cannot read anybody else's.
  it('is not readable, even by its author', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'feedback', 'f9'), valid);
    });
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(getDoc(doc(alice, 'feedback', 'f9')));
  });
});

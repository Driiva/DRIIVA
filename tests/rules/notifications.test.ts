/**
 * Rules for users/{uid}/notifications, new in Wave D.
 *
 * These records are written by Cloud Functions when something actually
 * happens. The danger the rules guard against is a client creating one: a
 * fabricated "your refund has landed" notification would be indistinguishable
 * from a real one, so create is denied outright and the only field a client
 * may move is `read`.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

import { createTestEnv } from './helpers';

const ALICE = 'alice-uid';
const MALLORY = 'mallory-uid';
const NOTE = 'note-1';

let env: RulesTestEnvironment;

async function seedNote() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ALICE, 'notifications', NOTE), {
      title: 'Trip scored',
      body: 'Your trip scored 88 out of 100.',
      type: 'trip_complete',
      data: { type: 'trip_complete', tripId: 'trip-1' },
      read: false,
      createdAt: new Date(),
    });
  });
}

beforeAll(async () => { env = await createTestEnv('driiva-rules-notifications'); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('notifications', () => {
  it('lets the owner read their own', async () => {
    await seedNote();
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(alice, 'users', ALICE, 'notifications', NOTE)));
  });

  it('refuses another user, and an anonymous reader', async () => {
    await seedNote();
    await assertFails(getDoc(doc(env.authenticatedContext(MALLORY).firestore(), 'users', ALICE, 'notifications', NOTE)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', ALICE, 'notifications', NOTE)));
  });

  // The important one: a fabricated notification would be indistinguishable
  // from a real one to the person reading it.
  it('refuses a client creating a notification for itself', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(alice, 'users', ALICE, 'notifications', 'forged'), {
        title: 'Your refund has landed',
        body: 'GBP 240 is on its way to you.',
        type: 'refund',
        read: false,
        createdAt: new Date(),
      }),
    );
  });

  it('lets the owner mark one read', async () => {
    await seedNote();
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(alice, 'users', ALICE, 'notifications', NOTE), { read: true }));
  });

  it('refuses an update that edits anything except read', async () => {
    await seedNote();
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      updateDoc(doc(alice, 'users', ALICE, 'notifications', NOTE), { read: true, title: 'Rewritten' }),
    );
    await assertFails(updateDoc(doc(alice, 'users', ALICE, 'notifications', NOTE), { body: 'Rewritten' }));
  });

  it('refuses a non-boolean read flag', async () => {
    await seedNote();
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(alice, 'users', ALICE, 'notifications', NOTE), { read: 'yes' }));
  });

  it('refuses deletion, so history cannot be quietly erased', async () => {
    await seedNote();
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(deleteDoc(doc(alice, 'users', ALICE, 'notifications', NOTE)));
  });
});

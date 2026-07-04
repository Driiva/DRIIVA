/**
 * Characterises /usernames/{username}: public read (sign-in lookup), owner
 * create/update, delete always denied.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { createTestEnv } from './helpers';

const ALICE = 'alice';
const BOB = 'bob';

describe('firestore.rules: usernames', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv('driiva-rules-usernames');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('allows an unauthenticated read (public sign-in lookup)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'usernames/johndoe'), { uid: ALICE });
    });
    const anon = testEnv.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(anon.firestore(), 'usernames/johndoe')));
  });

  it('allows the owner to create their own username doc', async () => {
    const alice = testEnv.authenticatedContext(ALICE);
    await assertSucceeds(setDoc(doc(alice.firestore(), 'usernames/johndoe'), { uid: ALICE }));
  });

  it("denies creating a username doc pointing at someone else's uid", async () => {
    const alice = testEnv.authenticatedContext(ALICE);
    await assertFails(setDoc(doc(alice.firestore(), 'usernames/johndoe'), { uid: BOB }));
  });

  it('allows the owner to update their own username doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'usernames/johndoe'), { uid: ALICE });
    });
    const alice = testEnv.authenticatedContext(ALICE);
    await assertSucceeds(updateDoc(doc(alice.firestore(), 'usernames/johndoe'), { uid: ALICE, updatedAt: 1 }));
  });

  it("denies a non-owner updating another user's username doc", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'usernames/johndoe'), { uid: ALICE });
    });
    const bob = testEnv.authenticatedContext(BOB);
    await assertFails(updateDoc(doc(bob.firestore(), 'usernames/johndoe'), { uid: BOB }));
  });

  it('denies delete outright', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'usernames/johndoe'), { uid: ALICE });
    });
    const alice = testEnv.authenticatedContext(ALICE);
    await assertFails(deleteDoc(doc(alice.firestore(), 'usernames/johndoe')));
  });
});

/**
 * Characterises /users/{userId}: ownership on read, the create-time identity
 * checks, and the immutable-field lock on update. Also covers the
 * pendingPayments subcollection (owner read, client write denied).
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { createTestEnv } from './helpers';

const ALICE = 'alice';
const ALICE_EMAIL = 'alice@example.com';
const BOB = 'bob';

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    uid: ALICE,
    email: ALICE_EMAIL,
    createdAt: 1000,
    createdBy: ALICE,
    drivingProfile: { style: 'calm' },
    poolShare: 0,
    recentTrips: [],
    activePolicy: 'policy-1',
    ...overrides,
  };
}

describe('firestore.rules: users', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv('driiva-rules-users');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('create', () => {
    it('allows a user to create their own doc with a matching uid + token email', async () => {
      const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
      await assertSucceeds(setDoc(doc(alice.firestore(), `users/${ALICE}`), baseUser()));
    });

    it('denies create when the email does not match the auth token email', async () => {
      const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
      await assertFails(
        setDoc(doc(alice.firestore(), `users/${ALICE}`), baseUser({ email: 'someone-else@example.com' })),
      );
    });

    it('denies create when the uid field does not match the document id', async () => {
      const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
      await assertFails(setDoc(doc(alice.firestore(), `users/${ALICE}`), baseUser({ uid: BOB })));
    });

    it('denies a user creating a doc at another uid path', async () => {
      const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
      await assertFails(
        setDoc(doc(alice.firestore(), `users/${BOB}`), baseUser({ uid: BOB, email: ALICE_EMAIL })),
      );
    });
  });

  describe('read', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), `users/${ALICE}`), baseUser());
      });
    });

    it('allows the owner to read their own doc', async () => {
      const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
      await assertSucceeds(getDoc(doc(alice.firestore(), `users/${ALICE}`)));
    });

    it('denies a non-owner reading the doc', async () => {
      const bob = testEnv.authenticatedContext(BOB);
      await assertFails(getDoc(doc(bob.firestore(), `users/${ALICE}`)));
    });
  });

  describe('update: immutable-field lock', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), `users/${ALICE}`), baseUser());
      });
    });

    it('allows updating a field that is not locked', async () => {
      const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
      await assertSucceeds(updateDoc(doc(alice.firestore(), `users/${ALICE}`), { displayName: 'Alice A' }));
    });

    const LOCKED_FIELDS: Record<string, unknown> = {
      uid: BOB,
      createdAt: 2000,
      createdBy: BOB,
      drivingProfile: { style: 'aggressive' },
      poolShare: 0.5,
      recentTrips: ['trip-1'],
      activePolicy: 'policy-2',
    };

    it.each(Object.entries(LOCKED_FIELDS))('denies updating the locked field "%s"', async (field, value) => {
      const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
      await assertFails(updateDoc(doc(alice.firestore(), `users/${ALICE}`), { [field]: value }));
    });

    it('denies a non-owner updating the doc', async () => {
      const bob = testEnv.authenticatedContext(BOB);
      await assertFails(updateDoc(doc(bob.firestore(), `users/${ALICE}`), { displayName: 'Hijacked' }));
    });
  });

  it('denies delete', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${ALICE}`), baseUser());
    });
    const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
    await assertFails(deleteDoc(doc(alice.firestore(), `users/${ALICE}`)));
  });

  describe('pendingPayments subcollection', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), `users/${ALICE}/pendingPayments/p1`), { amount: 500 });
      });
    });

    it('allows the owner to read their pending payment', async () => {
      const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
      await assertSucceeds(getDoc(doc(alice.firestore(), `users/${ALICE}/pendingPayments/p1`)));
    });

    it('denies a non-owner reading the pending payment', async () => {
      const bob = testEnv.authenticatedContext(BOB);
      await assertFails(getDoc(doc(bob.firestore(), `users/${ALICE}/pendingPayments/p1`)));
    });

    it('denies any client write, even by the owner', async () => {
      const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
      await assertFails(
        setDoc(doc(alice.firestore(), `users/${ALICE}/pendingPayments/p2`), { amount: 999 }),
      );
    });
  });
});

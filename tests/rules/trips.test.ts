/**
 * Characterises the /trips/{tripId} status-transition lock (rebuild plan
 * calls this out explicitly as a must-cover behaviour). Not a fix: this
 * pins the rule as it stands today.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { createTestEnv } from './helpers';

const ALICE = 'alice';
const BOB = 'bob';

function baseTrip(overrides: Record<string, unknown> = {}) {
  return {
    userId: ALICE,
    createdBy: ALICE,
    createdAt: Date.now(),
    status: 'recording',
    score: 0,
    scoreBreakdown: {},
    events: [],
    anomalies: [],
    context: {},
    ...overrides,
  };
}

describe('firestore.rules: trips status-transition lock', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv('driiva-rules-trips');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('create', () => {
    it('allows the owner to create a trip with status recording', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(setDoc(doc(alice.firestore(), 'trips/t1'), baseTrip({ status: 'recording' })));
    });

    it('allows the owner to create a trip with status processing', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(setDoc(doc(alice.firestore(), 'trips/t2'), baseTrip({ status: 'processing' })));
    });

    it('denies creating a trip with an invalid initial status', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(setDoc(doc(alice.firestore(), 'trips/t3'), baseTrip({ status: 'completed' })));
    });

    it("denies creating a trip for someone else's userId", async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(
        setDoc(doc(alice.firestore(), 'trips/t4'), baseTrip({ userId: BOB, createdBy: ALICE })),
      );
    });

    it('denies an unauthenticated create', async () => {
      const anon = testEnv.unauthenticatedContext();
      await assertFails(setDoc(doc(anon.firestore(), 'trips/t5'), baseTrip()));
    });
  });

  describe('update: status transitions', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'trips/t1'), baseTrip({ status: 'recording' }));
      });
    });

    it('allows recording -> processing', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(updateDoc(doc(alice.firestore(), 'trips/t1'), { status: 'processing' }));
    });

    it('allows recording -> failed', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(updateDoc(doc(alice.firestore(), 'trips/t1'), { status: 'failed' }));
    });

    it('denies a direct client transition to completed', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(updateDoc(doc(alice.firestore(), 'trips/t1'), { status: 'completed' }));
    });

    const LOCKED_FIELDS: Record<string, unknown> = {
      score: 999,
      scoreBreakdown: { hardBraking: 1 },
      events: [{ type: 'hardBraking' }],
      anomalies: [{ type: 'suspicious' }],
      context: { tampered: true },
      userId: BOB,
      createdBy: BOB,
      createdAt: 0,
    };

    it.each(Object.entries(LOCKED_FIELDS))(
      'denies mutating the locked field "%s" even alongside a valid transition',
      async (field, value) => {
        const alice = testEnv.authenticatedContext(ALICE);
        await assertFails(
          updateDoc(doc(alice.firestore(), 'trips/t1'), { status: 'processing', [field]: value }),
        );
      },
    );

    it('denies a non-owner updating the trip', async () => {
      const bob = testEnv.authenticatedContext(BOB);
      await assertFails(updateDoc(doc(bob.firestore(), 'trips/t1'), { status: 'processing' }));
    });
  });

  describe('read + delete', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'trips/t1'), baseTrip({ status: 'recording' }));
      });
    });

    it('allows the owner to read their trip', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(getDoc(doc(alice.firestore(), 'trips/t1')));
    });

    it('denies a non-owner reading the trip', async () => {
      const bob = testEnv.authenticatedContext(BOB);
      await assertFails(getDoc(doc(bob.firestore(), 'trips/t1')));
    });

    it('denies delete, even by the owner', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(deleteDoc(doc(alice.firestore(), 'trips/t1')));
    });
  });
});

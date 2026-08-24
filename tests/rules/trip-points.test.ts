/**
 * Characterises /tripPoints/{tripId} and its /batches subcollection:
 * owner create allowed, but update and delete are DENIED outright (points
 * are append-only/immutable once written).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { createTestEnv } from './helpers';

const ALICE = 'alice';
const BOB = 'bob';

describe('firestore.rules: tripPoints + batches', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv('driiva-rules-trip-points');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('tripPoints/{tripId}', () => {
    it('allows the owner to create', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(setDoc(doc(alice.firestore(), 'tripPoints/t1'), { userId: ALICE, points: [] }));
    });

    it("denies creating with someone else's userId", async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(setDoc(doc(alice.firestore(), 'tripPoints/t1'), { userId: BOB, points: [] }));
    });

    describe('once a tripPoints doc exists', () => {
      beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          await setDoc(doc(context.firestore(), 'tripPoints/t1'), { userId: ALICE, points: [1, 2, 3] });
        });
      });

      it('allows the owner to read', async () => {
        const alice = testEnv.authenticatedContext(ALICE);
        await assertSucceeds(getDoc(doc(alice.firestore(), 'tripPoints/t1')));
      });

      it('denies a non-owner reading', async () => {
        const bob = testEnv.authenticatedContext(BOB);
        await assertFails(getDoc(doc(bob.firestore(), 'tripPoints/t1')));
      });

      it('denies update, even by the owner (immutable)', async () => {
        const alice = testEnv.authenticatedContext(ALICE);
        await assertFails(updateDoc(doc(alice.firestore(), 'tripPoints/t1'), { points: [1, 2, 3, 4] }));
      });

      it('denies delete, even by the owner', async () => {
        const alice = testEnv.authenticatedContext(ALICE);
        await assertFails(deleteDoc(doc(alice.firestore(), 'tripPoints/t1')));
      });
    });
  });

  describe('tripPoints/{tripId}/batches/{batchId}', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'tripPoints/t1'), { userId: ALICE, points: [] });
      });
    });

    it('allows the owning trip user to create a batch', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(
        setDoc(doc(alice.firestore(), 'tripPoints/t1/batches/b1'), { seq: 0, points: [1, 2] }),
      );
    });

    it("denies another user creating a batch under someone else's trip", async () => {
      const bob = testEnv.authenticatedContext(BOB);
      await assertFails(
        setDoc(doc(bob.firestore(), 'tripPoints/t1/batches/b1'), { seq: 0, points: [1, 2] }),
      );
    });

    describe('once a batch exists', () => {
      beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          await setDoc(doc(context.firestore(), 'tripPoints/t1/batches/b1'), { seq: 0, points: [1, 2] });
        });
      });

      it('allows the owning trip user to read the batch', async () => {
        const alice = testEnv.authenticatedContext(ALICE);
        await assertSucceeds(getDoc(doc(alice.firestore(), 'tripPoints/t1/batches/b1')));
      });

      it('denies a non-owner reading the batch', async () => {
        const bob = testEnv.authenticatedContext(BOB);
        await assertFails(getDoc(doc(bob.firestore(), 'tripPoints/t1/batches/b1')));
      });

      it('denies update and delete on a batch', async () => {
        const alice = testEnv.authenticatedContext(ALICE);
        await assertFails(updateDoc(doc(alice.firestore(), 'tripPoints/t1/batches/b1'), { seq: 1 }));
        await assertFails(deleteDoc(doc(alice.firestore(), 'tripPoints/t1/batches/b1')));
      });
    });
  });
});

/**
 * THE SUBMIT BATCH THE APPS ACTUALLY SEND
 * ========================================
 * Wave C. The rules above deny every update to tripPoints/{tripId}, and both
 * clients were sending one anyway, inside the SAME writeBatch that ends the
 * trip. mobile/lib/trips.ts submitTripForScoring and client/src/lib/
 * tripService.ts endTrip both wrote `{ totalPoints, compressedSize }` onto the
 * parent points document while flipping the trip recording -> processing.
 *
 * A batch is atomic, so one denied write denies the whole thing: the trip
 * never leaves 'recording', onTripStatusChange never fires, the trip is never
 * scored, and the driver is told "Could not save the trip. Try again." on
 * every attempt. Nothing about it is visible in the individual rules above,
 * each of which is correct on its own, and the web client's characterisation
 * test pins the doomed shape against a mocked Firestore that has no rules to
 * refuse it.
 *
 * These two tests are the pin: the trip half of the batch is allowed, and the
 * moment the tripPoints half is added the batch dies.
 */
describe('firestore.rules: the recording to processing submit batch', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv('driiva-rules-submit-batch');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'trips/t1'), {
        tripId: 't1',
        userId: ALICE,
        createdBy: ALICE,
        status: 'recording',
        score: 0,
        pointsCount: 0,
      });
      await setDoc(doc(db, 'tripPoints/t1'), {
        tripId: 't1',
        userId: ALICE,
        points: [],
        totalPoints: 0,
        compressedSize: 0,
      });
    });
  });

  it('allows a batch that only ends the trip', async () => {
    const alice = testEnv.authenticatedContext(ALICE);
    const db = alice.firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, 'trips/t1'), { status: 'processing', pointsCount: 120 });

    await assertSucceeds(batch.commit());
  });

  it('denies the whole batch when it also updates the tripPoints parent', async () => {
    const alice = testEnv.authenticatedContext(ALICE);
    const db = alice.firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, 'trips/t1'), { status: 'processing', pointsCount: 120 });
    batch.update(doc(db, 'tripPoints/t1'), { totalPoints: 120, compressedSize: 6000 });

    await assertFails(batch.commit());
  });

  it('leaves the trip in recording after the denied batch, which is the bug the driver hit', async () => {
    const alice = testEnv.authenticatedContext(ALICE);
    const db = alice.firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, 'trips/t1'), { status: 'processing' });
    batch.update(doc(db, 'tripPoints/t1'), { totalPoints: 120 });
    await assertFails(batch.commit());

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDoc(doc(context.firestore(), 'trips/t1'));
      expect(snap.data()?.status).toBe('recording');
    });
  });
});

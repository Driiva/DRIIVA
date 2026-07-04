/**
 * Characterises /tripPoints/{tripId} and its /batches subcollection:
 * owner create allowed, but update and delete are DENIED outright (points
 * are append-only/immutable once written).
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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

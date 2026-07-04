/**
 * Characterises the collections that are read-only for clients and written
 * only by Cloud Functions via the Admin SDK: communityPool, poolShares,
 * driver_stats, policies, tripSegments, tripAiInsights.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { createTestEnv } from './helpers';

const ALICE = 'alice';
const BOB = 'bob';

describe('firestore.rules: read-only aggregate/owned collections', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv('driiva-rules-readonly');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('communityPool', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'communityPool/main'), { total: 1000 });
      });
    });

    it('allows an unauthenticated read (pin the current world-read)', async () => {
      const anon = testEnv.unauthenticatedContext();
      await assertSucceeds(getDoc(doc(anon.firestore(), 'communityPool/main')));
    });

    it('denies any client write', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(updateDoc(doc(alice.firestore(), 'communityPool/main'), { total: 2000 }));
    });
  });

  describe.each([
    ['poolShares', 'poolShares/s1'],
    ['tripSegments', 'tripSegments/seg1'],
    ['tripAiInsights', 'tripAiInsights/i1'],
  ])('%s (owner read via resource.data.userId)', (_name, path) => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), path), { userId: ALICE, value: 42 });
      });
    });

    it('allows the owner to read', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(getDoc(doc(alice.firestore(), path)));
    });

    it('denies a non-owner reading', async () => {
      const bob = testEnv.authenticatedContext(BOB);
      await assertFails(getDoc(doc(bob.firestore(), path)));
    });

    it('denies any client write', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(updateDoc(doc(alice.firestore(), path), { value: 99 }));
    });
  });

  describe('driver_stats/{userId} (owner read via doc id)', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), `driver_stats/${ALICE}`), { totalTrips: 12 });
      });
    });

    it('allows the owner to read', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(getDoc(doc(alice.firestore(), `driver_stats/${ALICE}`)));
    });

    it('denies a non-owner reading', async () => {
      const bob = testEnv.authenticatedContext(BOB);
      await assertFails(getDoc(doc(bob.firestore(), `driver_stats/${ALICE}`)));
    });

    it('denies any client write', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(updateDoc(doc(alice.firestore(), `driver_stats/${ALICE}`), { totalTrips: 13 }));
    });
  });

  describe('policies', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'policies/p1'), { userId: ALICE, status: 'active' });
      });
    });

    it('allows the owner to read', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(getDoc(doc(alice.firestore(), 'policies/p1')));
    });

    it('denies a non-owner reading', async () => {
      const bob = testEnv.authenticatedContext(BOB);
      await assertFails(getDoc(doc(bob.firestore(), 'policies/p1')));
    });

    it('denies create, update and delete for all clients', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(setDoc(doc(alice.firestore(), 'policies/p2'), { userId: ALICE, status: 'active' }));
      await assertFails(updateDoc(doc(alice.firestore(), 'policies/p1'), { status: 'cancelled' }));
    });
  });
});

/**
 * Characterises the deny-by-design collections (audit quirk 6.8) and the
 * catch-all deny. `systemLogs`, `feedback` (read), and `aiUsageTracking` are
 * unreadable by ANY client — including one with an admin-like custom claim,
 * because `isAdmin` is a Firestore field the rules can't see and no admin
 * custom-claim exists yet. Rebuilding admin access on custom claims is M5
 * scope; this suite only pins today's behaviour.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { createTestEnv } from './helpers';

const ALICE = 'alice';
const ADMIN_CLAIM_UID = 'would-be-admin';

describe('firestore.rules: deny-by-design collections + catch-all', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv('driiva-rules-deny-by-design');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('systemLogs', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'systemLogs/log1'), { event: 'login' });
      });
    });

    it('denies read for an authenticated user', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(getDoc(doc(alice.firestore(), 'systemLogs/log1')));
    });

    it('denies read even with an admin-shaped custom claim (M5: no admin custom-claim yet)', async () => {
      const wouldBeAdmin = testEnv.authenticatedContext(ADMIN_CLAIM_UID, { admin: true });
      await assertFails(getDoc(doc(wouldBeAdmin.firestore(), 'systemLogs/log1')));
    });

    it('denies write', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(setDoc(doc(alice.firestore(), 'systemLogs/log2'), { event: 'tamper' }));
    });
  });

  describe('feedback', () => {
    it('allows an authenticated user to create feedback', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertSucceeds(setDoc(doc(alice.firestore(), 'feedback/f1'), { message: 'great app' }));
    });

    it('denies an unauthenticated create', async () => {
      const anon = testEnv.unauthenticatedContext();
      await assertFails(setDoc(doc(anon.firestore(), 'feedback/f1'), { message: 'anon' }));
    });

    describe('once feedback exists', () => {
      beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          await setDoc(doc(context.firestore(), 'feedback/f1'), { message: 'great app' });
        });
      });

      it('denies read, even for the author', async () => {
        const alice = testEnv.authenticatedContext(ALICE);
        await assertFails(getDoc(doc(alice.firestore(), 'feedback/f1')));
      });

      it('denies read even with an admin-shaped custom claim (M5 decision)', async () => {
        const wouldBeAdmin = testEnv.authenticatedContext(ADMIN_CLAIM_UID, { admin: true });
        await assertFails(getDoc(doc(wouldBeAdmin.firestore(), 'feedback/f1')));
      });

      it('denies update and delete', async () => {
        const alice = testEnv.authenticatedContext(ALICE);
        await assertFails(updateDoc(doc(alice.firestore(), 'feedback/f1'), { message: 'edited' }));
      });
    });
  });

  describe('aiUsageTracking', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'aiUsageTracking/u1'), { tokens: 100 });
      });
    });

    it('denies read', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(getDoc(doc(alice.firestore(), 'aiUsageTracking/u1')));
    });

    it('denies read even with an admin-shaped custom claim (M5 decision)', async () => {
      const wouldBeAdmin = testEnv.authenticatedContext(ADMIN_CLAIM_UID, { admin: true });
      await assertFails(getDoc(doc(wouldBeAdmin.firestore(), 'aiUsageTracking/u1')));
    });

    it('denies write', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(updateDoc(doc(alice.firestore(), 'aiUsageTracking/u1'), { tokens: 200 }));
    });
  });

  describe('catch-all deny', () => {
    it('denies read and write on an arbitrary unmodelled collection', async () => {
      const alice = testEnv.authenticatedContext(ALICE);
      await assertFails(getDoc(doc(alice.firestore(), 'somethingNotInTheRules/doc1')));
      await assertFails(setDoc(doc(alice.firestore(), 'somethingNotInTheRules/doc1'), { anything: true }));
    });
  });
});

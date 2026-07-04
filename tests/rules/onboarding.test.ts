/**
 * Characterises the owner-gated write of `users/{userId}.onboardingComplete`
 * (M1 T2: the live onboarding-completion path is now a single Firestore write
 * to this field, per DEC-4). `firestore.rules` does not lock this field in the
 * `users/{userId}` update rule, so it is already permitted by the general
 * owner-update rule - this suite pins that behaviour: the owner CAN set it, a
 * non-owner CANNOT, and the existing locked fields stay locked when the owner
 * writes onboardingComplete alongside them.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
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
    onboardingComplete: false,
    ...overrides,
  };
}

describe('firestore.rules: users/{userId}.onboardingComplete', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv('driiva-rules-onboarding');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${ALICE}`), baseUser());
    });
  });

  it('allows the owner to set onboardingComplete on their own doc', async () => {
    const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
    await assertSucceeds(
      updateDoc(doc(alice.firestore(), `users/${ALICE}`), { onboardingComplete: true }),
    );
  });

  it('denies a non-owner setting onboardingComplete', async () => {
    const bob = testEnv.authenticatedContext(BOB);
    await assertFails(
      updateDoc(doc(bob.firestore(), `users/${ALICE}`), { onboardingComplete: true }),
    );
  });

  it('keeps the locked fields locked when the owner writes onboardingComplete alongside them', async () => {
    const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
    await assertFails(
      updateDoc(doc(alice.firestore(), `users/${ALICE}`), {
        onboardingComplete: true,
        drivingProfile: { style: 'aggressive' },
      }),
    );
  });

  it('keeps the owner write with onboardingComplete plus other unlocked onboarding fields', async () => {
    const alice = testEnv.authenticatedContext(ALICE, { email: ALICE_EMAIL });
    await assertSucceeds(
      updateDoc(doc(alice.firestore(), `users/${ALICE}`), {
        onboardingComplete: true,
        gpsPermissionGranted: true,
        annualMileage: '8000',
      }),
    );
  });
});

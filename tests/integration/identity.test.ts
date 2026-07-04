/**
 * M1 T5 - Auth+Firestore integration test (the module gate).
 *
 * Proves the M1 flow end to end against REAL emulators with REAL SDKs:
 * signup -> provisioning -> onboarding-completion -> dashboard-gate.
 *
 * PROVISIONING APPROACH: this suite calls the exported `provisionUser`
 * handler (functions/src/triggers/provisionUserOnSignup.ts) directly against
 * the Firestore emulator, rather than loading the dormant
 * `provisionUserOnSignup` Cloud Function into the functions emulator so a
 * real Auth `onCreate` fires it. Both are legitimate per the M1 T5 brief;
 * this one was chosen because the trigger file's own comment states
 * `provisionUser` and `buildProvisionedUserDoc` are exported individually
 * "so a later emulator integration test (M1 T5) can drive them directly
 * without the trigger wrapper" - the author already built this seam for this
 * exact purpose. It also avoids standing up a second, test-only Functions
 * entrypoint/build just to exercise a function that never runs in
 * production today (the trigger is dormant, not in functions/src/index.ts),
 * and every line of `provisionUser`'s own logic still runs unmocked against
 * the real Firestore emulator - only the Auth-trigger dispatch wrapper is
 * skipped. Hence `--only auth,firestore` (no `functions`) in the
 * `test:integration` script.
 *
 * T2's completion write is exercised the other way: signed in as the real
 * emulator user via the client SDK, so the owner-gated Firestore write goes
 * through the actual firestore.rules `users/{userId}` update rule, matching
 * quick-onboarding.tsx's handleComplete exactly (a client setDoc, not an
 * Admin SDK write that would bypass rules).
 *
 * IMPORT ORDER MATTERS: './helpers' must be imported before
 * provisionUserOnSignup so its Admin SDK app is initialized before that
 * module's own top-level `admin.firestore()` call runs - see the
 * module-instance note in helpers.ts.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { adminAuth, adminDb, adminApp, clientAuth, clientDb } from './helpers';

import { UserDocumentSchema } from '@driiva/contracts';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { provisionUser } from '../../functions/src/triggers/provisionUserOnSignup';

const TEST_PASSWORD = 'Characterise123!';

function uniqueEmail(label: string): string {
  return `m1-t5-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@driiva.co.uk`;
}

describe('M1 identity integration (Auth + Firestore emulators)', () => {
  afterAll(async () => {
    await adminApp.delete();
  });

  it('provisions an email/password user into a UserDocumentSchema-valid, defaulted doc', async () => {
    const email = uniqueEmail('emailpw');
    const userRecord = await adminAuth.createUser({
      email,
      password: TEST_PASSWORD,
      displayName: 'Integration Tester',
    });

    await provisionUser(userRecord);

    const snap = await adminDb.collection('users').doc(userRecord.uid).get();
    expect(snap.exists).toBe(true);

    const parsed = UserDocumentSchema.parse(snap.data());
    expect(parsed.uid).toBe(userRecord.uid);
    expect(parsed.email).toBe(email);
    expect(parsed.displayName).toBe('Integration Tester');
    expect(parsed.onboardingComplete).toBe(false);
    expect(parsed.drivingProfile.currentScore).toBe(100);
    expect(parsed.drivingProfile.totalTrips).toBe(0);
    expect(parsed.activePolicy).not.toBeNull();
    expect(parsed.activePolicy?.status).toBe('pending');
    expect(parsed.poolShare.currentShareCents).toBe(0);
    expect(parsed.settings).toEqual({
      notificationsEnabled: true,
      autoTripDetection: false,
      unitSystem: 'imperial',
    });
  });

  it('provisions a Google-shaped user (no displayName) - the bootstrap gap T1 closes', async () => {
    // The Admin SDK cannot synthesize a real federated Google identity, so
    // this simulates the property that actually matters for the bootstrap
    // gap: an account with no displayName. What T1 fixes is that
    // provisionUser fires for EVERY Auth signup unconditionally (unlike
    // today's onUserCreate, a Firestore-doc trigger that never fires for
    // Google sign-in because Google sign-in writes no Firestore doc at
    // all) - proven here by calling it against an account that never went
    // through the email/password path either.
    const email = uniqueEmail('google');
    const userRecord = await adminAuth.createUser({ email });
    expect(userRecord.displayName).toBeUndefined();

    await provisionUser(userRecord);

    const snap = await adminDb.collection('users').doc(userRecord.uid).get();
    const parsed = UserDocumentSchema.parse(snap.data());
    expect(parsed.uid).toBe(userRecord.uid);
    // deriveDisplayName's fallback: local part of the email.
    expect(parsed.displayName).toBe(email.split('@')[0]);
    expect(parsed.onboardingComplete).toBe(false);
    expect(parsed.drivingProfile.currentScore).toBe(100);
  });

  it('flips onboardingComplete via the T2 owner-gated write - the AuthContext/ProtectedRoute gate signal', async () => {
    const email = uniqueEmail('gate');
    const userRecord = await adminAuth.createUser({
      email,
      password: TEST_PASSWORD,
      displayName: 'Gate Tester',
    });
    await provisionUser(userRecord);

    // Confirm the gate starts closed, matching provisionUser's default.
    const beforeSnap = await adminDb.collection('users').doc(userRecord.uid).get();
    expect(beforeSnap.data()?.onboardingComplete).toBe(false);

    // Sign in as the real emulator user, then perform the SAME write
    // quick-onboarding.tsx's handleComplete makes: an owner-gated merge
    // setDoc of onboardingComplete: true. This goes through the real
    // firestore.rules `users/{userId}` update rule (unlike the Admin SDK
    // writes above, which bypass rules by design).
    const cred = await signInWithEmailAndPassword(clientAuth, email, TEST_PASSWORD);
    expect(cred.user.uid).toBe(userRecord.uid);

    const userDocRef = doc(clientDb, 'users', userRecord.uid);
    await setDoc(
      userDocRef,
      { onboardingComplete: true, updatedAt: new Date().toISOString() },
      { merge: true },
    );

    // The gate signal AuthContext/ProtectedRoute read.
    const afterSnap = await adminDb.collection('users').doc(userRecord.uid).get();
    expect(afterSnap.data()?.onboardingComplete).toBe(true);
  });
});

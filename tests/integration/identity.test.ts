/**
 * M1 T5/T7 - Auth+Firestore integration test (the module gate).
 *
 * Proves the M1 flow end to end against REAL emulators with REAL SDKs:
 * signup -> provisioning -> onboarding-completion -> dashboard-gate.
 *
 * PROVISIONING APPROACH: this suite calls the exported `provisionUser`
 * handler (functions/src/triggers/provisionUserOnSignup.ts) directly against
 * the Firestore emulator, rather than loading the Cloud Function into the
 * functions emulator so a real Auth `onCreate` dispatch fires it. Both are
 * legitimate per the M1 T5 brief; this one was chosen because the trigger
 * file's own comment states `provisionUser` and `buildProvisionedUserDoc`
 * are exported individually "so a later emulator integration test (M1 T5)
 * can drive them directly without the trigger wrapper" - the author already
 * built this seam for this exact purpose. It also avoids standing up the
 * functions emulator (which would need a `functions/lib` rebuild plus every
 * OTHER exported function's secrets/env satisfied just to boot one trigger),
 * and every line of `provisionUser`'s own logic still runs unmocked against
 * the real Firestore emulator - only the Auth-trigger dispatch wrapper is
 * skipped. Hence `--only auth,firestore` (no `functions`) in the
 * `test:integration` script.
 *
 * T7 CUTOVER: `provisionUserOnSignup` is no longer dormant - it is exported
 * from `functions/src/index.ts` (the deploy surface), replacing the retired
 * `onUserCreate` and the client's fire-and-forget batch. The "wired into the
 * deploy set" test below asserts that directly, as the brief's fallback for
 * not standing up the real functions-emulator dispatch (see above). It reads
 * `functions/src/index.ts` as text rather than importing it: that module
 * unconditionally calls `admin.initializeApp()` at its own top level (no
 * `admin.apps.length` guard, unlike this suite's helpers.ts), which would
 * throw "default app already exists" against the already-initialized Admin
 * app this suite shares with provisionUserOnSignup.ts (see the
 * module-instance note below) - and it transitively imports every other
 * Cloud Function's module (Stripe, Root Platform, Anthropic clients, etc.),
 * any of which may read env/secrets at import time. A source-text assertion
 * proves the deploy surface without either risk.
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
import { readFileSync } from 'fs';
import path from 'path';
import { adminAuth, adminDb, adminApp, clientAuth, clientDb } from './helpers';

import { UserDocumentSchema, STARTING_SCORE } from '@driiva/contracts';
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
    // Read the constant, do not retype it. This assertion said 100, which was
    // right when it was written and wrong from the moment the starting score
    // became 70. The constant's own documentation makes the point: a number
    // retyped in several places is a number that will disagree in several
    // places, and this test was one of the places.
    expect(parsed.drivingProfile.currentScore).toBe(STARTING_SCORE);
    expect(parsed.drivingProfile.totalTrips).toBe(0);
    // Wave H: signing up creates an ACCOUNT, not a policy. This used to assert
    // an activePolicy existed with status 'pending', which was true when
    // provisioning minted a policy number and a set of cover limits nobody had
    // underwritten. A new user holds no policy now, and this pins that.
    expect(parsed.activePolicy).toBeNull();
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
    // M1 T7 fix: deriveDisplayName no longer falls back to the email local
    // part when the Auth record has no displayName - it writes null, so the
    // UI's own `|| user?.name || 'Driver'` fallback chain resolves it
    // instead of a wrong value getting baked permanently into Firestore.
    expect(parsed.displayName).toBeNull();
    expect(parsed.onboardingComplete).toBe(false);
    expect(parsed.drivingProfile.currentScore).toBe(STARTING_SCORE);
    expect(parsed.activePolicy).toBeNull();
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

  it('M1 T7: provisionUserOnSignup is wired into the deploy set, replacing the retired onUserCreate', () => {
    const indexSource = readFileSync(
      path.resolve(__dirname, '../../functions/src/index.ts'),
      'utf-8',
    );

    expect(indexSource).toMatch(
      /export\s*\{\s*provisionUserOnSignup\s*\}\s*from\s*['"]\.\/triggers\/provisionUserOnSignup['"]/,
    );
    // The retired module must not be importable from here at all. Checked as
    // export/import syntax, not a bare `.not.toContain('onUserCreate')` -
    // this file's own explanatory comments about the retirement mention that
    // name too, so a substring check would false-fail on its own commentary.
    expect(indexSource).not.toMatch(/export\s*\{[^}]*\bonUserCreate\b[^}]*\}/);
    expect(indexSource).not.toMatch(/from\s*['"]\.\/triggers\/users['"]/);
    // syncUserOnSignup (DEC-3) must survive the cutover unchanged.
    expect(indexSource).toMatch(
      /export\s*\{\s*syncUserOnSignup\s*\}\s*from\s*['"]\.\/triggers\/syncUserOnSignup['"]/,
    );
  });
});

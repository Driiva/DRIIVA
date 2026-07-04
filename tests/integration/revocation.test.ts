/**
 * M1 T6 - session-revocation integration test.
 *
 * Proves the actual server code path end to end against the real Auth
 * emulator: `verifyFirebaseToken` (the function server/middleware/auth.ts's
 * verifyFirebaseAuth calls) accepts a freshly-signed-in user's ID token,
 * then `admin.auth().revokeRefreshTokens(uid)` (the operational path in
 * scripts/revoke-user-sessions.ts) is called, then that SAME
 * previously-valid token is rejected now that checkRevoked is on - and a
 * brand new sign-in after the revoke is accepted again, confirming the
 * revoke isn't a permanent lockout, just a kill switch for tokens already
 * issued.
 *
 * IMPORT ORDER MATTERS, same reason as identity.test.ts: './helpers' must
 * run its admin.initializeApp() before server/lib/firebase-admin.ts's
 * getFirebaseAdmin() is first called, so getFirebaseAdmin() finds
 * admin.apps.length > 0 and reuses the emulator-pointed default app instead
 * of trying (and failing on a duplicate-app error) to initialize its own.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { adminApp, adminAuth, clientAuth } from './helpers';

import { signInWithEmailAndPassword } from 'firebase/auth';

import { verifyFirebaseToken } from '../../server/lib/firebase-admin';

const TEST_PASSWORD = 'Characterise123!';

function uniqueEmail(label: string): string {
  return `m1-t6-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@driiva.co.uk`;
}

describe('M1 session revocation integration (Auth emulator)', () => {
  afterAll(async () => {
    await adminApp.delete();
  });

  it('accepts a valid token, rejects it once revoked, then accepts a fresh sign-in', async () => {
    const email = uniqueEmail('revoke');
    const userRecord = await adminAuth.createUser({ email, password: TEST_PASSWORD });

    const cred = await signInWithEmailAndPassword(clientAuth, email, TEST_PASSWORD);
    const originalToken = await cred.user.getIdToken();

    const accepted = await verifyFirebaseToken(originalToken);
    expect(accepted).not.toBeNull();
    expect(accepted?.uid).toBe(userRecord.uid);

    // checkRevoked compares the token's issued-at second against the
    // revocation cutoff (tokensValidAfterTime), both second-granularity: a
    // revoke in the same second as the sign-in would not reliably catch the
    // token. Force a >1s gap so the revoke below lands in a later second.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await adminAuth.revokeRefreshTokens(userRecord.uid);

    const rejected = await verifyFirebaseToken(originalToken);
    expect(rejected).toBeNull();

    // Revocation kills tokens already issued, it is not a permanent lockout:
    // a brand new sign-in (issued after the revoke) is accepted again.
    const freshCred = await signInWithEmailAndPassword(clientAuth, email, TEST_PASSWORD);
    const freshToken = await freshCred.user.getIdToken();
    const acceptedAgain = await verifyFirebaseToken(freshToken);
    expect(acceptedAgain).not.toBeNull();
    expect(acceptedAgain?.uid).toBe(userRecord.uid);
  });
});

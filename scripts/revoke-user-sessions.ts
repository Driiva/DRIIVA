/**
 * Session-revocation MVP (M1 T6). Kills every still-valid ID token/refresh
 * token for a user right now, instead of waiting for natural expiry -
 * the operational path for "log out everywhere" / a compromised or
 * disabled account. Pairs with `checkRevoked: true` in
 * server/lib/firebase-admin.ts, which is what makes the server actually
 * reject a revoked token on its next request.
 *
 * Usage: tsx scripts/revoke-user-sessions.ts <uid>
 *
 * Scope: a requireAdmin endpoint wrapping this same call is M5 (admin auth
 * infra doesn't exist yet); this script is the minimum viable path so
 * revocation is possible today, run by whoever has server credentials.
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp();
}

async function revokeUserSessions(uid: string) {
  try {
    console.log(`Looking up user ${uid}...`);
    const userRecord = await admin.auth().getUser(uid);

    console.log(`Revoking refresh tokens for ${userRecord.email ?? uid}...`);
    await admin.auth().revokeRefreshTokens(uid);

    console.log('Done. Any ID token issued before this moment is now rejected');
    console.log('by the server (checkRevoked) on its next verified request;');
    console.log('the client will need to sign in again to get a fresh token.');
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error && error.message.includes('no user record')) {
      console.log('User not found - check the uid.');
    }
  } finally {
    process.exit(0);
  }
}

const uid = process.argv[2];

if (!uid) {
  console.error('Usage: tsx scripts/revoke-user-sessions.ts <uid>');
  process.exit(1);
}

revokeUserSessions(uid);

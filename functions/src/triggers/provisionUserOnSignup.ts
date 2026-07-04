/**
 * PROVISION USER ON SIGNUP
 * ========================
 * The unified user-provisioning path for M1 (see
 * .superpowers/sdd/m1-grounding.md §2/§8, rebuild_plan.md §M1 T1). A single
 * Firebase Auth `onCreate` trigger that writes the complete `users/{uid}`
 * doc for EVERY signup method, including Google - which today writes no
 * `users` doc at all (see `functions/src/triggers/users.ts`'s `onUserCreate`,
 * a Firestore-doc trigger that never fires for Google sign-in).
 *
 * ADDITIVE + DORMANT: this trigger is intentionally NOT exported from
 * `functions/src/index.ts` (the deploy surface). It coexists with the
 * untouched `onUserCreate` and `syncUserOnSignup` triggers and the client's
 * fire-and-forget batch (`client/src/pages/signup.tsx`) until the M1 T7
 * cutover retires them and wires this in. `provisionUser` and
 * `buildProvisionedUserDoc` are exported individually so a later emulator
 * integration test (M1 T5) can drive them directly without the trigger
 * wrapper.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { COLLECTION_NAMES, PolicyDocument } from '../types';
import { EUROPE_LONDON } from '../lib/region';
import { createDamoovUser } from '../lib/damoov';
import { wrapTrigger } from '../lib/sentry';
import { buildProvisionedUserDoc } from '../utils/provisionUser';

const db = admin.firestore();

// Comma-separated list of emails that are automatically granted admin access.
// Mirrors functions/src/triggers/users.ts's ADMIN_EMAILS - duplicated here
// rather than imported so this module stays independent of the old trigger
// it is meant to replace at cutover. Read lazily (per invocation, not at
// module load) so it reflects the current env in tests; a Cloud Function's
// env doesn't change mid-container-lifetime, so this has no production cost.
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Generate a unique policy number in format DRV-001, DRV-002, etc.
 * Ported verbatim from `functions/src/triggers/users.ts`'s (unexported)
 * `generatePolicyNumber` - same `counters/policy` counter doc, so numbering
 * stays contiguous across both provisioning paths during the M1 coexistence
 * window.
 */
async function generatePolicyNumber(): Promise<string> {
  const counterRef = db.collection(COLLECTION_NAMES.COUNTERS).doc('policy');

  return await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let nextValue = 1;

    if (counterDoc.exists) {
      nextValue = (counterDoc.data()?.currentValue || 0) + 1;
    }

    transaction.set(counterRef, { currentValue: nextValue }, { merge: true });

    const paddedNumber = String(nextValue).padStart(3, '0');
    return `DRV-${paddedNumber}`;
  });
}

/**
 * Async handler for the Auth `onCreate` event: writes `users/{uid}`,
 * `usernames/{localPart}`, the default `policies/{...}` doc, and registers
 * the user with Damoov. Fires for every signup method, including Google.
 */
export async function provisionUser(user: functions.auth.UserRecord): Promise<void> {
  const { uid, email: rawEmail, displayName } = user;
  const email = rawEmail || '';

  const adminEmails = getAdminEmails();
  const isAdmin = adminEmails.length > 0 && adminEmails.includes(email.toLowerCase());
  if (isAdmin) {
    functions.logger.info(`Auto-promoting ${uid} (${email}) to admin - reason: ADMIN_EMAILS allowlist`);
  }

  const policyId = `policy_${uid}`;
  const policyNumber = await generatePolicyNumber();
  const now = admin.firestore.Timestamp.now();
  const renewalDate = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  );

  const userDoc = buildProvisionedUserDoc({
    uid,
    email,
    displayName: displayName ?? undefined,
    isAdmin,
    policyId,
    policyNumber,
    now,
    renewalDate,
  });

  await db.collection(COLLECTION_NAMES.USERS).doc(uid).set(userDoc);
  functions.logger.info(`Provisioned user doc for ${uid}`, { email, isAdmin });

  const localPart = email.split('@')[0]?.toLowerCase();
  if (localPart) {
    await db.collection('usernames').doc(localPart).set({ email, uid }, { merge: true });
  }

  const policyData: PolicyDocument = {
    policyId,
    userId: uid,
    policyNumber,
    status: 'pending',
    coverageType: 'standard',
    coverageDetails: {
      liabilityLimitCents: 100000_00, // £100,000
      collisionDeductibleCents: 500_00, // £500
      comprehensiveDeductibleCents: 250_00, // £250
      includesRoadside: true,
      includesRental: false,
    },
    basePremiumCents: 0,
    currentPremiumCents: 0,
    discountPercentage: 0,
    effectiveDate: now,
    expirationDate: renewalDate,
    renewalDate,
    vehicle: null,
    billingCycle: 'annual',
    stripeSubscriptionId: null,
    createdAt: now,
    updatedAt: now,
    createdBy: 'cloud-function:provisionUserOnSignup',
    updatedBy: 'cloud-function:provisionUserOnSignup',
  };

  await db.collection(COLLECTION_NAMES.POLICIES).doc(policyId).set(policyData);
  functions.logger.info(`Created default policy ${policyId} for user ${uid}`, { policyNumber });

  // Silently register the user with Damoov for telematics data collection.
  // createDamoovUser already never throws (returns null on failure), but the
  // call is wrapped anyway so a future change to that contract can't
  // silently turn a Damoov outage into a failed provisioning.
  if (email) {
    try {
      const deviceToken = await createDamoovUser(uid, email);
      if (deviceToken) {
        await db.collection(COLLECTION_NAMES.USERS).doc(uid).update({ damoovDeviceToken: deviceToken });
        functions.logger.info(`Stored Damoov deviceToken for user ${uid}`);
      }
    } catch (error) {
      functions.logger.error(`Damoov registration failed for user ${uid} (non-fatal)`, error);
    }
  }
}

/**
 * DORMANT - not exported from functions/src/index.ts, not part of the
 * deployed functions set. M1 T7 wires this in at cutover.
 */
export const provisionUserOnSignup = functions
  .region(EUROPE_LONDON)
  .runWith({ secrets: ['DAMOOV_INSTANCE_ID', 'DAMOOV_INSTANCE_KEY'] })
  .auth.user()
  .onCreate(wrapTrigger(provisionUser));

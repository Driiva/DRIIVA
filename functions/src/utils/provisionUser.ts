/**
 * PROVISION USER - pure builder
 * ==============================
 * Builds the complete `users/{uid}` document for the unified Auth-triggered
 * provisioning path (M1 strangler seam, see .superpowers/sdd/m1-grounding.md
 * §2/§8). Ported from the driving-profile/activePolicy/poolShare/settings
 * defaults in `functions/src/triggers/users.ts` (`onUserCreate`, ~L138-181),
 * plus the base identity fields from `client/src/pages/signup.tsx`'s
 * fire-and-forget batch.
 *
 * PURE: takes already-resolved inputs (uid, email, timestamps, policy id/
 * number) and returns a plain object - no Firestore reads/writes, no
 * network calls, no wall-clock reads. The async side-effects (writing the
 * doc, creating the policy doc, the Damoov registration) live in the
 * `provisionUser` handler (`functions/src/triggers/provisionUserOnSignup.ts`),
 * which calls this builder and supplies the resolved inputs.
 */

import { STARTING_SCORE } from '@driiva/contracts';
import type { UserDocument, FirestoreTimestampLike } from '@driiva/contracts';

export interface BuildProvisionedUserDocInput {
  uid: string;
  email: string;
  /** Firebase Auth `displayName`, when the provider sets one (e.g. Google). */
  displayName?: string | null;
  /** True when `email` is in the ADMIN_EMAILS allowlist. */
  isAdmin?: boolean;
  /** The default policy's id, e.g. `policy_{uid}` - resolved by the caller. */
  policyId: string;
  /** The default policy's sequential number, e.g. `DRV-001` - resolved by the caller. */
  policyNumber: string;
  now: FirestoreTimestampLike;
  renewalDate: FirestoreTimestampLike;
}

/**
 * A provisioned user document plus the `isAdmin` flag. `isAdmin` is written
 * onto the real document (matching `onUserCreate`'s auto-promotion) but
 * `@driiva/contracts`' `UserDocumentSchema` doesn't declare the field today,
 * so it is typed here alongside the shared contract rather than
 * hand-widening it.
 */
export type ProvisionedUserDocument = UserDocument & { isAdmin?: boolean };

/**
 * Returns the Auth record's displayName verbatim, or null when it has none
 * (M1 T7 fix). Previously this derived a fallback from the email local part,
 * but for the only signup path that matters (email/password) the Auth
 * onCreate trigger fires BEFORE the client's un-awaited `updateProfile` call
 * lands (see signup.tsx), so the record's displayName is reliably empty at
 * this point - the derived fallback was being baked permanently into
 * Firestore instead of the name the user actually typed. Writing null lets
 * every reader's existing `|| user?.name || 'Driver'` fallback chain resolve
 * to the correct Auth-profile name once updateProfile has landed (near-
 * immediate for the same client session), rather than a wrong value that
 * only a manual edit could fix. Google-style signups, where the Auth record
 * already carries a real displayName at creation time, are unaffected.
 */
function deriveDisplayName(displayName?: string | null): string | null {
  return displayName || null;
}

export function buildProvisionedUserDoc(
  input: BuildProvisionedUserDocInput,
): ProvisionedUserDocument {
  const { uid, email, displayName, isAdmin, policyId, policyNumber, now, renewalDate } = input;

  const doc: ProvisionedUserDocument = {
    uid,
    email,
    displayName: deriveDisplayName(displayName),
    photoURL: null,
    phoneNumber: null,
    createdAt: now,
    updatedAt: now,
    drivingProfile: {
      // STARTING_SCORE, not a literal: the onboarding explainer and the
      // dashboard first-run state both quote this number to the user, and a
      // retyped copy is one that eventually disagrees with what is written
      // here. Note it is replaced outright by the first scored trip rather
      // than averaged down; see the constant's own documentation.
      currentScore: STARTING_SCORE,
      scoreBreakdown: {
        speedScore: 100,
        brakingScore: 100,
        accelerationScore: 100,
        corneringScore: 100,
        phoneUsageScore: 100,
      },
      totalTrips: 0,
      totalMiles: 0,
      totalDrivingMinutes: 0,
      lastTripAt: null,
      streakDays: 0,
      riskTier: 'low',
    },
    activePolicy: {
      policyId,
      policyNumber,
      status: 'pending',
      premiumCents: 0, // Updated when a quote is generated.
      coverageType: 'standard',
      renewalDate,
    },
    poolShare: {
      currentShareCents: 0,
      contributionCents: 0,
      sharePercentage: 0,
      lastUpdatedAt: now,
    },
    recentTrips: [],
    fcmTokens: [],
    settings: {
      notificationsEnabled: true,
      autoTripDetection: false,
      unitSystem: 'imperial',
    },
    createdBy: 'cloud-function:provisionUserOnSignup',
    updatedBy: 'cloud-function:provisionUserOnSignup',
    onboardingComplete: false,
  };

  if (isAdmin) {
    doc.isAdmin = true;
  }

  return doc;
}

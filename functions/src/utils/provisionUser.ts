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

const FALLBACK_DISPLAY_NAME = 'Driver';

function deriveDisplayName(email: string, displayName?: string | null): string {
  if (displayName) return displayName;
  const localPart = email.split('@')[0];
  return localPart || FALLBACK_DISPLAY_NAME;
}

export function buildProvisionedUserDoc(
  input: BuildProvisionedUserDocInput,
): ProvisionedUserDocument {
  const { uid, email, displayName, isAdmin, policyId, policyNumber, now, renewalDate } = input;

  const doc: ProvisionedUserDocument = {
    uid,
    email,
    displayName: deriveDisplayName(email, displayName),
    photoURL: null,
    phoneNumber: null,
    createdAt: now,
    updatedAt: now,
    drivingProfile: {
      currentScore: 100, // Start at 100 (perfect) - decreases with bad driving.
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

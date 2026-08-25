import { z } from 'zod';

import { ScoreBreakdownSchema } from './score-breakdown';
import { FirestoreTimestampSchema } from './timestamp';
import { VehicleInfoSchema } from './vehicle';
import { ActivePolicySummarySchema } from './policy';
import { PoolShareSummarySchema } from './pool-share';

export const RiskTierSchema = z.enum(['low', 'medium', 'high']);
export type RiskTier = z.infer<typeof RiskTierSchema>;

export const UnitSystemSchema = z.enum(['imperial', 'metric']);
export type UnitSystem = z.infer<typeof UnitSystemSchema>;

/**
 * DRIVING PROFILE
 * ===============
 * Denormalized onto the user doc for fast dashboard reads.
 * Source: shared/firestore-types.ts `DrivingProfileData` (~L67-76).
 *
 * Quirk 6.2 (RESOLVED in Wave 0, 0e): mobile used to read
 * `drivingProfile.overallSafetyScore` while every writer (Cloud Functions,
 * damoovSync, provisionUser) wrote `currentScore`, so the mobile safety score
 * sat at 0 forever. `currentScore` is the canonical field and the mobile
 * reader now uses it. Do not reintroduce a second name for this value.
 */
export const DrivingProfileDataSchema = z.object({
  currentScore: z.number().int().min(0).max(100),
  scoreBreakdown: ScoreBreakdownSchema,
  totalTrips: z.number().int().min(0),
  // Miles, to two decimal places. NOT miles times one hundred: the only writer
  // (functions/src/triggers/trips.ts) writes Math.round(miles * 100) / 100, and
  // shared/schema.ts declares the SQL column decimal(10, 2). This rule used to
  // be .int() on the authority of a comment that said otherwise, which made the
  // schema reject the first driver to cover a fractional mile.
  totalMiles: z.number().min(0),
  totalDrivingMinutes: z.number().int().min(0),
  lastTripAt: FirestoreTimestampSchema.nullable(),
  streakDays: z.number().int().min(0),
  riskTier: RiskTierSchema,
});
export type DrivingProfileData = z.infer<typeof DrivingProfileDataSchema>;

/**
 * RECENT TRIP SUMMARY
 * ===================
 * Denormalized onto the user doc (max 3, FIFO) by the trip-completion
 * trigger.
 *
 * UNIT CONVENTION (Wave 0, 0e): distance is METRES and duration is SECONDS,
 * as integers, matching TripDocument in ./trip.ts. Conversion to miles and
 * minutes happens at the render edge and nowhere else.
 *
 * This summary previously stored `distanceMiles`/`durationMinutes` while the
 * trip document it summarises stored metres and seconds, so the codebase
 * carried two units for one quantity. Mobile read `distanceMeters` off this
 * summary and rendered "NaN mi" the moment a real trip landed. One convention
 * removes the class of bug rather than the instance.
 */
export const RecentTripSummarySchema = z.object({
  tripId: z.string(),
  startedAt: FirestoreTimestampSchema,
  endedAt: FirestoreTimestampSchema,
  distanceMeters: z.number().int().min(0),
  durationSeconds: z.number().int().min(0),
  score: z.number().int().min(0).max(100),
  routeSummary: z.string(),
});
export type RecentTripSummary = z.infer<typeof RecentTripSummarySchema>;

export const UserSettingsSchema = z.object({
  notificationsEnabled: z.boolean(),
  autoTripDetection: z.boolean(),
  unitSystem: UnitSystemSchema,
});

/**
 * USER DOCUMENT
 * =============
 * Collection: `users/{userId}` (doc id = Firebase Auth UID).
 * Source: shared/firestore-types.ts `UserDocument` (~L147-194).
 */
export const UserDocumentSchema = z.object({
  uid: z.string(),
  email: z.string(),
  /**
   * Nullable (M1 T7 fix): provisionUserOnSignup writes null rather than
   * deriving a fallback name when the Auth record has none yet (see
   * functions/src/utils/provisionUser.ts's deriveDisplayName). Every reader
   * of this field (dashboard.tsx, useDashboardData.ts, profile.tsx) already
   * falls back with `|| user?.name || 'Driver'`, so null resolves correctly
   * client-side instead of being permanently baked into Firestore.
   */
  displayName: z.string().nullable(),
  photoURL: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  age: z.number().int().optional(),
  postcode: z.string().optional(),
  annualMileage: z.string().nullable().optional(),
  referralSource: z.string().nullable().optional(),
  currentInsurer: z.string().nullable().optional(),
  currentPremiumPounds: z.number().nullable().optional(),
  noClaimsYears: z.number().nullable().optional(),
  vehicle: VehicleInfoSchema.nullable().optional(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
  drivingProfile: DrivingProfileDataSchema,
  activePolicy: ActivePolicySummarySchema.nullable(),
  poolShare: PoolShareSummarySchema,
  recentTrips: z.array(RecentTripSummarySchema).max(3),
  fcmTokens: z.array(z.string()),
  settings: UserSettingsSchema,
  createdBy: z.string(),
  updatedBy: z.string(),
  /**
   * LIVE onboarding-gate field (no '-ed'). Written at AuthContext.tsx:89,
   * signup.tsx:140,160, onboarding.tsx:134, signin.tsx:502 and
   * quick-onboarding.tsx:301. Read at AuthContext.tsx:40
   * (`snap.data()?.onboardingComplete === true`) to decide whether a signed-in
   * user is routed past onboarding; the staging seed sets it to bypass the
   * gate. Not declared on the canonical UserDocument interface in
   * shared/firestore-types.ts, but it is the field every real gate check
   * actually reads - characterisation must pin it.
   */
  onboardingComplete: z.boolean().optional(),
  /**
   * Quirk 6.10: the DEAD '-ed' vestige. Written by
   * client/src/pages/signup.tsx as a fire-and-forget extra field ALONGSIDE
   * the live `onboardingComplete` above, but never read by anything. Pinned
   * here (optional) so a real signup-written document still parses, and the
   * vestige stays visible in the shape snapshot instead of being silently
   * dropped.
   */
  onboardingCompleted: z.boolean().optional(),
});
export type UserDocument = z.infer<typeof UserDocumentSchema>;

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
 * Quirk 6.2: mobile reads `drivingProfile.overallSafetyScore`
 * (dashboard.tsx:54-56) but every writer (Cloud Functions, damoovSync) writes
 * `currentScore` - that field has never existed on a real document. The
 * schema uses `currentScore`, the REAL writer's field, not the broken
 * reader's; mobile shows 0 forever until that reader is fixed (tracked
 * outside this contracts package).
 */
export const DrivingProfileDataSchema = z.object({
  currentScore: z.number().int().min(0).max(100),
  scoreBreakdown: ScoreBreakdownSchema,
  totalTrips: z.number().int().min(0),
  // Source comment: "stored as integer (miles * 100 for precision)".
  totalMiles: z.number().int().min(0),
  totalDrivingMinutes: z.number().int().min(0),
  lastTripAt: FirestoreTimestampSchema.nullable(),
  streakDays: z.number().int().min(0),
  riskTier: RiskTierSchema,
});
export type DrivingProfileData = z.infer<typeof DrivingProfileDataSchema>;

export const RecentTripSummarySchema = z.object({
  tripId: z.string(),
  startedAt: FirestoreTimestampSchema,
  endedAt: FirestoreTimestampSchema,
  distanceMiles: z.number(),
  durationMinutes: z.number(),
  score: z.number().int().min(0).max(100),
  routeSummary: z.string(),
});

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
  displayName: z.string(),
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

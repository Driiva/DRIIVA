/**
 * The users collection: the driver profile, its settings and the dashboard read shapes.
 * Extracted verbatim from shared/firestore-types.ts, which re-exports this
 * module so every existing import keeps working.
 */

import type { Timestamp } from './timestamp';
import type {
  CoverageType,
  PolicyStatus,
  RiskTier,
  UnitSystem,
} from './enums';
import type {
  VehicleInfo,
} from './policies';

// ============================================================================
// USERS COLLECTION
// ============================================================================

/**
 * Score breakdown for driving behavior components
 */
export interface ScoreBreakdown {
  speedScore: number;           // 0-100
  brakingScore: number;         // 0-100
  accelerationScore: number;    // 0-100
  corneringScore: number;       // 0-100
  phoneUsageScore: number;      // 0-100
}

/**
 * Driving profile embedded in user document
 * Denormalized for fast dashboard reads
 */
export interface DrivingProfileData {
  currentScore: number;           // 0-100, weighted composite
  scoreBreakdown: ScoreBreakdown;
  totalTrips: number;
  totalMiles: number;             // miles, to 2 decimal places (see trips.ts)
  totalDrivingMinutes: number;
  lastTripAt: Timestamp | null;
  streakDays: number;             // consecutive safe driving days
  riskTier: RiskTier;
}

/**
 * Denormalized active policy summary for dashboard
 */
export interface ActivePolicySummary {
  policyId: string;
  policyNumber: string;
  status: PolicyStatus;
  premiumCents: number;           // monthly premium in cents
  coverageType: CoverageType;
  renewalDate: Timestamp;
}

/**
 * Denormalized pool share for dashboard
 */
export interface PoolShareSummary {
  currentShareCents: number;      // driver's projected refund
  contributionCents: number;      // total contributed
  sharePercentage: number;        // 0-100 (2 decimal precision)
  lastUpdatedAt: Timestamp;
}

/**
 * Recent trip summary for dashboard (max 3 items)
 */
export interface RecentTripSummary {
  tripId: string;
  startedAt: Timestamp;
  endedAt: Timestamp;
  distanceMeters: number;  // Wave 0 (0e): metres, not miles
  durationSeconds: number;  // Wave 0 (0e): seconds, not minutes
  score: number;
  routeSummary: string;           // "Home → Work"
}

/**
 * User settings
 */
export interface UserSettings {
  notificationsEnabled: boolean;
  autoTripDetection: boolean;
  unitSystem: UnitSystem;
}

/**
 * Beta pricing estimate document (single source of truth).
 * Path: users/{userId}/betaPricing/currentEstimate
 */
export interface BetaEstimateDocument {
  estimatedPremium: number;
  minPremium: number;
  maxPremium: number;
  refundRate: number;
  estimatedRefund: number;
  estimatedNetCost: number;
  personalScore: number;
  age: number;
  postcode: string;
  communityPoolSafety: number;
  version: 'beta-v1';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Main user document - optimized for dashboard reads
 * Collection: users/{userId}
 * Document ID: Firebase Auth UID
 */
export interface UserDocument {
  // Identity
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  phoneNumber: string | null;
  /** Optional: used for beta premium estimate */
  age?: number;
  /** Optional: UK postcode e.g. "SW1A 1AA", used for beta premium estimate */
  postcode?: string;
  /** Soft onboarding: annual driving mileage band */
  annualMileage?: string | null;
  /** Soft onboarding: how user heard about Driiva */
  referralSource?: string | null;
  /** Soft onboarding: current insurance provider */
  currentInsurer?: string | null;
  /** Soft onboarding: current annual premium in pounds */
  currentPremiumPounds?: number | null;
  /** No-claims bonus years (0–5+). Collected at onboarding step 7. */
  noClaimsYears?: number | null;
  /** Vehicle info collected during onboarding (make/model/year) */
  vehicle?: VehicleInfo | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Driving Profile (denormalized for dashboard)
  drivingProfile: DrivingProfileData;
  
  // Denormalized Policy Summary (for dashboard)
  activePolicy: ActivePolicySummary | null;
  
  // Denormalized Pool Share (for dashboard)
  poolShare: PoolShareSummary;
  
  // Recent Trips (denormalized, last 3 for dashboard)
  recentTrips: RecentTripSummary[];  // Max 3 items, FIFO
  
  // Push notification tokens
  fcmTokens: string[];
  
  // Settings
  settings: UserSettings;
  
  // Audit
  createdBy: string;
  updatedBy: string;
}

/**
 * Partial user document for updates
 */
export type UserDocumentUpdate = Partial<Omit<UserDocument, 'uid' | 'createdAt' | 'createdBy'>>;

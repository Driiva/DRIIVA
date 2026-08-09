/**
 * FIRESTORE DATA MODEL TYPES
 * ==========================
 * Complete TypeScript definitions for Driiva's Firestore schema.
 * 
 * Collections:
 *   - users/{userId}           → Driver profile + dashboard data
 *   - trips/{tripId}           → Trip metadata + scores
 *   - tripPoints/{tripId}      → Raw GPS points
 *   - policies/{policyId}      → Insurance policy metadata
 *   - communityPool/{poolId}   → Global pool state (singleton)
 *   - poolShares/{shareId}     → Per-driver pool share snapshots
 *   - leaderboard/{period}     → Precomputed rankings
 */

import { Timestamp as FirebaseTimestamp } from 'firebase/firestore';

// Re-export Timestamp for convenience
export type Timestamp = FirebaseTimestamp;

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const COLLECTION_NAMES = {
  USERS: 'users',
  TRIPS: 'trips',
  TRIP_POINTS: 'tripPoints',
  TRIP_SEGMENTS: 'tripSegments',   // Stop-Go-Classifier output
  DRIVER_STATS: 'driver_stats',    // Aggregated per-user stats (server-written only)
  POLICIES: 'policies',
  COMMUNITY_POOL: 'communityPool',
  POOL_SHARES: 'poolShares',
  LEADERBOARD: 'leaderboard',
  COUNTERS: 'counters',
} as const;

export type RiskTier = 'low' | 'medium' | 'high';
export type PolicyStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended';
export type CoverageType = 'basic' | 'standard' | 'premium';
export type TripStatus = 'recording' | 'processing' | 'completed' | 'failed' | 'disputed';
export type PoolShareStatus = 'active' | 'finalized' | 'paid_out';
export type LeaderboardPeriodType = 'weekly' | 'monthly' | 'all_time';
export type PlaceType = 'home' | 'work' | 'other' | null;
export type UnitSystem = 'imperial' | 'metric';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

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
  totalMiles: number;             // stored as integer (miles * 100 for precision)
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

// ============================================================================
// TRIPS COLLECTION
// ============================================================================

/**
 * Location data with optional geocoding
 */
export interface TripLocation {
  lat: number;
  lng: number;
  address: string | null;         // Reverse geocoded
  placeType: PlaceType;
}

/**
 * Driving events captured during trip
 */
export interface TripEvents {
  hardBrakingCount: number;
  hardAccelerationCount: number;
  speedingSeconds: number;        // Total time over limit
  sharpTurnCount: number;
  phonePickupCount: number;
}

/**
 * Anomaly detection flags
 */
export interface TripAnomalyFlags {
  hasGpsJumps: boolean;
  hasImpossibleSpeed: boolean;
  isDuplicate: boolean;
  flaggedForReview: boolean;
}

/**
 * Trip context (enriched by Cloud Function)
 */
export interface TripContext {
  weatherCondition: string | null;
  isNightDriving: boolean;
  isRushHour: boolean;
}

/**
 * Trip document - immutable after completion
 * Collection: trips/{tripId}
 * Document ID: Auto-generated
 */
export interface TripDocument {
  tripId: string;
  userId: string;                   // Foreign key to users
  
  // Temporal
  startedAt: Timestamp;
  endedAt: Timestamp;
  durationSeconds: number;
  
  // Spatial
  startLocation: TripLocation;
  endLocation: TripLocation;
  distanceMeters: number;           // Integer for precision
  
  // Scoring (immutable after calculation)
  score: number;                    // 0-100 composite
  scoreBreakdown: ScoreBreakdown;
  
  // Event Counts
  events: TripEvents;
  
  // Anomaly Flags (set by Cloud Function)
  anomalies: TripAnomalyFlags;
  
  // Processing State
  status: TripStatus;
  processedAt: Timestamp | null;
  
  // Weather/Context (enriched by Cloud Function)
  context: TripContext | null;
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  pointsCount: number;              // Reference count for tripPoints
}

/**
 * Input for creating a new trip
 */
export interface TripCreateInput {
  userId: string;
  startedAt: Timestamp;
  endedAt: Timestamp;
  startLocation: TripLocation;
  endLocation: TripLocation;
  distanceMeters: number;
  durationSeconds: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  events: TripEvents;
  pointsCount: number;
  createdBy: string;
}

// ============================================================================
// TRIP POINTS COLLECTION
// ============================================================================

/**
 * Single GPS/sensor data point (compressed format)
 */
export interface TripPoint {
  t: number;                      // Timestamp offset in ms from trip start
  lat: number;
  lng: number;
  spd: number;                    // Speed in m/s * 100 (integer)
  hdg: number;                    // Heading 0-360
  acc: number;                    // Accuracy in meters
  
  // Optional sensor data
  ax?: number;                    // Accelerometer X
  ay?: number;                    // Accelerometer Y
  az?: number;                    // Accelerometer Z
  gx?: number;                    // Gyroscope X
  gy?: number;                    // Gyroscope Y
  gz?: number;                    // Gyroscope Z
}

/**
 * Trip points document (for trips < 30 min / ~1800 points)
 * Collection: tripPoints/{tripId}
 */
export interface TripPointsDocument {
  tripId: string;
  userId: string;
  
  points: TripPoint[];
  
  // Metadata
  samplingRateHz: number;
  totalPoints: number;
  compressedSize: number;           // For monitoring
  
  createdAt: Timestamp;
}

/**
 * Trip points batch (for longer trips)
 * Collection: tripPoints/{tripId}/batches/{batchIndex}
 */
export interface TripPointsBatch {
  tripId: string;
  batchIndex: number;               // 0, 1, 2...
  startOffset: number;              // First point's timestamp offset
  endOffset: number;                // Last point's timestamp offset
  points: TripPoint[];
}

// ============================================================================
// POLICIES COLLECTION
// ============================================================================

/**
 * Coverage details for policy
 */
export interface CoverageDetails {
  liabilityLimitCents: number;
  collisionDeductibleCents: number;
  comprehensiveDeductibleCents: number;
  includesRoadside: boolean;
  includesRental: boolean;
}

/**
 * Vehicle information
 */
export interface VehicleInfo {
  vin: string | null;
  make: string;
  model: string;
  year: number;
  color: string | null;
}

/**
 * Policy document
 * Collection: policies/{policyId}
 * Document ID: Auto-generated or external policy number
 */
export interface PolicyDocument {
  policyId: string;
  userId: string;
  
  // Policy Details
  policyNumber: string;             // External reference
  status: PolicyStatus;
  
  coverageType: CoverageType;
  coverageDetails: CoverageDetails;
  
  // Financial
  basePremiumCents: number;         // Before telematics discount
  currentPremiumCents: number;      // After discount
  discountPercentage: number;       // 0-30 typically
  
  // Dates
  effectiveDate: Timestamp;
  expirationDate: Timestamp;
  renewalDate: Timestamp | null;
  
  // Vehicle (if applicable)
  vehicle: VehicleInfo | null;
  
  // Billing
  billingCycle: BillingCycle;
  stripeSubscriptionId: string | null;
  
  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

// ============================================================================
// COMMUNITY POOL COLLECTION
// ============================================================================

/**
 * Community pool document (singleton)
 * Collection: communityPool
 * Document ID: "current"
 */
export interface CommunityPoolDocument {
  poolId: string;
  
  // Financial State
  totalPoolCents: number;           // Total funds in pool
  totalContributionsCents: number;  // Lifetime contributions
  totalPayoutsCents: number;        // Lifetime claims paid
  reserveCents: number;             // Safety reserve
  
  // Participation
  activeParticipants: number;
  totalParticipantsEver: number;
  
  // Risk Metrics
  averagePoolScore: number;         // Weighted by contribution
  safetyFactor: number;             // Multiplier for refund calc
  claimsThisPeriod: number;
  
  // Period
  periodStart: Timestamp;
  periodEnd: Timestamp;
  periodType: 'monthly' | 'quarterly';
  
  // Calculated at period end
  projectedRefundRate: number;      // 0-1, percentage of eligible refund
  
  // Metadata
  lastCalculatedAt: Timestamp;
  version: number;                  // Optimistic locking
}

// ============================================================================
// POOL SHARES COLLECTION
// ============================================================================

/**
 * Individual driver's pool share
 * Collection: poolShares/{shareId}
 * Document ID: {poolPeriod}_{userId} (e.g., "2026-02_user123")
 */
export interface PoolShareDocument {
  shareId: string;
  poolPeriod: string;               // "2026-02" format
  userId: string;
  
  // Contribution
  contributionCents: number;        // User's total into pool this period
  contributionCount: number;        // Number of payments
  
  // Calculated Share
  sharePercentage: number;          // Their % of total pool (4 decimals)
  weightedScore: number;            // Score * contribution weight
  
  // Projected Refund
  baseRefundCents: number;          // Before safety factor
  projectedRefundCents: number;     // After safety factor
  
  // Status
  status: PoolShareStatus;
  eligibleForRefund: boolean;       // False if claims filed
  
  // Audit
  tripsIncluded: number;            // Trips counted this period
  milesIncluded: number;
  averageScore: number;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  finalizedAt: Timestamp | null;
}

// ============================================================================
// LEADERBOARD COLLECTION
// ============================================================================

/**
 * Individual ranking entry
 */
export interface LeaderboardRanking {
  rank: number;
  userId: string;
  displayName: string;
  photoURL: string | null;
  score: number;
  totalMiles: number;
  totalTrips: number;
  change: number;                 // Position change from last period
}

/**
 * Leaderboard document (precomputed)
 * Collection: leaderboard/{leaderboardId}
 * Document ID: {period}_{type} (e.g., "2026-02_monthly", "2026-W06_weekly")
 */
export interface LeaderboardDocument {
  leaderboardId: string;
  period: string;
  periodType: LeaderboardPeriodType;
  
  rankings: LeaderboardRanking[];  // Top 100
  
  // Stats
  totalParticipants: number;
  averageScore: number;
  medianScore: number;
  
  // Metadata
  calculatedAt: Timestamp;
  nextCalculationAt: Timestamp;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Firestore converter helper type
 */
export interface FirestoreDataConverter<T> {
  toFirestore(data: T): Record<string, unknown>;
  fromFirestore(snapshot: unknown): T;
}

/**
 * Query filter options
 */
export interface TripQueryOptions {
  userId: string;
  startAfter?: Timestamp;
  endBefore?: Timestamp;
  status?: TripStatus;
  limit?: number;
}

export interface LeaderboardQueryOptions {
  periodType: LeaderboardPeriodType;
  period?: string;
}

// ============================================================================
// AI FEEDBACK EVENTS COLLECTION
// ============================================================================

/**
 * Logged each time the AI driving coach widget fires.
 * Collection: ai_feedback_events/{eventId}
 */
export interface AIFeedbackEvent {
  eventId: string;
  tripId: string;
  userId: string;
  source: 'round_robin' | 'api';
  modelUsed: string | null;
  responseMs: number;
  commentIndex?: number;
  createdAt: Timestamp;
}

// ============================================================================
// REWARD MILESTONES COLLECTION
// ============================================================================

export type RewardStatus = 'locked' | 'unlocked' | 'claimed';

/**
 * Per-user reward milestone state.
 * Collection: users/{userId}/rewardMilestones/{rewardId}
 */
export interface RewardMilestoneDocument {
  rewardId: string;
  userId: string;
  status: RewardStatus;
  unlockedAt: Timestamp | null;
  claimedAt: Timestamp | null;
  redemptionCode: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Default values for new documents
 */
export const DEFAULT_DRIVING_PROFILE: DrivingProfileData = {
  currentScore: 100,
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
};

export const DEFAULT_POOL_SHARE: Omit<PoolShareSummary, 'lastUpdatedAt'> = {
  currentShareCents: 0,
  contributionCents: 0,
  sharePercentage: 0,
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  notificationsEnabled: true,
  autoTripDetection: true,
  unitSystem: 'imperial',
};

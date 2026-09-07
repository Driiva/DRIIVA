/**
 * Query and summary helper types, plus the default documents new records start from.
 * Extracted verbatim from shared/firestore-types.ts, which re-exports this
 * module so every existing import keeps working.
 */

import type { Timestamp } from './timestamp';
import type {
  DrivingProfileData,
  PoolShareSummary,
  UserSettings,
} from './users';
import type {
  LeaderboardPeriodType,
  TripStatus,
} from './enums';

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

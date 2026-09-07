/**
 * The community pool, per-driver pool shares and the leaderboard.
 * Extracted verbatim from shared/firestore-types.ts, which re-exports this
 * module so every existing import keeps working.
 */

import type { Timestamp } from './timestamp';
import type {
  LeaderboardPeriodType,
  PoolShareStatus,
} from './enums';

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

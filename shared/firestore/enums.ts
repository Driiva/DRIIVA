/**
 * Collection names, and the enums every collection type draws on.
 * Extracted verbatim from shared/firestore-types.ts, which re-exports this
 * module so every existing import keeps working.
 */

import type { Timestamp } from './timestamp';

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

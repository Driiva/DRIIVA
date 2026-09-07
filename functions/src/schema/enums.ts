/**
 * Collection names and the enums the document interfaces draw on.
 * Extracted verbatim from functions/src/types.ts, which re-exports this module
 * so every existing import keeps working.
 */


// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const COLLECTION_NAMES = {
  USERS: 'users',
  TRIPS: 'trips',
  TRIP_POINTS: 'tripPoints',
  TRIP_SEGMENTS: 'tripSegments',
  TRIP_AI_INSIGHTS: 'tripAiInsights',
  AI_USAGE_TRACKING: 'aiUsageTracking',
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

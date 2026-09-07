/**
 * Community pool, per-user pool shares and the leaderboard, plus the period
 * helpers they share. Extracted verbatim from client/src/lib/firestore.ts.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  COLLECTION_NAMES,
  CommunityPoolDocument,
  PoolShareDocument,
  LeaderboardDocument,
  LeaderboardQueryOptions,
} from '../../../shared/firestore-types';
import { assertFirestore } from './firestoreClient';

// ============================================================================
// COMMUNITY POOL COLLECTION
// ============================================================================

const POOL_DOC_ID = 'current';

/**
 * Get community pool state
 */
export async function getCommunityPool(): Promise<CommunityPoolDocument | null> {
  assertFirestore();
  
  const poolRef = doc(db!, COLLECTION_NAMES.COMMUNITY_POOL, POOL_DOC_ID);
  const snapshot = await getDoc(poolRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data() as CommunityPoolDocument;
}

/**
 * Initialize community pool (admin only)
 */
export async function initializeCommunityPool(
  periodType: 'monthly' | 'quarterly' = 'monthly'
): Promise<void> {
  assertFirestore();
  
  const now = Timestamp.now();
  const { start, end } = getPoolPeriodDates(periodType);
  
  const poolData: CommunityPoolDocument = {
    poolId: POOL_DOC_ID,
    totalPoolCents: 0,
    totalContributionsCents: 0,
    totalPayoutsCents: 0,
    reserveCents: 0,
    activeParticipants: 0,
    totalParticipantsEver: 0,
    averagePoolScore: 100,
    safetyFactor: 1.0,
    claimsThisPeriod: 0,
    periodStart: start,
    periodEnd: end,
    periodType,
    projectedRefundRate: 0.15, // 15% default
    lastCalculatedAt: now,
    version: 1,
  };
  
  const poolRef = doc(db!, COLLECTION_NAMES.COMMUNITY_POOL, POOL_DOC_ID);
  await setDoc(poolRef, poolData);
}

// ============================================================================
// POOL SHARES COLLECTION
// ============================================================================

/**
 * Get share ID for a user and period
 */
export function getShareId(userId: string, period: string): string {
  return `${period}_${userId}`;
}

/**
 * Get current pool period string (e.g., "2026-02")
 */
export function getCurrentPoolPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get pool period date range
 */
function getPoolPeriodDates(periodType: 'monthly' | 'quarterly'): {
  start: Timestamp;
  end: Timestamp;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  let startDate: Date;
  let endDate: Date;
  
  if (periodType === 'monthly') {
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  } else {
    const quarter = Math.floor(month / 3);
    startDate = new Date(year, quarter * 3, 1);
    endDate = new Date(year, (quarter + 1) * 3, 0, 23, 59, 59, 999);
  }
  
  return {
    start: Timestamp.fromDate(startDate),
    end: Timestamp.fromDate(endDate),
  };
}

/**
 * Initialize pool share for a user
 */
export async function initializePoolShare(
  userId: string,
  period: string = getCurrentPoolPeriod()
): Promise<void> {
  assertFirestore();
  
  const shareId = getShareId(userId, period);
  const shareRef = doc(db!, COLLECTION_NAMES.POOL_SHARES, shareId);
  
  const existingShare = await getDoc(shareRef);
  if (existingShare.exists()) {
    return; // Already initialized
  }
  
  const now = Timestamp.now();
  
  const shareData: PoolShareDocument = {
    shareId,
    poolPeriod: period,
    userId,
    contributionCents: 0,
    contributionCount: 0,
    sharePercentage: 0,
    weightedScore: 0,
    baseRefundCents: 0,
    projectedRefundCents: 0,
    status: 'active',
    eligibleForRefund: true,
    tripsIncluded: 0,
    milesIncluded: 0,
    averageScore: 100,
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
  };
  
  await setDoc(shareRef, shareData);
}

/**
 * Get user's pool share for current period
 */
export async function getUserPoolShare(
  userId: string,
  period: string = getCurrentPoolPeriod()
): Promise<PoolShareDocument | null> {
  assertFirestore();
  
  const shareId = getShareId(userId, period);
  const shareRef = doc(db!, COLLECTION_NAMES.POOL_SHARES, shareId);
  const snapshot = await getDoc(shareRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data() as PoolShareDocument;
}

/**
 * Get user's pool share history
 */
export async function getUserPoolShareHistory(
  userId: string,
  limitCount: number = 12
): Promise<PoolShareDocument[]> {
  assertFirestore();
  
  const sharesRef = collection(db!, COLLECTION_NAMES.POOL_SHARES);
  const q = query(
    sharesRef,
    where('userId', '==', userId),
    orderBy('poolPeriod', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as PoolShareDocument);
}

// ============================================================================
// LEADERBOARD COLLECTION
// ============================================================================

/**
 * Get leaderboard for a period type
 */
export async function getLeaderboard(
  options: LeaderboardQueryOptions
): Promise<LeaderboardDocument | null> {
  assertFirestore();
  
  const period = options.period || getCurrentPeriodForType(options.periodType);
  const leaderboardId = `${period}_${options.periodType}`;
  
  const leaderboardRef = doc(db!, COLLECTION_NAMES.LEADERBOARD, leaderboardId);
  const snapshot = await getDoc(leaderboardRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data() as LeaderboardDocument;
}

/**
 * Get period string for leaderboard type
 */
function getCurrentPeriodForType(periodType: string): string {
  const now = new Date();
  
  switch (periodType) {
    case 'weekly': {
      const weekNum = getWeekNumber(now);
      return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }
    case 'monthly':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    case 'all_time':
      return 'all_time';
    default:
      return getCurrentPoolPeriod();
  }
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

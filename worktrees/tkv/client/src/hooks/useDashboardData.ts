/**
 * DASHBOARD DATA HOOK
 * ===================
 * Real-time Firestore subscription for dashboard data.
 * 
 * Subscribes to:
 *   - users/{userId} (driving profile, recent trips, pool share)
 *   - trips where userId = userId, ordered by startedAt desc, limit 3
 *   - policies where userId = userId and status = 'active'
 *   - communityPool/current (global pool state)
 * 
 * Returns a unified data object optimized for the dashboard UI.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import {
  COLLECTION_NAMES,
  UserDocument,
  TripDocument,
  PolicyDocument,
  CommunityPoolDocument,
  DrivingProfileData,
  ActivePolicySummary,
  PoolShareSummary,
  RecentTripSummary,
  DEFAULT_DRIVING_PROFILE,
  DEFAULT_POOL_SHARE,
} from '../../../shared/firestore-types';

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardTrip {
  id: string;
  from: string;
  to: string;
  score: number;
  distance: number; // miles
  date: string;     // formatted date
  duration: number; // minutes
}

export interface DashboardData {
  // User Profile
  displayName: string;
  photoURL: string | null;
  
  // Driving Stats
  drivingScore: number;
  scoreBreakdown: {
    speed: number;
    braking: number;
    acceleration: number;
    cornering: number;
    phoneUsage: number;
  };
  totalTrips: number;
  totalMiles: number;
  totalMinutes: number;
  streakDays: number;
  riskTier: 'low' | 'medium' | 'high';
  
  // Recent Trips
  trips: DashboardTrip[];
  
  // Policy
  hasActivePolicy: boolean;
  policyNumber: string | null;
  premiumAmount: number; // in pounds/dollars
  coverageType: string | null;
  renewalDate: Date | null;
  
  // Community Pool
  poolTotal: number;        // in pounds/dollars
  poolShare: number;        // user's projected refund
  poolContribution: number; // user's total contribution
  sharePercentage: number;
  safetyFactor: number;
  activeParticipants: number;
  
  // Computed
  projectedRefund: number;
}

export interface UseDashboardDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

// ============================================================================
// DEFAULT DATA
// ============================================================================

const DEFAULT_DASHBOARD_DATA: DashboardData = {
  displayName: 'Driver',
  photoURL: null,
  drivingScore: 100,
  scoreBreakdown: {
    speed: 100,
    braking: 100,
    acceleration: 100,
    cornering: 100,
    phoneUsage: 100,
  },
  totalTrips: 0,
  totalMiles: 0,
  totalMinutes: 0,
  streakDays: 0,
  riskTier: 'low',
  trips: [],
  hasActivePolicy: false,
  policyNumber: null,
  premiumAmount: 0,
  coverageType: null,
  renewalDate: null,
  poolTotal: 0,
  poolShare: 0,
  poolContribution: 0,
  sharePercentage: 0,
  safetyFactor: 1.0,
  activeParticipants: 0,
  projectedRefund: 0,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a Firestore timestamp to a readable date string
 */
function formatTripDate(timestamp: Timestamp | null): string {
  if (!timestamp) return 'Unknown';
  const date = timestamp.toDate();
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Convert TripDocument to DashboardTrip
 */
function tripToDisplayTrip(trip: TripDocument): DashboardTrip {
  const distanceMiles = trip.distanceMeters / 1609.34;
  const durationMinutes = trip.durationSeconds / 60;
  
  // Build route summary
  const fromLabel = trip.startLocation.placeType 
    ? capitalizeFirst(trip.startLocation.placeType)
    : truncateAddress(trip.startLocation.address);
  const toLabel = trip.endLocation.placeType
    ? capitalizeFirst(trip.endLocation.placeType)
    : truncateAddress(trip.endLocation.address);
  
  return {
    id: trip.tripId,
    from: fromLabel,
    to: toLabel,
    score: Math.round(trip.score),
    distance: Math.round(distanceMiles * 10) / 10,
    date: formatTripDate(trip.endedAt),
    duration: Math.round(durationMinutes),
  };
}

/**
 * Convert RecentTripSummary to DashboardTrip
 */
function summaryToDisplayTrip(summary: RecentTripSummary): DashboardTrip {
  return {
    id: summary.tripId,
    from: summary.routeSummary.split(' → ')[0] || 'Unknown',
    to: summary.routeSummary.split(' → ')[1] || 'Unknown',
    score: Math.round(summary.score),
    distance: Math.round(summary.distanceMiles * 10) / 10,
    date: formatTripDate(summary.endedAt),
    duration: Math.round(summary.durationMinutes),
  };
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncateAddress(address: string | null): string {
  if (!address) return 'Unknown';
  const parts = address.split(',');
  const firstPart = parts[0].trim();
  return firstPart.length > 15 ? firstPart.substring(0, 12) + '...' : firstPart;
}

/**
 * Calculate projected refund based on score and premium
 */
function calculateProjectedRefund(score: number, premiumCents: number): number {
  if (score < 70) return 0;
  const scoreRange = Math.max(0, score - 70);
  const baseRefund = 5;
  const additionalRefund = (scoreRange / 30) * 10;
  const totalPercentage = Math.min(baseRefund + additionalRefund, 15);
  return Math.round((totalPercentage / 100) * (premiumCents / 100));
}

// ============================================================================
// HOOK
// ============================================================================

export function useDashboardData(userId: string | null): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Internal state for combining multiple subscriptions
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [trips, setTrips] = useState<TripDocument[]>([]);
  const [policy, setPolicy] = useState<PolicyDocument | null>(null);
  const [pool, setPool] = useState<CommunityPoolDocument | null>(null);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Subscribe to all data sources
  useEffect(() => {
    if (!userId || !isFirebaseConfigured || !db) {
      setLoading(false);
      setData(DEFAULT_DASHBOARD_DATA);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribes: Unsubscribe[] = [];

    try {
      // 1. Subscribe to user document (has denormalized dashboard data)
      const userRef = doc(db, COLLECTION_NAMES.USERS, userId);
      unsubscribes.push(
        onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setUserDoc(snapshot.data() as UserDocument);
            } else {
              setUserDoc(null);
            }
          },
          (err) => {
            console.error('[useDashboardData] User subscription error:', err);
            setError(err);
          }
        )
      );

      // 2. Subscribe to recent trips (last 3, completed)
      const tripsRef = collection(db, COLLECTION_NAMES.TRIPS);
      const tripsQuery = query(
        tripsRef,
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('endedAt', 'desc'),
        limit(3)
      );
      unsubscribes.push(
        onSnapshot(
          tripsQuery,
          (snapshot) => {
            const tripDocs = snapshot.docs.map(doc => doc.data() as TripDocument);
            setTrips(tripDocs);
          },
          (err) => {
            console.error('[useDashboardData] Trips subscription error:', err);
            // Non-critical, continue with empty trips
          }
        )
      );

      // 3. Subscribe to active policy
      const policiesRef = collection(db, COLLECTION_NAMES.POLICIES);
      const policyQuery = query(
        policiesRef,
        where('userId', '==', userId),
        where('status', '==', 'active'),
        limit(1)
      );
      unsubscribes.push(
        onSnapshot(
          policyQuery,
          (snapshot) => {
            if (!snapshot.empty) {
              setPolicy(snapshot.docs[0].data() as PolicyDocument);
            } else {
              setPolicy(null);
            }
          },
          (err) => {
            console.error('[useDashboardData] Policy subscription error:', err);
            // Non-critical
          }
        )
      );

      // 4. Subscribe to community pool
      const poolRef = doc(db, COLLECTION_NAMES.COMMUNITY_POOL, 'current');
      unsubscribes.push(
        onSnapshot(
          poolRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setPool(snapshot.data() as CommunityPoolDocument);
            } else {
              setPool(null);
            }
          },
          (err) => {
            console.error('[useDashboardData] Pool subscription error:', err);
            // Non-critical
          }
        )
      );

    } catch (err) {
      console.error('[useDashboardData] Setup error:', err);
      setError(err instanceof Error ? err : new Error('Failed to setup subscriptions'));
      setLoading(false);
    }

    // Cleanup subscriptions
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [userId, refreshKey]);

  // Combine all data sources into dashboard data
  useEffect(() => {
    // Wait for initial user doc load
    if (loading && !userDoc && userId && isFirebaseConfigured) {
      return;
    }

    const profile = userDoc?.drivingProfile || DEFAULT_DRIVING_PROFILE;
    const poolShare = userDoc?.poolShare || { ...DEFAULT_POOL_SHARE, lastUpdatedAt: Timestamp.now() };
    
    // Prefer denormalized recent trips from user doc, fall back to queried trips
    const recentTrips = userDoc?.recentTrips && userDoc.recentTrips.length > 0
      ? userDoc.recentTrips.map(summaryToDisplayTrip)
      : trips.map(tripToDisplayTrip);

    // Calculate premium in pounds (from cents)
    const premiumPounds = policy?.currentPremiumCents 
      ? policy.currentPremiumCents / 100 
      : (userDoc?.activePolicy?.premiumCents || 0) / 100;

    // Calculate projected refund
    const projectedRefund = calculateProjectedRefund(
      profile.currentScore,
      policy?.currentPremiumCents || userDoc?.activePolicy?.premiumCents || 0
    );

    const dashboardData: DashboardData = {
      // User Profile
      displayName: userDoc?.displayName || 'Driver',
      photoURL: userDoc?.photoURL || null,
      
      // Driving Stats
      drivingScore: Math.round(profile.currentScore),
      scoreBreakdown: {
        speed: Math.round(profile.scoreBreakdown.speedScore),
        braking: Math.round(profile.scoreBreakdown.brakingScore),
        acceleration: Math.round(profile.scoreBreakdown.accelerationScore),
        cornering: Math.round(profile.scoreBreakdown.corneringScore),
        phoneUsage: Math.round(profile.scoreBreakdown.phoneUsageScore),
      },
      totalTrips: profile.totalTrips,
      totalMiles: Math.round(profile.totalMiles),
      totalMinutes: Math.round(profile.totalDrivingMinutes),
      streakDays: profile.streakDays,
      riskTier: profile.riskTier,
      
      // Recent Trips
      trips: recentTrips,
      
      // Policy
      hasActivePolicy: !!policy || !!userDoc?.activePolicy,
      policyNumber: policy?.policyNumber || null,
      premiumAmount: premiumPounds,
      coverageType: policy?.coverageType || userDoc?.activePolicy?.coverageType || null,
      renewalDate: policy?.renewalDate?.toDate() || userDoc?.activePolicy?.renewalDate?.toDate() || null,
      
      // Community Pool
      poolTotal: pool ? pool.totalPoolCents / 100 : 0,
      poolShare: poolShare.currentShareCents / 100,
      poolContribution: poolShare.contributionCents / 100,
      sharePercentage: poolShare.sharePercentage,
      safetyFactor: pool?.safetyFactor || 1.0,
      activeParticipants: pool?.activeParticipants || 0,
      
      // Computed
      projectedRefund,
    };

    setData(dashboardData);
    setLoading(false);
  }, [userDoc, trips, policy, pool, userId, loading]);

  return { data, loading, error, refresh };
}

export default useDashboardData;

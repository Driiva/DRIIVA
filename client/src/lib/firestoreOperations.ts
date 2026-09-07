/**
 * Callable-backed operations: trip completion and pool contribution, GDPR
 * export/erasure, AI trip analysis and achievements. Everything here goes
 * through a Cloud Function because security rules forbid the client write.
 * Extracted verbatim from client/src/lib/firestore.ts.
 */

import {
  collection,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  COLLECTION_NAMES,
  TripDocument,
} from '../../../shared/firestore-types';
import { assertFirestore } from './firestoreClient';

// ============================================================================
// TRANSACTIONAL OPERATIONS
// ============================================================================

/**
 * Complete a trip and update all related documents atomically
 * 
 * NOTE: This operation is handled entirely by Cloud Functions (onTripStatusChange trigger).
 * The client cannot perform this operation because Firestore security rules forbid:
 *   - Client updates to trips (`allow update: if false`)
 *   - Client writes to poolShares (`allow write: if false`)
 *   - Client writes to communityPool (`allow write: if false`)
 * 
 * Trip completion flow:
 *   1. Client creates trip with status 'recording'
 *   2. Client updates status to 'processing' when trip ends (via tripService.endTrip)
 *   3. Cloud Function (onTripStatusChange) detects the change and:
 *      - Computes metrics from GPS points
 *      - Updates trip with scores and metrics
 *      - Sets final status ('completed' or 'processing' if flagged)
 *      - Updates user profile and pool share transactionally
 * 
 * @deprecated This function cannot work with current security rules.
 * Trip completion is handled automatically by Cloud Functions.
 */
export async function completeTripTransaction(
  _tripId: string,
  _tripData: TripDocument
): Promise<void> {
  throw new Error(
    'completeTripTransaction cannot be called from the client. ' +
    'Trip completion is handled automatically by Cloud Functions when the trip ' +
    'status changes to "processing". Security rules prevent client-side updates to ' +
    'trips, poolShares, and communityPool collections.'
  );
}

/**
 * Add contribution to pool (payment processed)
 * 
 * NOTE: This function calls a Cloud Function because Firestore security rules
 * prevent client-side writes to communityPool and poolShares collections.
 * These collections are managed exclusively by Cloud Functions (admin SDK).
 */
export async function addPoolContribution(
  userId: string,
  amountCents: number
): Promise<{ success: boolean; newContributionCents: number; sharePercentage: number }> {
  assertFirestore();
  
  // Import Firebase Functions dynamically to avoid circular dependencies
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  
  const addContribution = httpsCallable<
    { amountCents: number },
    { success: boolean; newContributionCents: number; sharePercentage: number }
  >(functions, 'addPoolContribution');
  
  const result = await addContribution({ amountCents });
  return result.data;
}

/** Payload returned by exportUserData callable (GDPR data portability) */
export interface ExportUserDataPayload {
  exportedAt: string;
  userId: string;
  user: Record<string, unknown> | null;
  trips: Record<string, unknown>[];
  tripPoints: Record<string, unknown>[];
  tripSegments: Record<string, unknown>[];
  policies: Record<string, unknown>[];
  poolShares: Record<string, unknown>[];
  driver_stats: Record<string, unknown> | null;
}

/**
 * Export all user data as JSON (GDPR right to data portability).
 * Calls Cloud Function exportUserData; caller must pass authenticated user's uid.
 */
export async function exportUserData(userId: string): Promise<ExportUserDataPayload> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<{ userId: string }, ExportUserDataPayload>(functions, 'exportUserData');
  const result = await fn({ userId });
  return result.data;
}

/**
 * Permanently delete user account and all associated data (GDPR right to erasure).
 * Calls Cloud Function deleteUserAccount; then caller should sign out and redirect.
 */
export async function deleteUserAccount(userId: string): Promise<{ success: boolean; message: string }> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<{ userId: string }, { success: boolean; message: string }>(functions, 'deleteUserAccount');
  const result = await fn({ userId });
  return result.data;
}

// ============================================================================
// AI TRIP ANALYSIS
// ============================================================================

/** Response from the analyzeTripAI Cloud Function */
export interface AnalyzeTripAIResponse {
  success: boolean;
  insightId?: string;
  cached?: boolean;
  message?: string;
  error?: string;
}

/** Specific incident flagged by AI */
export interface TripAIIncident {
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

/** Driving pattern detected by AI */
export interface TripAIPattern {
  category: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  scoreImpact: number;
}

/** AI insight document returned from getAIInsights Cloud Function */
export interface TripAIInsight {
  tripId: string;
  userId: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  strengths: string[];
  improvements: string[];
  specificIncidents: TripAIIncident[];
  patterns: TripAIPattern[];
  safetyTips: string[];
  comparisonToAverage: string;
  scoreAdjustment: {
    originalScore: number;
    adjustedScore: number;
    delta: number;
    reasoning: string;
    confidence: number;
  };
  contextFactors: {
    timeOfDay: string;
    dayOfWeek: string;
    isNightDriving: boolean;
    isRushHour: boolean;
    estimatedRoadType: string;
    weatherConsideration: string | null;
  };
  historicalComparison: {
    vsAverageScore: number;
    trendDirection: 'improving' | 'stable' | 'declining';
    consistencyNote: string;
  };
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  analyzedAt: string | null;
  createdAt: string | null;
}

/**
 * Request on-demand AI analysis for a completed trip.
 * Calls the analyzeTripAI Cloud Function.
 */
export async function requestTripAIAnalysis(tripId: string): Promise<AnalyzeTripAIResponse> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<{ tripId: string }, AnalyzeTripAIResponse>(functions, 'analyzeTripAI');
  const result = await fn({ tripId });
  return result.data;
}

/**
 * Fetch AI insights for a trip.
 * Calls the getAIInsights Cloud Function.
 */
export async function fetchTripAIInsights(tripId: string): Promise<TripAIInsight | null> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<{ tripId: string }, { success: boolean; insights: TripAIInsight | null }>(
    functions,
    'getAIInsights'
  );
  const result = await fn({ tripId });
  return result.data.insights;
}


// ============================================================================
// ACHIEVEMENTS
// ============================================================================

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'safety' | 'community' | 'milestone' | 'refund';
  points: number;
  maxProgress: number | null;
}

export interface UserAchievementRecord {
  achievementId: string;
  unlockedAt: Timestamp;
  tripId: string | null;
}

/**
 * Fetch all achievement definitions from the achievements collection.
 */
export async function getAchievementDefinitions(): Promise<AchievementDef[]> {
  assertFirestore();
  const snapshot = await getDocs(collection(db!, 'achievements'));
  return snapshot.docs.map(d => d.data() as AchievementDef);
}

/**
 * Fetch achievements unlocked by a specific user.
 */
export async function getUserAchievements(userId: string): Promise<UserAchievementRecord[]> {
  assertFirestore();
  const userAchRef = collection(db!, COLLECTION_NAMES.USERS, userId, 'achievements');
  const snapshot = await getDocs(userAchRef);
  return snapshot.docs.map(d => d.data() as UserAchievementRecord);
}

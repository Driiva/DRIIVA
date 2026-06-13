/**
 * FIRESTORE SERVICE LAYER
 * =======================
 * CRUD operations and queries for Driiva's Firestore data model.
 * 
 * Features:
 *   - Type-safe document operations
 *   - Transactional updates for consistency
 *   - Optimized queries for dashboard reads
 *   - Audit trail support
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  serverTimestamp,
  Timestamp,
  DocumentReference,
  QueryConstraint,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  COLLECTION_NAMES,
  UserDocument,
  UserDocumentUpdate,
  TripDocument,
  TripCreateInput,
  TripPointsDocument,
  TripPoint,
  PolicyDocument,
  CommunityPoolDocument,
  PoolShareDocument,
  LeaderboardDocument,
  RecentTripSummary,
  DrivingProfileData,
  TripQueryOptions,
  LeaderboardQueryOptions,
  DEFAULT_DRIVING_PROFILE,
  DEFAULT_POOL_SHARE,
  DEFAULT_USER_SETTINGS,
  TripStatus,
  PoolShareSummary,
  BetaEstimateDocument,
} from '../../../shared/firestore-types';

// ============================================================================
// FIRESTORE INSTANCE CHECK
// ============================================================================

function assertFirestore(): void {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore is not configured. Check Firebase environment variables.');
  }
}

// ============================================================================
// USERS COLLECTION
// ============================================================================

/**
 * Get a user document by ID
 */
export async function getUser(userId: string): Promise<UserDocument | null> {
  assertFirestore();
  
  const userRef = doc(db!, COLLECTION_NAMES.USERS, userId);
  const snapshot = await getDoc(userRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data() as UserDocument;
}

/**
 * Create a new user document after Firebase Auth signup
 */
export async function createUser(
  userId: string,
  email: string,
  displayName: string,
  photoURL: string | null = null
): Promise<UserDocument> {
  assertFirestore();
  
  const now = Timestamp.now();
  const currentPeriod = getCurrentPoolPeriod();
  
  const userData: UserDocument = {
    uid: userId,
    email,
    displayName,
    photoURL,
    phoneNumber: null,
    createdAt: now,
    updatedAt: now,
    
    drivingProfile: { ...DEFAULT_DRIVING_PROFILE },
    activePolicy: null,
    poolShare: {
      ...DEFAULT_POOL_SHARE,
      lastUpdatedAt: now,
    },
    recentTrips: [],
    fcmTokens: [],
    settings: { ...DEFAULT_USER_SETTINGS },
    
    createdBy: userId,
    updatedBy: userId,
  };
  
  const userRef = doc(db!, COLLECTION_NAMES.USERS, userId);
  await setDoc(userRef, userData);
  
  // Also initialize their pool share for the current period
  await initializePoolShare(userId, currentPeriod);
  
  return userData;
}

/**
 * Update user document fields
 */
export async function updateUser(
  userId: string,
  updates: UserDocumentUpdate
): Promise<void> {
  assertFirestore();
  
  const userRef = doc(db!, COLLECTION_NAMES.USERS, userId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Add FCM token for push notifications
 */
export async function addFcmToken(userId: string, token: string): Promise<void> {
  assertFirestore();
  
  const userRef = doc(db!, COLLECTION_NAMES.USERS, userId);
  await updateDoc(userRef, {
    fcmTokens: arrayUnion(token),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove FCM token
 */
export async function removeFcmToken(userId: string, token: string): Promise<void> {
  assertFirestore();
  
  const userRef = doc(db!, COLLECTION_NAMES.USERS, userId);
  await updateDoc(userRef, {
    fcmTokens: arrayRemove(token),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get user's dashboard data (single read, denormalized)
 */
export async function getUserDashboard(userId: string): Promise<{
  profile: DrivingProfileData;
  policy: UserDocument['activePolicy'];
  poolShare: PoolShareSummary;
  recentTrips: RecentTripSummary[];
} | null> {
  const user = await getUser(userId);
  
  if (!user) {
    return null;
  }
  
  return {
    profile: user.drivingProfile,
    policy: user.activePolicy,
    poolShare: user.poolShare,
    recentTrips: user.recentTrips,
  };
}

// ============================================================================
// BETA PRICING (users/{userId}/betaPricing/currentEstimate)
// ============================================================================

const BETA_PRICING_SUBCOLLECTION = 'betaPricing';
const BETA_ESTIMATE_DOC_ID = 'currentEstimate';

/**
 * Reference to the user's current beta estimate document.
 */
export function getBetaEstimateRef(userId: string): DocumentReference<BetaEstimateDocument> {
  assertFirestore();
  return doc(
    db!,
    COLLECTION_NAMES.USERS,
    userId,
    BETA_PRICING_SUBCOLLECTION,
    BETA_ESTIMATE_DOC_ID
  ) as DocumentReference<BetaEstimateDocument>;
}

/**
 * Subscribe to the user's beta estimate document (real-time).
 */
export function subscribeBetaEstimate(
  userId: string,
  onData: (data: BetaEstimateDocument | null) => void,
  onError: (err: Error) => void
): () => void {
  assertFirestore();
  const ref = getBetaEstimateRef(userId);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as BetaEstimateDocument) : null);
    },
    (err) => onError(err as Error)
  );
}

/** Result of calculateBetaEstimateForUser callable */
export interface CalculateBetaEstimateResult {
  success: boolean;
  message?: string;
  estimate?: {
    estimatedPremium: number;
    minPremium: number;
    maxPremium: number;
    refundRate: number;
    estimatedRefund: number;
    estimatedNetCost: number;
  };
}

/**
 * Request backend to compute and persist beta estimate for the current user.
 * Call when the estimate doc is missing or user wants to refresh.
 */
export async function calculateBetaEstimateForUser(
  userId: string
): Promise<CalculateBetaEstimateResult> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<{ userId?: string }, CalculateBetaEstimateResult>(
    functions,
    'calculateBetaEstimateForUser'
  );
  const result = await fn({ userId });
  return result.data;
}

// ============================================================================
// TRIPS COLLECTION
// ============================================================================

/**
 * Create a new trip document
 */
export async function createTrip(input: TripCreateInput): Promise<string> {
  assertFirestore();
  
  const tripsRef = collection(db!, COLLECTION_NAMES.TRIPS);
  const tripRef = doc(tripsRef);
  const tripId = tripRef.id;
  
  const tripData: TripDocument = {
    tripId,
    userId: input.userId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationSeconds: input.durationSeconds,
    startLocation: input.startLocation,
    endLocation: input.endLocation,
    distanceMeters: input.distanceMeters,
    score: input.score,
    scoreBreakdown: input.scoreBreakdown,
    events: input.events,
    anomalies: {
      hasGpsJumps: false,
      hasImpossibleSpeed: false,
      isDuplicate: false,
      flaggedForReview: false,
    },
    status: 'processing',
    processedAt: null,
    context: null,
    createdAt: Timestamp.now(),
    createdBy: input.createdBy,
    pointsCount: input.pointsCount,
  };
  
  await setDoc(tripRef, tripData);
  
  return tripId;
}

/**
 * Get a trip by ID
 */
export async function getTrip(tripId: string): Promise<TripDocument | null> {
  assertFirestore();
  
  const tripRef = doc(db!, COLLECTION_NAMES.TRIPS, tripId);
  const snapshot = await getDoc(tripRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data() as TripDocument;
}

/**
 * Query trips for a user with pagination
 */
export async function getUserTrips(options: TripQueryOptions): Promise<TripDocument[]> {
  assertFirestore();
  
  const constraints: QueryConstraint[] = [
    where('userId', '==', options.userId),
    orderBy('startedAt', 'desc'),
  ];
  
  if (options.status) {
    constraints.push(where('status', '==', options.status));
  }
  
  if (options.startAfter) {
    constraints.push(startAfter(options.startAfter));
  }
  
  constraints.push(limit(options.limit || 20));
  
  const tripsRef = collection(db!, COLLECTION_NAMES.TRIPS);
  const q = query(tripsRef, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data() as TripDocument);
}

/**
 * Update trip status
 * 
 * NOTE: This function calls a Cloud Function because Firestore security rules
 * prevent client-side updates to trip documents (`allow update: if false`).
 * Trip updates are handled exclusively by Cloud Functions using the admin SDK.
 * 
 * For trip cancellation during recording, use the tripService.cancelTrip() function.
 */
export async function updateTripStatus(
  tripId: string,
  status: TripStatus,
  _additionalData?: Partial<TripDocument>
): Promise<void> {
  assertFirestore();
  
  // Security rules prevent direct client updates to trips
  // Only Cloud Functions can update trip status
  if (status === 'failed') {
    // For cancellation, we can use a Cloud Function
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions();
    
    const cancelTripFn = httpsCallable<{ tripId: string }, { success: boolean }>(
      functions,
      'cancelTrip'
    );
    
    await cancelTripFn({ tripId });
    return;
  }
  
  // For other status updates, throw an error - these should go through Cloud Functions
  throw new Error(
    `Cannot update trip status to '${status}' from client. ` +
    `Trip updates must be performed by Cloud Functions. ` +
    `The trip will be automatically processed after creation.`
  );
}

// ============================================================================
// TRIP POINTS COLLECTION
// ============================================================================

/**
 * Save trip GPS/sensor points
 */
export async function saveTripPoints(
  tripId: string,
  userId: string,
  points: TripPoint[],
  samplingRateHz: number = 1
): Promise<void> {
  assertFirestore();
  
  const pointsData: TripPointsDocument = {
    tripId,
    userId,
    points,
    samplingRateHz,
    totalPoints: points.length,
    compressedSize: JSON.stringify(points).length,
    createdAt: Timestamp.now(),
  };
  
  // For trips with many points, batch into multiple documents
  if (points.length > 1000) {
    await saveTripPointsBatched(tripId, userId, points, samplingRateHz);
  } else {
    const pointsRef = doc(db!, COLLECTION_NAMES.TRIP_POINTS, tripId);
    await setDoc(pointsRef, pointsData);
  }
}

/**
 * Save trip points in batches for long trips
 */
async function saveTripPointsBatched(
  tripId: string,
  userId: string,
  points: TripPoint[],
  samplingRateHz: number
): Promise<void> {
  assertFirestore();
  
  const batchSize = 1000;
  const batch = writeBatch(db!);
  
  // Create parent document with metadata only
  const pointsRef = doc(db!, COLLECTION_NAMES.TRIP_POINTS, tripId);
  batch.set(pointsRef, {
    tripId,
    userId,
    points: [], // Empty - points stored in subcollection
    samplingRateHz,
    totalPoints: points.length,
    compressedSize: JSON.stringify(points).length,
    createdAt: Timestamp.now(),
  });
  
  // Create batch documents in subcollection
  for (let i = 0; i < points.length; i += batchSize) {
    const batchPoints = points.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    const batchRef = doc(collection(pointsRef, 'batches'), String(batchIndex));
    
    batch.set(batchRef, {
      tripId,
      batchIndex,
      startOffset: batchPoints[0]?.t ?? 0,
      endOffset: batchPoints[batchPoints.length - 1]?.t ?? 0,
      points: batchPoints,
    });
  }
  
  await batch.commit();
}

/**
 * Get trip points
 */
export async function getTripPoints(tripId: string): Promise<TripPoint[]> {
  assertFirestore();
  
  const pointsRef = doc(db!, COLLECTION_NAMES.TRIP_POINTS, tripId);
  const snapshot = await getDoc(pointsRef);
  
  if (!snapshot.exists()) {
    return [];
  }
  
  const data = snapshot.data() as TripPointsDocument;
  
  // If points are in the main document
  if (data.points.length > 0) {
    return data.points;
  }
  
  // Otherwise, fetch from batches
  const batchesRef = collection(pointsRef, 'batches');
  const batchesSnapshot = await getDocs(query(batchesRef, orderBy('batchIndex')));
  
  const allPoints: TripPoint[] = [];
  batchesSnapshot.docs.forEach(doc => {
    const batch = doc.data();
    allPoints.push(...batch.points);
  });
  
  return allPoints;
}

// ============================================================================
// POLICIES COLLECTION
// ============================================================================

/**
 * Get user's active policy
 */
export async function getUserPolicy(userId: string): Promise<PolicyDocument | null> {
  assertFirestore();
  
  const policiesRef = collection(db!, COLLECTION_NAMES.POLICIES);
  const q = query(
    policiesRef,
    where('userId', '==', userId),
    where('status', '==', 'active'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data() as PolicyDocument;
}

/**
 * Get policy by ID
 */
export async function getPolicy(policyId: string): Promise<PolicyDocument | null> {
  assertFirestore();
  
  const policyRef = doc(db!, COLLECTION_NAMES.POLICIES, policyId);
  const snapshot = await getDoc(policyRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data() as PolicyDocument;
}

/**
 * Create a new policy
 */
export async function createPolicy(
  policyData: Omit<PolicyDocument, 'policyId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  assertFirestore();
  
  const policiesRef = collection(db!, COLLECTION_NAMES.POLICIES);
  const policyRef = doc(policiesRef);
  const policyId = policyRef.id;
  
  const now = Timestamp.now();
  
  await setDoc(policyRef, {
    ...policyData,
    policyId,
    createdAt: now,
    updatedAt: now,
  });
  
  return policyId;
}

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
function getShareId(userId: string, period: string): string {
  return `${period}_${userId}`;
}

/**
 * Get current pool period string (e.g., "2026-02")
 */
function getCurrentPoolPeriod(): string {
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
// INSURANCE (Root Platform)
// ============================================================================

/** Response from getInsuranceQuote Cloud Function */
export interface InsuranceQuoteResponse {
  quoteId: string;
  premiumCents: number;
  billingAmountCents: number;
  expiresAt: string;
  coverageType: string;
  drivingScore: number;
  discountPercentage: number;
}

/** Response from acceptInsuranceQuote Cloud Function */
export interface InsurancePolicyResponse {
  policyId: string;
  policyNumber: string;
  status: string;
  monthlyPremiumCents: number;
  startDate: string;
  endDate: string;
}

/**
 * Request an insurance quote from Root Platform via Cloud Function.
 */
export async function getInsuranceQuote(
  coverageType: 'basic' | 'standard' | 'premium' = 'standard'
): Promise<InsuranceQuoteResponse> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<
    { coverageType: string },
    InsuranceQuoteResponse
  >(functions, 'getInsuranceQuote');
  const result = await fn({ coverageType });
  return result.data;
}

/**
 * Accept a quote and bind a policy via Root Platform.
 */
export async function acceptInsuranceQuote(
  quoteId: string
): Promise<InsurancePolicyResponse> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<
    { quoteId: string },
    InsurancePolicyResponse
  >(functions, 'acceptInsuranceQuote');
  const result = await fn({ quoteId });
  return result.data;
}

/**
 * Sync a policy's status with Root Platform.
 */
export async function syncInsurancePolicy(
  policyId: string
): Promise<InsurancePolicyResponse> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<
    { policyId: string },
    InsurancePolicyResponse
  >(functions, 'syncInsurancePolicy');
  const result = await fn({ policyId });
  return result.data;
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

// ============================================================================
// EXPORTS
// ============================================================================

export {
  getCurrentPoolPeriod,
  getShareId,
};

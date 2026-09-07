/**
 * Users collection and the beta-pricing subcollection.
 * Extracted verbatim from client/src/lib/firestore.ts.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  DocumentReference,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  COLLECTION_NAMES,
  UserDocument,
  UserDocumentUpdate,
  RecentTripSummary,
  DrivingProfileData,
  DEFAULT_DRIVING_PROFILE,
  DEFAULT_POOL_SHARE,
  DEFAULT_USER_SETTINGS,
  PoolShareSummary,
  BetaEstimateDocument,
} from '../../../shared/firestore-types';
import { assertFirestore } from './firestoreClient';
import { getCurrentPoolPeriod, initializePoolShare } from './firestorePool';

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

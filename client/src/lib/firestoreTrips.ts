/**
 * Trips collection and the tripPoints subcollection (including the batched
 * writer for long trips). Extracted verbatim from client/src/lib/firestore.ts.
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
  startAfter,
  writeBatch,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  COLLECTION_NAMES,
  TripDocument,
  TripCreateInput,
  TripPointsDocument,
  TripPoint,
  TripQueryOptions,
  TripStatus,
} from '../../../shared/firestore-types';
import { assertFirestore } from './firestoreClient';

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

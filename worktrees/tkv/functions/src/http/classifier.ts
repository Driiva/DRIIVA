/**
 * TRIP CLASSIFIER HTTP FUNCTIONS
 * ==============================
 * HTTP callable functions to invoke the Python Stop-Go-Classifier.
 * 
 * The Python classifier is deployed as a separate Cloud Function (2nd gen).
 * This TypeScript function calls it after trip finalization to detect
 * stops and trip segments.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import {
  COLLECTION_NAMES,
  TripDocument,
  TripPoint,
  TripPointsDocument,
  DetectedStop,
  DetectedTripSegment,
  ClassificationSummary,
  TripSegmentsDocument,
} from '../types';

const db = admin.firestore();

// Python classifier Cloud Function URL
// Set via Firebase environment config: firebase functions:config:set classifier.url="https://..."
const CLASSIFIER_URL = functions.config().classifier?.url || process.env.CLASSIFIER_URL;

/**
 * Response from Python classifier
 */
interface ClassifierResponse {
  success: boolean;
  trip_id: string;
  classification?: {
    stops: Array<{
      start_time: number;
      end_time: number;
      duration_seconds: number;
      center_x: number;
      center_y: number;
    }>;
    trips: Array<{
      start_time: number;
      end_time: number;
      duration_seconds: number;
    }>;
    samples: Array<{
      timestamp: number;
      x: number;
      y: number;
      label: string;
      is_stop: boolean;
    }>;
    summary: {
      total_points: number;
      total_stops: number;
      total_trips: number;
      classification_success: boolean;
      center_lat?: number;
      center_lng?: number;
      error?: string;
    };
  };
  saved?: boolean;
  error?: string;
}

/**
 * Convert TripPoints to classifier format
 */
function formatPointsForClassifier(
  points: TripPoint[],
  startTimestampMs: number
): Array<{ lat: number; lng: number; ts: number; speed: number }> {
  return points.map(point => ({
    lat: point.lat,
    lng: point.lng,
    ts: startTimestampMs + point.t, // Convert offset to absolute timestamp
    speed: point.spd / 100, // Convert back to m/s
  }));
}

/**
 * Call Python classifier Cloud Function
 */
async function callPythonClassifier(
  tripId: string,
  userId: string,
  points: Array<{ lat: number; lng: number; ts: number; speed: number }>,
  settings?: Record<string, number>
): Promise<ClassifierResponse> {
  if (!CLASSIFIER_URL) {
    functions.logger.warn('Classifier URL not configured, skipping classification');
    return {
      success: false,
      trip_id: tripId,
      error: 'Classifier URL not configured',
    };
  }

  try {
    const response = await fetch(`${CLASSIFIER_URL}/classify_trip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trip_id: tripId,
        user_id: userId,
        points,
        settings,
        save_results: false, // We'll save from TypeScript for consistency
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Classifier returned ${response.status}: ${errorText}`);
    }

    return await response.json() as ClassifierResponse;
  } catch (error) {
    functions.logger.error(`Error calling classifier for trip ${tripId}:`, error);
    return {
      success: false,
      trip_id: tripId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save classification results to Firestore
 */
async function saveClassificationResults(
  tripId: string,
  userId: string,
  response: ClassifierResponse
): Promise<void> {
  if (!response.success || !response.classification) {
    functions.logger.warn(`No classification results to save for trip ${tripId}`);
    return;
  }

  const { classification } = response;

  // Transform stops
  const stops: DetectedStop[] = classification.stops.map(stop => ({
    startTime: stop.start_time,
    endTime: stop.end_time,
    durationSeconds: stop.duration_seconds,
    centerX: stop.center_x,
    centerY: stop.center_y,
  }));

  // Transform trip segments
  const trips: DetectedTripSegment[] = classification.trips.map(trip => ({
    startTime: trip.start_time,
    endTime: trip.end_time,
    durationSeconds: trip.duration_seconds,
  }));

  // Transform summary
  const summary: ClassificationSummary = {
    totalPoints: classification.summary.total_points,
    totalStops: classification.summary.total_stops,
    totalTrips: classification.summary.total_trips,
    classificationSuccess: classification.summary.classification_success,
    centerLat: classification.summary.center_lat,
    centerLng: classification.summary.center_lng,
    error: classification.summary.error,
  };

  // Create segmentation document
  const segmentDoc: Omit<TripSegmentsDocument, 'classifiedAt'> & { classifiedAt: FirebaseFirestore.FieldValue } = {
    tripId,
    userId,
    stops,
    trips,
    summary,
    classifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    classifierVersion: '1.0.0',
  };

  // Save to tripSegments collection
  const segmentsRef = db.collection('tripSegments').doc(tripId);
  await segmentsRef.set(segmentDoc);

  // Update trip document with segmentation summary
  const tripRef = db.collection(COLLECTION_NAMES.TRIPS).doc(tripId);
  await tripRef.update({
    segmentation: {
      totalStops: summary.totalStops,
      totalSegments: summary.totalTrips,
      classifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      hasSignificantStops: summary.totalStops > 0,
    },
  });

  functions.logger.info(`Saved classification results for trip ${tripId}:`, {
    stops: stops.length,
    segments: trips.length,
  });
}

/**
 * Read trip points from Firestore
 */
async function readTripPoints(tripId: string): Promise<TripPoint[]> {
  const pointsRef = db.collection(COLLECTION_NAMES.TRIP_POINTS).doc(tripId);
  const snapshot = await pointsRef.get();

  if (!snapshot.exists) {
    functions.logger.warn(`No trip points found for trip ${tripId}`);
    return [];
  }

  const data = snapshot.data() as TripPointsDocument;

  // Check if points are in main document
  if (data.points && data.points.length > 0) {
    return data.points;
  }

  // Otherwise fetch from batches subcollection
  const batchesSnapshot = await pointsRef
    .collection('batches')
    .orderBy('batchIndex')
    .get();

  const allPoints: TripPoint[] = [];
  batchesSnapshot.docs.forEach(doc => {
    const batch = doc.data();
    if (batch.points && Array.isArray(batch.points)) {
      allPoints.push(...batch.points);
    }
  });

  return allPoints;
}

// ============================================================================
// HTTP CALLABLE FUNCTIONS
// ============================================================================

/**
 * Classify a completed trip
 * 
 * Callable from client or other Cloud Functions to trigger classification
 * for a specific trip.
 * 
 * @param tripId - The trip ID to classify
 * @returns Classification results
 */
export const classifyTrip = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const tripId = data.tripId as string;
  if (!tripId) {
    throw new functions.https.HttpsError('invalid-argument', 'tripId is required');
  }

  functions.logger.info(`Classifying trip ${tripId} requested by user ${context.auth.uid}`);

  try {
    // Get trip document
    const tripRef = db.collection(COLLECTION_NAMES.TRIPS).doc(tripId);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
      throw new functions.https.HttpsError('not-found', `Trip ${tripId} not found`);
    }

    const trip = tripDoc.data() as TripDocument;

    // Verify ownership
    if (trip.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to classify this trip');
    }

    // Only classify completed trips
    if (trip.status !== 'completed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Trip must be completed to classify. Current status: ${trip.status}`
      );
    }

    // Read GPS points
    const points = await readTripPoints(tripId);
    if (points.length < 2) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Trip has insufficient GPS points for classification'
      );
    }

    // Format points and call classifier
    const formattedPoints = formatPointsForClassifier(points, trip.startedAt.toMillis());
    const classifierResponse = await callPythonClassifier(tripId, trip.userId, formattedPoints);

    // Save results if successful
    if (classifierResponse.success) {
      await saveClassificationResults(tripId, trip.userId, classifierResponse);
    }

    return {
      success: classifierResponse.success,
      tripId,
      summary: classifierResponse.classification?.summary,
      error: classifierResponse.error,
    };

  } catch (error) {
    functions.logger.error(`Error classifying trip ${tripId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Classification failed'
    );
  }
});

/**
 * Batch classify multiple trips
 * 
 * Admin function to re-classify historical trips.
 */
export const batchClassifyTrips = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth?.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { tripIds, userId, limit = 10 } = data;

  let tripsToProcess: string[] = [];

  if (tripIds && Array.isArray(tripIds)) {
    tripsToProcess = tripIds.slice(0, limit);
  } else if (userId) {
    // Get recent completed trips for user
    const tripsSnapshot = await db
      .collection(COLLECTION_NAMES.TRIPS)
      .where('userId', '==', userId)
      .where('status', '==', 'completed')
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();
    
    tripsToProcess = tripsSnapshot.docs.map(doc => doc.id);
  }

  functions.logger.info(`Batch classifying ${tripsToProcess.length} trips`);

  const results = await Promise.allSettled(
    tripsToProcess.map(async (tripId) => {
      const tripDoc = await db.collection(COLLECTION_NAMES.TRIPS).doc(tripId).get();
      if (!tripDoc.exists) return { tripId, status: 'not_found' };

      const trip = tripDoc.data() as TripDocument;
      const points = await readTripPoints(tripId);
      
      if (points.length < 2) {
        return { tripId, status: 'insufficient_points' };
      }

      const formattedPoints = formatPointsForClassifier(points, trip.startedAt.toMillis());
      const response = await callPythonClassifier(tripId, trip.userId, formattedPoints);

      if (response.success) {
        await saveClassificationResults(tripId, trip.userId, response);
        return { tripId, status: 'classified', summary: response.classification?.summary };
      }

      return { tripId, status: 'failed', error: response.error };
    })
  );

  return {
    processed: results.length,
    results: results.map((r, i) => ({
      tripId: tripsToProcess[i],
      ...(r.status === 'fulfilled' ? r.value : { status: 'error', error: String(r.reason) }),
    })),
  };
});

// ============================================================================
// INTERNAL FUNCTIONS (called from trip triggers)
// ============================================================================

/**
 * Classify trip after completion
 * 
 * Called from trip triggers when a trip transitions to 'completed'.
 * This is the main entry point for automatic classification.
 */
export async function classifyCompletedTrip(
  tripId: string,
  trip: TripDocument
): Promise<void> {
  functions.logger.info(`Auto-classifying completed trip ${tripId}`);

  try {
    // Read GPS points
    const points = await readTripPoints(tripId);
    
    if (points.length < 23) { // Minimum required by classifier
      functions.logger.warn(`Trip ${tripId} has only ${points.length} points, skipping classification`);
      return;
    }

    // Format points and call classifier
    const formattedPoints = formatPointsForClassifier(points, trip.startedAt.toMillis());
    
    // Use conservative settings for automatic classification
    const settings = {
      MIN_STOP_INTERVAL: 60,        // 1 minute minimum stop
      MIN_DISTANCE_BETWEEN_STOP: 50, // 50 meters
    };

    const classifierResponse = await callPythonClassifier(
      tripId,
      trip.userId,
      formattedPoints,
      settings
    );

    // Save results if successful
    if (classifierResponse.success) {
      await saveClassificationResults(tripId, trip.userId, classifierResponse);
      functions.logger.info(`Trip ${tripId} classified successfully:`, {
        stops: classifierResponse.classification?.summary.total_stops,
        segments: classifierResponse.classification?.summary.total_trips,
      });
    } else {
      functions.logger.warn(`Classification failed for trip ${tripId}:`, classifierResponse.error);
    }

  } catch (error) {
    // Don't throw - classification is enhancement, not critical
    functions.logger.error(`Error auto-classifying trip ${tripId}:`, error);
  }
}

/**
 * TRIP TRIGGERS
 * =============
 * Cloud Functions triggered by trip document changes.
 */
import * as functions from 'firebase-functions';
import { TripDocument } from '../types';
/**
 * Triggered when a new trip is created
 * - Detects anomalies
 * - Enriches with context (night driving, rush hour)
 * - Updates trip status
 */
export declare const onTripCreate: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Triggered when trip status changes
 * Handles:
 * 1. Trip finalization (recording → processing): Compute metrics from GPS points
 * 2. Manual review completion (processing → completed): Update driver profile
 */
export declare const onTripStatusChange: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
/**
 * Finalize trip by reading GPS points and computing metrics
 *
 * Steps:
 * 1. Read all points from tripPoints/{tripId}
 * 2. Compute duration, distance (Haversine), average speed
 * 3. Compute driving score from events
 * 4. Update trip document with computed metrics
 * 5. Detect anomalies and set final status
 * 6. Update driver stats transactionally
 */
export declare function finalizeTripFromPoints(tripId: string, tripData: TripDocument): Promise<void>;
/**
 * Update driver profile and pool share after trip completion
 * This is the main business logic for trip processing
 */
export declare function updateDriverProfileAndPoolShare(trip: TripDocument, tripId: string): Promise<void>;
//# sourceMappingURL=trips.d.ts.map
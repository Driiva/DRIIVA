/**
 * The tripPoints subcollection.
 * Extracted verbatim from functions/src/types.ts, which re-exports this module
 * so every existing import keeps working.
 */

import type { Timestamp } from './firestoreScalars';
import type {
  ScoreBreakdown,
  TripEvents,
} from './documents';

// ============================================================================
// TRIP POINTS
// ============================================================================

/**
 * Single GPS/sensor data point (compressed format)
 */
export interface TripPoint {
  t: number;                      // Timestamp offset in ms from trip start
  lat: number;
  lng: number;
  spd: number;                    // Speed in m/s * 100 (integer)
  hdg: number;                    // Heading 0-360
  acc: number;                    // Accuracy in meters

  // Optional sensor data
  ax?: number;                    // Accelerometer X
  ay?: number;                    // Accelerometer Y
  az?: number;                    // Accelerometer Z
  gx?: number;                    // Gyroscope X
  gy?: number;                    // Gyroscope Y
  gz?: number;                    // Gyroscope Z
}

/**
 * Trip points document
 * Collection: tripPoints/{tripId}
 */
export interface TripPointsDocument {
  tripId: string;
  userId: string;
  points: TripPoint[];
  samplingRateHz: number;
  totalPoints: number;
  compressedSize: number;
  createdAt: Timestamp;
}

/**
 * Computed trip metrics from GPS points
 */
export interface ComputedTripMetrics {
  distanceMeters: number;
  durationSeconds: number;
  avgSpeedMps: number;            // meters per second
  maxSpeedMps: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  events: TripEvents;
}

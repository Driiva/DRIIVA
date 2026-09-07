/**
 * The stop-go classifier output stored on tripSegments.
 * Extracted verbatim from functions/src/types.ts, which re-exports this module
 * so every existing import keeps working.
 */

import type { Timestamp } from './firestoreScalars';

// ============================================================================
// TRIP SEGMENTATION (Stop-Go-Classifier)
// ============================================================================

/**
 * Detected stop interval from GPS trajectory analysis
 */
export interface DetectedStop {
  startTime: number;              // Epoch seconds
  endTime: number;                // Epoch seconds
  durationSeconds: number;
  centerX: number;                // Planar X coordinate (meters)
  centerY: number;                // Planar Y coordinate (meters)
  centerLat?: number;             // Optional lat (reverse projected)
  centerLng?: number;             // Optional lng (reverse projected)
}

/**
 * Detected trip segment from GPS trajectory analysis
 */
export interface DetectedTripSegment {
  startTime: number;              // Epoch seconds
  endTime: number;                // Epoch seconds
  durationSeconds: number;
}

/**
 * Classification summary
 */
export interface ClassificationSummary {
  totalPoints: number;
  totalStops: number;
  totalTrips: number;
  classificationSuccess: boolean;
  centerLat?: number;
  centerLng?: number;
  error?: string;
}

/**
 * Trip segmentation document
 * Collection: tripSegments/{tripId}
 */
export interface TripSegmentsDocument {
  tripId: string;
  userId: string;
  stops: DetectedStop[];
  trips: DetectedTripSegment[];
  summary: ClassificationSummary;
  classifiedAt: Timestamp;
  classifierVersion: string;
}

/**
 * Embedded segmentation summary on trip document
 */
export interface TripSegmentationSummary {
  totalStops: number;
  totalSegments: number;
  classifiedAt: Timestamp;
  hasSignificantStops: boolean;
}

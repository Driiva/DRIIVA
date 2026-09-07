/**
 * The trip-recording page's own state shapes. Extracted verbatim from
 * client/src/pages/trip-recording.tsx.
 */
export type RecordingState = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping';

export interface TripStats {
  distanceMeters: number;
  durationMs: number;
  pointsCount: number;
  avgSpeed: number;
}

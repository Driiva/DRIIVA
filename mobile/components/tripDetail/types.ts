/**
 * The marker vocabulary and the document shapes the trip detail screen reads.
 * Extracted verbatim from mobile/app/trips/[tripId].tsx.
 */
import type { DrivingEventType } from '@driiva/scoring';
import type { MarkerShape } from '@/components/ui/RouteTrace';

/**
 * Shape per event type, not colour per event type. Four hues on a
 * near-monochrome instrument is a rainbow; one earned colour and four shapes
 * says the same thing and survives being read by somebody who cannot separate
 * the hues. See RouteTrace.
 */
export const MARKER_SHAPES: Record<DrivingEventType, MarkerShape> = {
  braking: 'circle',
  acceleration: 'triangle',
  cornering: 'diamond',
  speeding: 'bar',
};

export const MARKER_LABELS: Record<DrivingEventType, string> = {
  braking: 'Hard braking',
  acceleration: 'Hard acceleration',
  cornering: 'Sharp turn',
  speeding: 'Over the limit',
};

export interface ScoreBreakdown {
  speedScore: number;
  brakingScore: number;
  accelerationScore: number;
  corneringScore: number;
  phoneUsageScore: number;
}

export interface TripEvents {
  hardBrakingCount: number;
  hardAccelerationCount: number;
  speedingSeconds: number;
  sharpTurnCount: number;
  phonePickupCount: number;
}

export interface TripLocation {
  address: string | null;
}

export interface Trip {
  tripId: string;
  userId: string;
  score: number;
  scoreBreakdown?: ScoreBreakdown;
  distanceMeters: number;
  durationSeconds: number;
  startedAt: { toDate?: () => Date } | string;
  startLocation?: TripLocation;
  endLocation?: TripLocation;
  routeSummary?: string;
  status: string;
  events?: TripEvents;
}

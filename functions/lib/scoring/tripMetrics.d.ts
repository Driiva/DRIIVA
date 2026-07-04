/**
 * TRIP METRICS
 * ============
 * Ported verbatim from `functions/src/utils/helpers.ts:224-489` (the
 * `computeTripMetrics` algorithm and its private helpers) plus
 * `shared/tripProcessor.ts:23` (`haversineMeters`, the distance dependency).
 * Byte-faithful to current behaviour: do NOT "fix" or refactor any logic
 * here. See the M0 Task 2 report for characterisation evidence and any
 * bugs spotted but intentionally left unchanged.
 *
 * `TripEvents` / `TripMetrics` mirror `functions/src/types.ts` `TripEvents`
 * / `ComputedTripMetrics` field-for-field. @driiva/contracts does not yet
 * define these shapes, so they are declared locally per the brief.
 */
import type { TripPoint, ScoreBreakdown } from '@driiva/contracts';
/** Mirrors `functions/src/types.ts` `TripEvents`. */
export interface TripEvents {
    hardBrakingCount: number;
    hardAccelerationCount: number;
    speedingSeconds: number;
    sharpTurnCount: number;
    phonePickupCount: number;
}
/** Mirrors `functions/src/types.ts` `ComputedTripMetrics`. */
export interface TripMetrics {
    distanceMeters: number;
    durationSeconds: number;
    avgSpeedMps: number;
    maxSpeedMps: number;
    score: number;
    scoreBreakdown: ScoreBreakdown;
    events: TripEvents;
}
/**
 * Haversine distance between two WGS84 points, in meters.
 * Ported verbatim from `shared/tripProcessor.ts`.
 */
export declare function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number;
/**
 * Compute trip metrics from raw GPS points.
 * This is the core algorithm that processes GPS data to derive metrics and
 * scores. Frozen signature (M0 Task 2 brief).
 */
export declare function computeTripMetrics(points: TripPoint[], startTimestampMs: number): TripMetrics;
//# sourceMappingURL=tripMetrics.d.ts.map
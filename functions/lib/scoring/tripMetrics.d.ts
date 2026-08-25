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
 * ONE deliberate exception to that freeze: phone-usage wiring (M2-DEC-1
 * Option A, docs/rebuild/m2-dec-1-phone-usage.md). `computeTripMetrics` took
 * a second, optional `clientReportedPhonePickupCount` parameter so the 10%
 * phone-usage weight (SCORE_WEIGHTS.phoneUsage below) can score something
 * other than a permanent, undisclosed 100. See `sanitizePhonePickupCount`
 * for what "wired" means here: a client-reported number the server
 * sanity-checks and rate-caps, not an independently verified one - there is
 * no server-side accelerometer stream to check it against. Everything else
 * in this file is still the frozen, byte-faithful port.
 *
 * `TripEvents` / `TripMetrics` mirror `functions/src/types.ts` `TripEvents`
 * / `ComputedTripMetrics` field-for-field. @driiva/contracts does not yet
 * define these shapes, so they are declared locally per the brief.
 *
 * THIS FILE IS THE AUTHORED SOURCE. `functions/src/scoring/tripMetrics.ts`
 * is a build-time copy (see functions/package.json `prebuild`, which `cp`s
 * this file over it) - edit here, then sync that copy by hand if you are not
 * running the functions build.
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
 * Composite score weights. Single source of truth for both the algorithm
 * (computeDrivingScore, below) and any UI that shows the weighting to a user
 * (trip-detail's score breakdown). Values are byte-identical to the previous
 * inline literals (25/25/20/20/10) - extracting them changes nothing about
 * the computed score, it just makes algorithm and display impossible to drift
 * apart. These must sum to 1.0.
 */
export declare const SCORE_WEIGHTS: {
    readonly speed: 0.25;
    readonly braking: 0.25;
    readonly acceleration: 0.2;
    readonly cornering: 0.2;
    readonly phoneUsage: 0.1;
};
/**
 * Haversine distance between two WGS84 points, in meters.
 * Ported verbatim from `shared/tripProcessor.ts`.
 */
export declare function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number;
/**
 * Compute trip metrics from raw GPS points.
 * This is the core algorithm that processes GPS data to derive metrics and
 * scores. Frozen signature for everything except `clientReportedPhonePickupCount`
 * (M0 Task 2 brief; M2-DEC-1 Option A added the second parameter - see the
 * file header).
 *
 * `clientReportedPhonePickupCount` is the client's own count of phone
 * pickups during the trip (web: visibilitychange while recording; mobile: an
 * on-device accelerometer heuristic - see the call sites in
 * functions/src/triggers/trips.ts and each client for what "pickup" means on
 * that platform). It is sanitised via `sanitizePhonePickupCount` before it
 * can influence `events.phonePickupCount` or the score, because it is client
 * input the server has no independent way to verify.
 */
export declare function computeTripMetrics(points: TripPoint[], clientReportedPhonePickupCount?: number): TripMetrics;
/** The four event types that can be derived from the GPS trace alone. */
export type DrivingEventType = 'braking' | 'acceleration' | 'cornering' | 'speeding';
/**
 * One detected event, with the point it happened at.
 *
 * Phone pickups are deliberately absent. They are a client-reported number
 * with no position attached, not something derived from the trace, so there is
 * no honest place to draw one.
 */
export interface LocatedDrivingEvent {
    type: DrivingEventType;
    /**
     * Index of the CURRENT point of the interval, in the array passed in.
     *
     * This function does not sort. Sorting internally would return indices into
     * an array the caller does not hold, which is a trap. computeTripMetrics
     * sorts by `t` before scoring, so pass points sorted by `t` if you want the
     * indices to line up with the server's scoring pass.
     */
    index: number;
    /** That point's `t`. */
    t: number;
    /**
     * Seconds attributed to this event. Only 'speeding' carries one, because the
     * score counts speeding as a DURATION rather than as occurrences. The other
     * three are instants and leave this undefined.
     */
    seconds?: number;
}
/**
 * Every driving event in a trace, with where it happened.
 *
 * detectDrivingEvents tallies exactly this list, so a marker drawn from here
 * and a count read off the trip document cannot disagree. That identity is
 * asserted in tripMetrics.eventLocator.test.ts rather than assumed.
 */
export declare function locateDrivingEvents(points: TripPoint[]): LocatedDrivingEvent[];
//# sourceMappingURL=tripMetrics.d.ts.map
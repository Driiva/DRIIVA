/**
 * TELEMETRY BOUNDARY GUARD
 * =========================
 * The validation seam between the phone's sensors and anything Driiva writes.
 * Pure: no expo imports, no Firestore, no React Native, so the root vitest run
 * can exercise it without mobile's native dependency tree installed. Same
 * reason lib/backgroundLocationBuffer.ts is split from lib/backgroundLocation.ts.
 *
 * WHAT A BOUNDARY GUARD IS FOR HERE. Every GPS fix that reaches
 * lib/trips.ts's TripPointWriter is encoded by shared/trip-capture.ts and
 * written straight to tripPoints/{tripId}/batches/{n}, which the scoring Cloud
 * Function reads as fact. encodePoint does arithmetic on those numbers
 * (Math.round, a subtraction against trip start, a multiply by 100), and
 * arithmetic on NaN produces NaN silently. One malformed fix therefore does
 * not corrupt one point, it corrupts every haversine that touches it and the
 * trip distance built from them, with nothing anywhere failing.
 *
 * WHAT IT MUST NOT DO, WHICH IS THE HARDER HALF. It rejects only fixes that
 * are STRUCTURALLY invalid: a coordinate that is not a finite number or is
 * outside the range packages/contracts allows, a timestamp that is not finite
 * or does not advance, a speed that is not a number, an accuracy the platform
 * itself marks invalid by returning it negative. It deliberately keeps fixes
 * that are merely EXTREME. functions/src/utils/helpers.ts detectAnomalies is
 * what decides a trip had impossible speed or GPS jumps, and it decides that
 * from the trace it is given. A client that quietly deleted its own outliers
 * would hand the server a laundered trace and switch off the exact check that
 * exists to catch a bad one, while every number on screen still looked fine.
 *
 * NOTHING IS EVER SUBSTITUTED FOR A REJECT. No interpolation between the
 * neighbours, no last-known-good carried forward, no zero fill. A rejected fix
 * is counted by reason and gone, and the count is the driver-visible signal
 * that capture was imperfect. Inventing a point to keep a trace tidy would put
 * a coordinate the phone never reported into an insurance record.
 */
import type { SampledLocation, StoredTripPoint } from '@shared/trip-capture';

/** Why a fix was refused. One counter per reason, never a single total. */
export type TelemetryRejection =
  | 'non_finite_coordinate'
  | 'coordinate_out_of_range'
  | 'non_finite_timestamp'
  | 'timestamp_not_advancing'
  | 'non_finite_speed'
  | 'invalid_accuracy';

export interface TelemetryGateStats {
  accepted: number;
  rejected: number;
  byReason: Record<TelemetryRejection, number>;
}

function emptyReasons(): Record<TelemetryRejection, number> {
  return {
    non_finite_coordinate: 0,
    coordinate_out_of_range: 0,
    non_finite_timestamp: 0,
    timestamp_not_advancing: 0,
    non_finite_speed: 0,
    invalid_accuracy: 0,
  };
}

/**
 * Decides, fix by fix, whether a GPS sample is safe to encode and write.
 *
 * Stateful by necessity: "the timestamp advanced" is only answerable against
 * the last fix this gate accepted. The watermark moves on accept only, so a
 * single corrupt fix carrying a far-future timestamp cannot lock out every
 * good fix that follows it.
 */
export class TelemetryGate {
  private lastAcceptedTimestamp: number | null = null;
  private lastAcceptedSample: SampledLocation | null = null;
  private acceptedCount = 0;
  private rejectedCount = 0;
  private readonly reasons = emptyReasons();

  /** True when the fix may be written. False when it was counted and dropped. */
  admit(sample: SampledLocation): boolean {
    const reason = this.assess(sample);
    if (reason) {
      this.rejectedCount++;
      this.reasons[reason]++;
      return false;
    }
    this.lastAcceptedTimestamp = sample.timestamp;
    this.lastAcceptedSample = sample;
    this.acceptedCount++;
    return true;
  }

  /**
   * The most recent fix that passed, exactly as the platform reported it,
   * including the null and negative sentinels for unknown speed and accuracy.
   *
   * Held here because the gate is the ONE place every accepted fix passes
   * through, whichever path delivered it. The record screen used to read speed
   * and GPS quality from its own foreground watch callback, so once iOS
   * started delivering a trip's fixes to the background task instead, the
   * screen froze on the first fix while capture carried on correctly
   * underneath it. Reading from here makes the live instrument path-agnostic.
   */
  get lastAccepted(): SampledLocation | null {
    return this.lastAcceptedSample;
  }

  get stats(): TelemetryGateStats {
    return {
      accepted: this.acceptedCount,
      rejected: this.rejectedCount,
      byReason: { ...this.reasons },
    };
  }

  private assess(sample: SampledLocation): TelemetryRejection | null {
    const { latitude, longitude, timestamp, speed, accuracy } = sample;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return 'non_finite_coordinate';
    }
    // The bounds packages/contracts trip-points.ts enforces. Checked here so a
    // fix that would be refused server-side is never written at all, rather
    // than stranding a trip whose batch the rules or the schema reject.
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return 'coordinate_out_of_range';
    }
    if (!Number.isFinite(timestamp)) {
      return 'non_finite_timestamp';
    }
    // Strictly advancing, so a duplicate delivery of one fix (the same fix
    // arriving through the foreground watch and the background task) is
    // counted once. A repeat carries no new information and would add a
    // zero-distance, zero-duration step to the trace.
    if (this.lastAcceptedTimestamp !== null && timestamp <= this.lastAcceptedTimestamp) {
      return 'timestamp_not_advancing';
    }
    // null means the fix carries no speed, which is ordinary and handled by
    // encodePoint. A negative speed is the documented unknown sentinel on both
    // platforms, also handled there. NaN is neither, and would survive
    // encodePoint's Math.round to reach the scoring pipeline.
    if (speed !== null && !Number.isFinite(speed)) {
      return 'non_finite_speed';
    }
    // iOS reports a negative horizontal accuracy to mean the location is
    // invalid, which is the platform telling us not to trust the coordinate
    // rather than telling us it is imprecise.
    if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) {
      return 'invalid_accuracy';
    }
    return null;
  }
}

/**
 * The cap packages/scoring/src/tripMetrics.ts enforces server-side.
 *
 * Duplicated rather than imported: mobile/ resolves @driiva/scoring through
 * its own Expo dependency tree, and this module has to stay importable by the
 * root vitest run with nothing installed under mobile/. The duplication is
 * held honest by a drift test that reads the scoring package's source and
 * fails by name if the number there ever moves
 * (tests/unit/mobile-telemetry-guard.test.ts).
 */
export const MAX_PICKUPS_PER_MINUTE = 6;

/**
 * Applies the server's phone-pickup cap before the count is written.
 *
 * The server sanitises this number anyway, so nothing here is a security
 * control. It is a truthfulness control: an uncapped count written to
 * clientReportedPhonePickupCount and then silently shrunk by the scorer leaves
 * the number the phone reported and the number that moved the driver's score
 * as two different values, with the smaller one unrecorded and no marker
 * anywhere saying a cap applied. Capping at the boundary means the stored
 * count is the count that scored.
 *
 * Mirrors sanitizePhonePickupCount in packages/scoring/src/tripMetrics.ts
 * step for step, including treating a duration below one second as one second.
 */
export function sanitizeClientPickupCount(
  rawCount: number | undefined,
  durationSeconds: number,
): number {
  if (rawCount === undefined || !Number.isFinite(rawCount) || rawCount <= 0) {
    return 0;
  }
  const count = Math.floor(rawCount);
  const durationMinutes = Math.max(1, durationSeconds) / 60;
  const cap = Math.max(1, Math.ceil(durationMinutes * MAX_PICKUPS_PER_MINUTE));
  return Math.min(count, cap);
}

/**
 * Upper bound on points held in memory awaiting a write.
 *
 * At the capture rate record.tsx uses (one fix per second) this is a little
 * over an hour of unflushed trace, which is longer than any credible run of
 * failed writes inside one trip. It exists because the retry path below puts
 * failed points BACK into the buffer: without a bound, a driver in a long
 * signal blackspot accumulates points for the length of the outage, on a phone
 * that is also running the OS map and the GPS radio.
 */
export const MAX_BUFFERED_POINTS = 5_000;

export interface RetainedBuffer {
  buffer: StoredTripPoint[];
  /** Points the cap evicted. The caller must carry this, not discard it. */
  dropped: number;
}

/**
 * Rebuilds the write buffer after a flush failed, bounded.
 *
 * The points that failed to write go back in FRONT of anything buffered since,
 * so the trace stays in order. If that puts the buffer over the cap, the
 * OLDEST points are evicted: the newest window is the one that still describes
 * where the driver is, and the end of a trip is where the stop happens.
 *
 * The eviction count is returned rather than logged and forgotten. A writer
 * that catches its own failure and quietly loses data is how a silent gap
 * reaches production looking like a clean run, so the loss is the caller's to
 * report; record.tsx surfaces it and lib/trips.ts keeps it out of pointsCount,
 * which would otherwise claim points that were never stored.
 */
export function retainAfterFailedFlush(
  pending: readonly StoredTripPoint[],
  buffered: readonly StoredTripPoint[],
  max: number = MAX_BUFFERED_POINTS,
): RetainedBuffer {
  const combined = [...pending, ...buffered];
  if (combined.length <= max) {
    return { buffer: combined, dropped: 0 };
  }
  const dropped = combined.length - max;
  return { buffer: combined.slice(dropped), dropped };
}

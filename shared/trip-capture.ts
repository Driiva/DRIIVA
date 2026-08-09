/**
 * TRIP CAPTURE ENCODING
 * =====================
 * Turns a raw GPS fix into the stored point shape the scoring pipeline reads.
 *
 * This lives in shared/ rather than mobile/ because it is the exact seam where
 * on-device capture meets server-side scoring, and both encodings it applies
 * are non-obvious enough to be worth testing without a React Native runtime:
 *
 *   `t`   is an offset in milliseconds from the start of the trip, NOT a wall
 *         clock timestamp. computeTripMetrics derives duration from the last
 *         offset, so a wall-clock value there reports a trip lasting decades.
 *   `spd` is metres per second multiplied by 100 and rounded to an integer.
 *         computeSpeedStats divides by 100 to recover m/s; writing raw m/s
 *         under-reports every speed by two orders of magnitude and hands every
 *         driver a perfect speed score.
 *
 * See packages/contracts/src/trip-points.ts for the schema these satisfy.
 */

/** A GPS sample as expo-location reports it, before encoding. */
export interface SampledLocation {
  latitude: number;
  longitude: number;
  /** metres per second, or null when the fix carries no speed */
  speed: number | null;
  /** degrees, or null when the fix carries no heading */
  heading: number | null;
  /** horizontal accuracy in metres */
  accuracy: number | null;
  /** epoch ms */
  timestamp: number;
}

/** The stored point shape (packages/contracts trip-points.ts TripPointSchema). */
export interface StoredTripPoint {
  t: number;
  lat: number;
  lng: number;
  spd: number;
  hdg: number;
  acc: number;
}

export function encodePoint(sample: SampledLocation, tripStartMs: number): StoredTripPoint {
  return {
    // Clamped at zero: a fix whose device timestamp predates trip start would
    // otherwise write a negative offset, which the contract rejects.
    t: Math.max(0, Math.round(sample.timestamp - tripStartMs)),
    lat: sample.latitude,
    lng: sample.longitude,
    // Negative speeds mean "unknown" on both platforms, not reverse.
    spd: Math.round(Math.max(0, sample.speed ?? 0) * 100),
    // expo-location reports -1 for an unknown heading; the contract bounds it
    // to 0-360, so an unknown heading is stored as 0.
    hdg: Math.round(sample.heading != null && sample.heading >= 0 ? sample.heading % 360 : 0),
    acc: Math.round(Math.max(0, sample.accuracy ?? 0)),
  };
}

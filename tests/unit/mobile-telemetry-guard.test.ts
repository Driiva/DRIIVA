/**
 * TELEMETRY BOUNDARY GUARD (mobile)
 * ==================================
 * Lives in the root test tree rather than beside the module, for the same
 * reason as tests/unit/mobile-background-location.test.ts: mobile/ has its own
 * Expo tsconfig and dependency set that the root vitest run cannot resolve, so
 * mobile/lib/telemetryGuard.ts is deliberately written with zero expo imports.
 *
 * What this pins:
 *
 * 1. THE GATE REJECTS ONLY STRUCTURALLY INVALID FIXES. A point whose latitude
 *    is NaN poisons every haversine downstream of it; a point whose iOS
 *    accuracy is negative is the platform saying "this fix is invalid". Those
 *    are dropped. A point that is merely EXTREME (very fast, a long jump) is
 *    kept, because functions/src/utils/helpers.ts detectAnomalies is what flags
 *    impossible speed and GPS jumps, and a client that quietly deleted those
 *    points would launder a trace the server exists to catch.
 *
 * 2. NOTHING IS FABRICATED TO REPLACE A REJECT. There is no interpolation, no
 *    last-known-good substitution, no zero fill. A rejected fix is counted by
 *    reason and gone.
 *
 * 3. THE CLIENT PICKUP CAP MATCHES THE SERVER'S. packages/scoring's
 *    sanitizePhonePickupCount caps a client-reported count at 6 pickups per
 *    minute. Sending a number the server will silently shrink means the count
 *    the driver's phone reports and the count that moves their score are two
 *    different numbers with no marker saying so, so the same cap is applied
 *    before the write. The last test in this file is the drift guard: it reads
 *    the scoring package's SOURCE and fails by name if that cap ever moves.
 *
 * 4. THE BUFFER IS BOUNDED AND THE LOSS IS COUNTED. A trip recorded through a
 *    long tunnel retries its failed flushes; without a cap that retry buffer
 *    grows for the length of the outage. It is bounded here, and what the cap
 *    evicts is returned as a number the caller has to carry, never swallowed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MAX_BUFFERED_POINTS,
  MAX_PICKUPS_PER_MINUTE,
  TelemetryGate,
  retainAfterFailedFlush,
  sanitizeClientPickupCount,
} from '../../mobile/lib/telemetryGuard';
import type { SampledLocation } from '../../shared/trip-capture';

function fix(overrides: Partial<SampledLocation> = {}): SampledLocation {
  return {
    latitude: 51.5007,
    longitude: -0.1246,
    speed: 12,
    heading: 90,
    accuracy: 5,
    timestamp: 1_000,
    ...overrides,
  };
}

describe('TelemetryGate: what it accepts', () => {
  it('accepts an ordinary fix and counts it', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix())).toBe(true);
    expect(gate.stats.accepted).toBe(1);
    expect(gate.stats.rejected).toBe(0);
  });

  it('accepts a fix with null speed, heading and accuracy', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ speed: null, heading: null, accuracy: null }))).toBe(true);
  });

  it('accepts a negative speed, which is the platform sentinel for unknown', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ speed: -1 }))).toBe(true);
  });

  it('accepts an implausibly fast fix, because flagging that is the server job', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ speed: 200 }))).toBe(true);
    expect(gate.stats.rejected).toBe(0);
  });

  it('accepts a large positional jump, because detectAnomalies is what sees it', () => {
    const gate = new TelemetryGate();
    gate.admit(fix({ latitude: 51.5, timestamp: 1_000 }));

    expect(gate.admit(fix({ latitude: 53.4, timestamp: 2_000 }))).toBe(true);
    expect(gate.stats.rejected).toBe(0);
  });
});

describe('TelemetryGate: what it rejects', () => {
  it('rejects a non-finite latitude', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ latitude: Number.NaN }))).toBe(false);
    expect(gate.stats.byReason.non_finite_coordinate).toBe(1);
  });

  it('rejects a non-finite longitude', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ longitude: Number.POSITIVE_INFINITY }))).toBe(false);
    expect(gate.stats.byReason.non_finite_coordinate).toBe(1);
  });

  it('rejects a latitude outside the range the contract allows', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ latitude: 91 }))).toBe(false);
    expect(gate.stats.byReason.coordinate_out_of_range).toBe(1);
  });

  it('rejects a longitude outside the range the contract allows', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ longitude: -181 }))).toBe(false);
    expect(gate.stats.byReason.coordinate_out_of_range).toBe(1);
  });

  it('accepts the exact range boundaries rather than treating them as out of range', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ latitude: 90, longitude: 180, timestamp: 1_000 }))).toBe(true);
    expect(gate.admit(fix({ latitude: -90, longitude: -180, timestamp: 2_000 }))).toBe(true);
  });

  it('rejects a non-finite timestamp', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ timestamp: Number.NaN }))).toBe(false);
    expect(gate.stats.byReason.non_finite_timestamp).toBe(1);
  });

  it('rejects a timestamp that goes backwards from the last accepted fix', () => {
    const gate = new TelemetryGate();
    gate.admit(fix({ timestamp: 5_000 }));

    expect(gate.admit(fix({ timestamp: 4_000 }))).toBe(false);
    expect(gate.stats.byReason.timestamp_not_advancing).toBe(1);
  });

  it('rejects a repeated timestamp, which is the same fix delivered twice', () => {
    const gate = new TelemetryGate();
    gate.admit(fix({ timestamp: 5_000 }));

    expect(gate.admit(fix({ timestamp: 5_000 }))).toBe(false);
    expect(gate.stats.byReason.timestamp_not_advancing).toBe(1);
  });

  it('does not move the accepted-timestamp watermark when it rejects', () => {
    const gate = new TelemetryGate();
    gate.admit(fix({ timestamp: 5_000 }));
    gate.admit(fix({ latitude: Number.NaN, timestamp: 9_000 }));

    expect(gate.admit(fix({ timestamp: 6_000 }))).toBe(true);
  });

  it('rejects a non-finite speed', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ speed: Number.NaN }))).toBe(false);
    expect(gate.stats.byReason.non_finite_speed).toBe(1);
  });

  it('rejects a negative accuracy, which is the platform sentinel for an invalid fix', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ accuracy: -1 }))).toBe(false);
    expect(gate.stats.byReason.invalid_accuracy).toBe(1);
  });

  it('rejects a non-finite accuracy', () => {
    const gate = new TelemetryGate();

    expect(gate.admit(fix({ accuracy: Number.NaN }))).toBe(false);
    expect(gate.stats.byReason.invalid_accuracy).toBe(1);
  });

  it('counts every reject and every accept separately across a mixed run', () => {
    const gate = new TelemetryGate();
    gate.admit(fix({ timestamp: 1_000 }));
    gate.admit(fix({ timestamp: 2_000, latitude: Number.NaN }));
    gate.admit(fix({ timestamp: 3_000 }));
    gate.admit(fix({ timestamp: 3_000 }));

    expect(gate.stats.accepted).toBe(2);
    expect(gate.stats.rejected).toBe(2);
  });

  it('starts every reason at zero so a clean run is distinguishable from an unread counter', () => {
    const gate = new TelemetryGate();

    expect(gate.stats.byReason).toEqual({
      non_finite_coordinate: 0,
      coordinate_out_of_range: 0,
      non_finite_timestamp: 0,
      timestamp_not_advancing: 0,
      non_finite_speed: 0,
      invalid_accuracy: 0,
    });
  });
});

describe('sanitizeClientPickupCount', () => {
  it('returns zero for an undefined count', () => {
    expect(sanitizeClientPickupCount(undefined, 600)).toBe(0);
  });

  it('returns zero for a negative count', () => {
    expect(sanitizeClientPickupCount(-4, 600)).toBe(0);
  });

  it('returns zero for a non-finite count', () => {
    expect(sanitizeClientPickupCount(Number.NaN, 600)).toBe(0);
    expect(sanitizeClientPickupCount(Number.POSITIVE_INFINITY, 600)).toBe(0);
  });

  it('floors a fractional count to a whole pickup', () => {
    expect(sanitizeClientPickupCount(3.9, 600)).toBe(3);
  });

  it('passes a plausible count through untouched', () => {
    expect(sanitizeClientPickupCount(4, 600)).toBe(4);
  });

  it('caps the count at six pickups per minute of driving', () => {
    expect(sanitizeClientPickupCount(500, 600)).toBe(60);
  });

  it('allows at least one pickup even on a trip shorter than a minute', () => {
    expect(sanitizeClientPickupCount(9, 5)).toBe(1);
  });

  it('agrees with the server sanitiser on every case the server pins', () => {
    // The server treats duration as at least one second before deriving the
    // cap, so a zero or negative duration must not divide the cap to nothing.
    expect(sanitizeClientPickupCount(9, 0)).toBe(1);
    expect(sanitizeClientPickupCount(9, -30)).toBe(1);
  });
});

describe('retainAfterFailedFlush', () => {
  const point = (t: number) => ({ t, lat: 51.5, lng: -0.1, spd: 0, hdg: 0, acc: 5 });

  it('puts the failed points back in front of what is already buffered', () => {
    const result = retainAfterFailedFlush([point(1), point(2)], [point(3)]);

    expect(result.buffer.map((p) => p.t)).toEqual([1, 2, 3]);
    expect(result.dropped).toBe(0);
  });

  it('keeps everything when the total is inside the cap', () => {
    const pending = Array.from({ length: 10 }, (_, i) => point(i));

    expect(retainAfterFailedFlush(pending, []).buffer).toHaveLength(10);
  });

  it('bounds the buffer at the cap rather than growing without limit', () => {
    const pending = Array.from({ length: MAX_BUFFERED_POINTS + 25 }, (_, i) => point(i));

    const result = retainAfterFailedFlush(pending, []);

    expect(result.buffer).toHaveLength(MAX_BUFFERED_POINTS);
  });

  it('reports exactly how many points the cap evicted', () => {
    const pending = Array.from({ length: MAX_BUFFERED_POINTS + 25 }, (_, i) => point(i));

    expect(retainAfterFailedFlush(pending, []).dropped).toBe(25);
  });

  it('evicts the oldest points, keeping the most recent window of the trace', () => {
    const pending = Array.from({ length: MAX_BUFFERED_POINTS + 3 }, (_, i) => point(i));

    const result = retainAfterFailedFlush(pending, []);

    expect(result.buffer[0].t).toBe(3);
    expect(result.buffer[result.buffer.length - 1].t).toBe(MAX_BUFFERED_POINTS + 2);
  });

  it('does not mutate the arrays it was handed', () => {
    const pending = [point(1)];
    const buffered = [point(2)];

    retainAfterFailedFlush(pending, buffered);

    expect(pending).toHaveLength(1);
    expect(buffered).toHaveLength(1);
  });
});

describe('drift guard: the client cap tracks the server cap', () => {
  it('uses the same pickups-per-minute constant packages/scoring enforces', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/scoring/src/tripMetrics.ts'),
      'utf8',
    );
    const match = source.match(/const MAX_PICKUPS_PER_MINUTE\s*=\s*(\d+)/);

    // A missing match means the constant was renamed or moved. Fail loudly
    // rather than passing on a regex that no longer finds anything, which is
    // how a drift guard quietly stops guarding.
    expect(match, 'MAX_PICKUPS_PER_MINUTE not found in packages/scoring/src/tripMetrics.ts').not.toBeNull();
    expect(Number(match![1])).toBe(MAX_PICKUPS_PER_MINUTE);
  });
});

/**
 * THE LIVE READOUT HAS TO SEE EVERY CAPTURE PATH
 * ===============================================
 * Found on the simulator, not in a test. The record screen updated its point
 * count, distance, speed and GPS quality from its own foreground
 * watchPositionAsync callback. Once "Always" location is granted, iOS delivers
 * the trip's fixes to the BACKGROUND task instead, which appends straight to
 * the same TripPointWriter and never touches React state. The trip captured
 * 301 points and 14,958 m correctly; the screen sat on "2 points, 0.0 mi" for
 * the whole drive, and only the confirmation card (which reads the writer's
 * own totals) told the truth.
 *
 * A live instrument that under-reports what capture is actually doing is worse
 * than no instrument: it says the trip is not being recorded while it is. The
 * gate is the one place every accepted fix passes through whichever path
 * delivered it, so the last accepted sample is held here and the screen reads
 * it from the writer on a tick.
 */
describe('TelemetryGate: the last accepted fix', () => {
  it('has no last accepted fix before anything is admitted', () => {
    const gate = new TelemetryGate();

    expect(gate.lastAccepted).toBeNull();
  });

  it('remembers the fix it just accepted', () => {
    const gate = new TelemetryGate();
    const sample = fix({ timestamp: 1_000, speed: 15.5, accuracy: 8 });
    gate.admit(sample);

    expect(gate.lastAccepted).toEqual(sample);
  });

  it('advances to the newest accepted fix', () => {
    const gate = new TelemetryGate();
    gate.admit(fix({ timestamp: 1_000, speed: 10 }));
    gate.admit(fix({ timestamp: 2_000, speed: 20 }));

    expect(gate.lastAccepted?.speed).toBe(20);
  });

  it('keeps the last GOOD fix when the next one is rejected', () => {
    const gate = new TelemetryGate();
    gate.admit(fix({ timestamp: 1_000, speed: 10 }));
    gate.admit(fix({ timestamp: 2_000, latitude: Number.NaN }));

    expect(gate.lastAccepted?.speed).toBe(10);
    expect(gate.lastAccepted?.timestamp).toBe(1_000);
  });

  it('preserves the unknown-speed sentinel rather than coercing it to a number', () => {
    const gate = new TelemetryGate();
    gate.admit(fix({ speed: null, accuracy: null }));

    expect(gate.lastAccepted?.speed).toBeNull();
    expect(gate.lastAccepted?.accuracy).toBeNull();
  });
});

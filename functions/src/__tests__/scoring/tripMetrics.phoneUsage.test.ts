/**
 * PHONE-USAGE WIRING: the deployed copy (M2-DEC-1 Option A).
 *
 * functions/src/scoring/tripMetrics.ts is a build-time COPY of
 * packages/scoring/src/tripMetrics.ts (see functions/package.json
 * `prebuild`, which `cp`s the authored file over this one; also documented
 * in that file's own header). packages/scoring/src/__tests__/
 * tripMetrics.phoneUsage.pin.test.ts exercises the behaviour thoroughly
 * against the authored source; this suite exists so a copy that drifted out
 * of sync - hand-edited here without updating the source, or a stale copy
 * never refreshed after editing the source - fails a test in the same
 * directory Cloud Functions actually deploys from, rather than staying
 * invisible until a real trip scores wrong in production.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { TripPoint } from '@driiva/contracts';
import { computeTripMetrics } from '../../scoring/tripMetrics';

describe('functions/src/scoring/tripMetrics.ts: byte-identical to the authored source', () => {
  it('matches packages/scoring/src/tripMetrics.ts exactly (drift guard)', () => {
    const deployed = readFileSync(
      join(__dirname, '..', '..', 'scoring', 'tripMetrics.ts'),
      'utf-8'
    );
    const authored = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'packages', 'scoring', 'src', 'tripMetrics.ts'),
      'utf-8'
    );
    expect(deployed).toBe(authored);
  });
});

describe('functions/src/scoring/tripMetrics.ts: phone-usage wiring works from this copy too', () => {
  const points: TripPoint[] = Array.from({ length: 11 }, (_, i) => ({
    t: i * 60_000, // 10-minute trip, 1 point/minute
    lat: 51.5074 + i * 0.001,
    lng: -0.1278,
    spd: 1000,
    hdg: 90,
    acc: 5,
  }));

  it('a client-reported count reaches events.phonePickupCount', () => {
    expect(computeTripMetrics(points, 2).events.phonePickupCount).toBe(2);
  });

  it('an omitted count still defaults to 0 (backward-compatible signature)', () => {
    expect(computeTripMetrics(points).events.phonePickupCount).toBe(0);
    expect(computeTripMetrics(points).scoreBreakdown.phoneUsageScore).toBe(100);
  });

  it('a malformed count (negative/NaN) is sanitised, not passed through', () => {
    expect(computeTripMetrics(points, -1).events.phonePickupCount).toBe(0);
    expect(computeTripMetrics(points, NaN).events.phonePickupCount).toBe(0);
  });

  it('same input -> same output (deterministic)', () => {
    expect(computeTripMetrics(points, 3)).toEqual(computeTripMetrics(points, 3));
  });
});

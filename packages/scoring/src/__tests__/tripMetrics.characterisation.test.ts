/**
 * CHARACTERISATION — computeTripMetrics (M0 Task 2).
 *
 * `functions/src/__tests__/triggers/trips.test.ts` mocks scoring rather than
 * calling `computeTripMetrics` with real GPS points — its "scoring
 * assertions" only pin shape and the 0-100 range (reproduced in the last
 * `describe` block below). There is no existing test in the repo that locks
 * concrete `computeTripMetrics` input/output pairs, so the strongest
 * available characterisation is a direct golden-master diff against the
 * ORIGINAL `functions/src/utils/helpers.ts` implementation: for arbitrary
 * valid point arrays, the port must produce byte-identical output to the
 * unmodified original, verbatim import and all. This is a test-only import
 * (not a production dependency of the package) purely to prove port fidelity.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeTripMetrics } from '../tripMetrics';
// Test-only golden-master oracle (see file header) — not a production dependency of the package.
import { computeTripMetrics as originalComputeTripMetrics } from '../../../../functions/src/utils/helpers';
import { tripPointsArb } from './arbitraries';

describe('computeTripMetrics — golden-master diff against functions/src/utils/helpers.ts', () => {
  it('matches the original for a representative hand-built trip', () => {
    const points = [
      { t: 0, lat: 51.5074, lng: -0.1278, spd: 1000, hdg: 90, acc: 5 },
      { t: 1000, lat: 51.5075, lng: -0.1277, spd: 1200, hdg: 91, acc: 5 },
      { t: 2000, lat: 51.5076, lng: -0.1276, spd: 500, hdg: 95, acc: 5 }, // hard braking
      { t: 3000, lat: 51.5078, lng: -0.1274, spd: 3500, hdg: 40, acc: 5 }, // hard accel + sharp turn
      { t: 4000, lat: 51.508, lng: -0.127, spd: 3400, hdg: 42, acc: 5 },
    ];
    expect(computeTripMetrics(points, 0)).toEqual(originalComputeTripMetrics(points, 0));
  });

  it('matches the original for a single-point trip (insufficient data → default metrics)', () => {
    const points = [{ t: 0, lat: 51.5, lng: -0.1, spd: 0, hdg: 0, acc: 5 }];
    expect(computeTripMetrics(points, 0)).toEqual(originalComputeTripMetrics(points, 0));
  });

  it('matches the original for an empty trip', () => {
    expect(computeTripMetrics([], 0)).toEqual(originalComputeTripMetrics([], 0));
  });

  it('matches the original across arbitrary valid point arrays (fast-check)', () => {
    fc.assert(
      fc.property(tripPointsArb(), fc.integer(), (points, startTimestampMs) => {
        expect(computeTripMetrics(points, startTimestampMs)).toEqual(
          originalComputeTripMetrics(points, startTimestampMs)
        );
      })
    );
  });
});

describe('computeTripMetrics — shape/range assertions reproduced from trips.test.ts', () => {
  // Mirrors the assertions in `onTripStatusChange trigger` › 'computes and
  // saves score...' and 'score is within valid range 0-100' — that suite
  // only checks shape/range (it mocks the score computation), so this
  // reproduces the same checks against the real ported function.
  const points = [
    { t: 0, lat: 51.5074, lng: -0.1278, spd: 1000, hdg: 90, acc: 5 },
    { t: 1000, lat: 51.5075, lng: -0.1277, spd: 1200, hdg: 91, acc: 5 },
  ];
  const result = computeTripMetrics(points, 0);

  it('score is a number within 0-100', () => {
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('scoreBreakdown has the canonical 5 numeric fields', () => {
    expect(typeof result.scoreBreakdown.speedScore).toBe('number');
    expect(typeof result.scoreBreakdown.brakingScore).toBe('number');
    expect(typeof result.scoreBreakdown.accelerationScore).toBe('number');
    expect(typeof result.scoreBreakdown.corneringScore).toBe('number');
    expect(typeof result.scoreBreakdown.phoneUsageScore).toBe('number');
  });
});

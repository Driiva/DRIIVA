/**
 * CHARACTERISATION: computeTripMetrics (M0 Task 2; oracle retired M2 Task 1).
 *
 * M0 proved this port byte-identical to the original `functions/src/utils/
 * helpers.ts` implementation via a golden-master diff (representative trip,
 * single-point, empty, and arbitrary-point-array fast-check cases against
 * the unmodified original - see the M0 Task 2 report for the transcript).
 * M2 Task 1 repoints `functions/src/triggers/trips.ts` to this package and
 * DELETES the original from helpers.ts, so there is no longer an "original"
 * to diff against - the port fidelity that oracle proved is now locked in
 * git history rather than re-asserted on every run. What remains here is the
 * shape/range characterisation below, standing on its own against this
 * package's implementation directly.
 */
import { describe, it, expect } from 'vitest';
import { computeTripMetrics, SCORE_WEIGHTS } from '../tripMetrics';

describe('computeTripMetrics: shape/range assertions reproduced from trips.test.ts', () => {
  // Mirrors the assertions in `onTripStatusChange trigger` › 'computes and
  // saves score...' and 'score is within valid range 0-100'; that suite
  // only checks shape/range (it mocks the score computation), so this
  // reproduces the same checks against the real ported function.
  const points = [
    { t: 0, lat: 51.5074, lng: -0.1278, spd: 1000, hdg: 90, acc: 5 },
    { t: 1000, lat: 51.5075, lng: -0.1277, spd: 1200, hdg: 91, acc: 5 },
  ];
  const result = computeTripMetrics(points);

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

describe('SCORE_WEIGHTS: single source of truth for algorithm and display', () => {
  it('pins the canonical 25/25/20/20/10 weighting', () => {
    expect(SCORE_WEIGHTS).toEqual({
      speed: 0.25,
      braking: 0.25,
      acceleration: 0.2,
      cornering: 0.2,
      phoneUsage: 0.1,
    });
  });

  it('weights sum to exactly 1.0 (a full composite, no free points)', () => {
    const sum =
      SCORE_WEIGHTS.speed +
      SCORE_WEIGHTS.braking +
      SCORE_WEIGHTS.acceleration +
      SCORE_WEIGHTS.cornering +
      SCORE_WEIGHTS.phoneUsage;
    expect(sum).toBeCloseTo(1, 10);
  });
});

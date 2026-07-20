/**
 * DETERMINISM PROPERTY TESTS: computeTripMetrics (M0 Task 2).
 *
 * Permutation-stability was developed TDD-style: the property was first
 * proven to catch a broken port (RED) by temporarily removing the internal
 * `sort((a, b) => a.t - b.t)` from `tripMetrics.ts`, then restored to
 * verbatim and reconfirmed green. See the Task 2 report for the exact
 * command transcript and failure output.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeTripMetrics, haversineMeters } from '../tripMetrics';
import { tripPointsArb } from './arbitraries';

describe('haversineMeters: near-antipodal robustness', () => {
  // Exact antipode (-88.2, 0) / (88.2, 180): floating-point rounding pushes the
  // haversine `a` term fractionally above 1, so an unclamped `Math.sqrt(1 - a)`
  // takes the root of a negative number and returns NaN. The clamp keeps it finite.
  it('returns a finite distance for a near-antipodal coordinate pair (no NaN)', () => {
    const d = haversineMeters(-88.2, 0, 88.2, 180);
    expect(Number.isNaN(d)).toBe(false);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
  });
});

describe('computeTripMetrics: determinism properties', () => {
  it('score is always within [0, 100]', () => {
    fc.assert(
      fc.property(tripPointsArb(), (points) => {
        const { score } = computeTripMetrics(points);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      })
    );
  });

  it('every scoreBreakdown sub-score is within [0, 100]', () => {
    fc.assert(
      fc.property(tripPointsArb(), (points) => {
        const { scoreBreakdown } = computeTripMetrics(points);
        for (const sub of Object.values(scoreBreakdown)) {
          expect(sub).toBeGreaterThanOrEqual(0);
          expect(sub).toBeLessThanOrEqual(100);
        }
      })
    );
  });

  it('permutation-stability: shuffling input point order yields the same output', () => {
    fc.assert(
      fc.property(
        tripPointsArb().chain(points =>
          fc
            .shuffledSubarray(points, { minLength: points.length, maxLength: points.length })
            .map(shuffled => ({ points, shuffled }))
        ),
        ({ points, shuffled }) => {
          expect(computeTripMetrics(shuffled)).toEqual(computeTripMetrics(points));
        }
      )
    );
  });

  it('purity: repeated calls with the same input produce the same output', () => {
    fc.assert(
      fc.property(tripPointsArb(), (points) => {
        const first = computeTripMetrics(points);
        const second = computeTripMetrics(points);
        expect(second).toEqual(first);
      })
    );
  });
});

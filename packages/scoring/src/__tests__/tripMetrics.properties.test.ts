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
import { computeTripMetrics } from '../tripMetrics';
import { tripPointsArb } from './arbitraries';

describe('computeTripMetrics: determinism properties', () => {
  it('score is always within [0, 100]', () => {
    fc.assert(
      fc.property(tripPointsArb(), fc.integer(), (points, startTimestampMs) => {
        const { score } = computeTripMetrics(points, startTimestampMs);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      })
    );
  });

  it('every scoreBreakdown sub-score is within [0, 100]', () => {
    fc.assert(
      fc.property(tripPointsArb(), fc.integer(), (points, startTimestampMs) => {
        const { scoreBreakdown } = computeTripMetrics(points, startTimestampMs);
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
          expect(computeTripMetrics(shuffled, 0)).toEqual(computeTripMetrics(points, 0));
        }
      )
    );
  });

  it('purity: repeated calls with the same input produce the same output', () => {
    fc.assert(
      fc.property(tripPointsArb(), fc.integer(), (points, startTimestampMs) => {
        const first = computeTripMetrics(points, startTimestampMs);
        const second = computeTripMetrics(points, startTimestampMs);
        expect(second).toEqual(first);
      })
    );
  });
});

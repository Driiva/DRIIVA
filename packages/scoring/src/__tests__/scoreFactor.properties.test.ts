/**
 * DETERMINISM PROPERTY TESTS: scoreFactor (M0 Task 2).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { scoreFactor } from '../scoreFactor';

describe('scoreFactor: determinism properties', () => {
  it('is always within [0.85, 1.15] for scores in [0, 100]', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), score => {
        const factor = scoreFactor(score);
        expect(factor).toBeGreaterThanOrEqual(0.85);
        expect(factor).toBeLessThanOrEqual(1.15);
      })
    );
  });

  it('is monotonic non-increasing across [0, 100]: a higher score never yields a higher factor', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (a, b) => {
          const [lower, higher] = a <= b ? [a, b] : [b, a];
          expect(scoreFactor(higher)).toBeLessThanOrEqual(scoreFactor(lower));
        }
      )
    );
  });

  it('purity: repeated calls with the same input produce the same output', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), score => {
        expect(scoreFactor(score)).toBe(scoreFactor(score));
      })
    );
  });
});

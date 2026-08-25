/**
 * The onboarding refund estimate, held to the same cap as the real one.
 *
 * Onboarding shows a driver a pound range before they have a policy: "earn
 * back £X to £Y this year". It came from a formula written by hand in
 * mobile/hooks/useTripSeed.ts:
 *
 *     Math.round((score / 100) * 0.15 * premium)
 *
 * and the screens then widened it to a range with `refund * 0.8` and
 * `refund * 1.2`. Two problems, both of which reach a driver as a number.
 *
 * The cap. Multiplying a figure already scaled to 15% by 1.2 puts the top of
 * the range at 17.3% of the premium, past a limit the pricing treats as
 * absolute and past what the product is allowed to say. A cap applied before
 * the range is widened is not a cap.
 *
 * The divergence. This is a second refund formula sitting alongside
 * @driiva/scoring, ignoring the eligibility floor and the community blend that
 * the real one applies. The web app hit exactly this and retired its own
 * hand-rolled copy (see the WEB-17 note in client/src/pages/profile.tsx);
 * mobile still had one.
 *
 * These tests hold the estimate to the canonical calculation and hold the
 * whole displayed range under the cap.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { projectedRefundCents } from '@driiva/scoring';
import {
  seedScore,
  refundEstimate,
  refundEstimateRange,
  DEMO_PREMIUM_POUNDS,
} from '../../mobile/hooks/useTripSeed';

/** The locked cap, from CLAUDE.md Hard Stops. */
const CAP_RATE = 0.15;

describe('the demo premium is stated, not hidden in a default argument', () => {
  it('names the premium the estimate is derived from', () => {
    expect(DEMO_PREMIUM_POUNDS).toBe(1200);
  });
});

describe('refundEstimate agrees with the real calculation', () => {
  it('matches @driiva/scoring for every score, in pounds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
        const canonical = projectedRefundCents(score, DEMO_PREMIUM_POUNDS * 100);
        const expected = canonical === null ? 0 : Math.round(canonical / 100);
        expect(refundEstimate(score)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('never returns a negative estimate', () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (score) => {
        expect(refundEstimate(score)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });
});

describe('the displayed range stays inside the 15% cap', () => {
  const capPounds = DEMO_PREMIUM_POUNDS * CAP_RATE;

  it('never shows a top of range above 15% of the premium', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
        expect(refundEstimateRange(score).max).toBeLessThanOrEqual(capPounds);
      }),
      { numRuns: 200 },
    );
  });

  it('holds at the top of the seeded score band, where the old range broke it', () => {
    // seedScore is clamped to 74..96, so 96 is the worst real case. The old
    // range put this at 17.3% of the premium.
    const range = refundEstimateRange(96);
    expect(range.max).toBeLessThanOrEqual(capPounds);
    expect(range.min).toBeLessThanOrEqual(range.max);
    expect(range.min).toBeGreaterThanOrEqual(0);
  });

  it('holds for every score the seeder can actually produce', () => {
    const frequencies = ['Occasionally', 'Weekends only', 'Daily', 'Rarely'];
    const times = ['Morning commute', 'Daytime', 'Evening', 'Night'];
    const routes = ['Rural', 'Suburban', 'City centre', 'Motorway'];

    for (const frequency of frequencies) {
      for (const time of times) {
        for (const route of routes) {
          const score = seedScore({ frequency, time, routes: route } as never);
          expect(refundEstimateRange(score).max).toBeLessThanOrEqual(capPounds);
        }
      }
    }
  });

  it('keeps the range whole pounds, so a screen renders it without formatting', () => {
    const range = refundEstimateRange(85);
    expect(Number.isInteger(range.min)).toBe(true);
    expect(Number.isInteger(range.max)).toBe(true);
  });
});

/**
 * The two onboarding screens still widen the estimate themselves, with
 * `Math.round(refund * 0.8)` and `Math.round(refund * 1.2)`, and render the
 * result as a pound range. Wave B moves them onto refundEstimateRange. Until
 * it does, the arithmetic they actually run is what a driver sees, so it is
 * what has to be held under the cap.
 */
describe('the screens as they stand today', () => {
  const SCREENS = [
    'mobile/app/onboarding/quote.tsx',
    'mobile/app/onboarding/viral-moment.tsx',
  ];

  /** Every score seedScore can produce, from the real option lists. */
  function reachableScores(): number[] {
    const frequencies = ['Occasionally', 'Weekends only', 'Daily', 'Rarely'];
    const times = ['Morning commute', 'Daytime', 'Evening', 'Night'];
    const routes = ['Rural', 'Suburban', 'City centre', 'Motorway'];
    const scores: number[] = [];
    for (const frequency of frequencies) {
      for (const time of times) {
        for (const route of routes) {
          scores.push(seedScore({ frequency, time, routes: route } as never));
        }
      }
    }
    return scores;
  }

  for (const screen of SCREENS) {
    it(`${screen} cannot render a figure above the cap`, async () => {
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const source = readFileSync(join(__dirname, '..', '..', screen), 'utf-8');

      if (source.includes('refundEstimateRange')) {
        // Migrated: the cap is applied inside the helper and already tested.
        return;
      }

      // Prove the screen still runs the arithmetic this test is standing in
      // for. If the multiplier is edited and this assertion stops matching,
      // the test goes red rather than silently checking a formula nobody runs.
      expect(source).toMatch(/refund \* 1\.2/);

      const capPounds = DEMO_PREMIUM_POUNDS * CAP_RATE;
      for (const score of reachableScores()) {
        const shownMax = Math.round(refundEstimate(score) * 1.2);
        expect(shownMax).toBeLessThanOrEqual(capPounds);
      }
    });
  }
});

/**
 * PROPERTIES: the refund hard cap.
 *
 * The characterisation suite next door pins the arithmetic against known
 * inputs. This one asserts the two things that must hold for EVERY input,
 * because they are the promises the product makes rather than facts about one
 * calculation:
 *
 *   1. A refund is never more than 15% of the premium it came from. That
 *      number is locked, it is what the pricing is built on, and an example
 *      test at a round premium cannot see the cases where it breaks.
 *   2. A refund is never negative and never NaN. Both would reach a driver as
 *      a pound figure on a screen, and a negative refund is a bill.
 *
 * And one thing that must hold when there is nothing to compute from:
 *
 *   3. projectedRefundCents with no premium returns null, not 0. Zero is a
 *      calculated answer meaning "you earned nothing back". Null means "there
 *      is no policy to earn against yet", which is the true state of every
 *      driver before they buy, and the screen has to be able to tell those
 *      apart to render "Not started" instead of a fabricated pound figure.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateRefundCents, projectedRefundCents } from '../refund';

/** The locked cap, from CLAUDE.md Hard Stops. */
const CAP_RATE = 0.15;

/** Inputs in the range the product actually produces. */
const realistic = {
  personalScore: fc.double({ min: 0, max: 100, noNaN: true }),
  communityScore: fc.double({ min: 0, max: 100, noNaN: true }),
  // Up to £100,000 in cents. Well past any real motor premium.
  contributionCents: fc.integer({ min: 0, max: 10_000_000 }),
  safetyFactor: fc.double({ min: 0, max: 1, noNaN: true }),
  premiumCents: fc.integer({ min: 0, max: 10_000_000 }),
};

/**
 * Inputs nothing should ever pass but something eventually will: a premium
 * read back as a negative, a NaN from a half-written document, an Infinity
 * from a division. The function is the last thing between these and a number
 * on a screen.
 */
const hostileNumber = fc.oneof(
  fc.double({ min: -10_000_000, max: 10_000_000, noNaN: true }),
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.constant(-1),
  fc.constant(0),
);

describe('calculateRefundCents: the 15% cap holds for every input', () => {
  it('never returns more than 15% of the premium', () => {
    fc.assert(
      fc.property(
        realistic.personalScore,
        realistic.communityScore,
        realistic.contributionCents,
        realistic.safetyFactor,
        realistic.premiumCents,
        (personal, community, contribution, safety, premium) => {
          const refund = calculateRefundCents(personal, community, contribution, safety, premium);
          expect(refund).toBeLessThanOrEqual(premium * CAP_RATE);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('never returns a negative refund, and never NaN', () => {
    fc.assert(
      fc.property(
        realistic.personalScore,
        realistic.communityScore,
        realistic.contributionCents,
        realistic.safetyFactor,
        realistic.premiumCents,
        (personal, community, contribution, safety, premium) => {
          const refund = calculateRefundCents(personal, community, contribution, safety, premium);
          expect(Number.isFinite(refund)).toBe(true);
          expect(refund).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('always returns whole cents', () => {
    fc.assert(
      fc.property(
        realistic.personalScore,
        realistic.communityScore,
        realistic.contributionCents,
        realistic.safetyFactor,
        realistic.premiumCents,
        (personal, community, contribution, safety, premium) => {
          expect(
            Number.isInteger(calculateRefundCents(personal, community, contribution, safety, premium)),
          ).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('holds the cap at small premiums, where rounding can push past it', () => {
    // A premium of 10 cents caps at 1.5, and rounding that UP awards 2, which
    // is 20% of the premium. Real premiums are large enough to hide this and
    // an example test at £600 never sees it.
    for (let premium = 0; premium <= 200; premium += 1) {
      const refund = calculateRefundCents(100, 100, 10_000_000, 1, premium);
      expect(refund).toBeLessThanOrEqual(premium * CAP_RATE);
    }
  });
});

describe('calculateRefundCents: hostile input cannot become a pound figure', () => {
  it('never returns a negative or non-finite refund whatever it is handed', () => {
    fc.assert(
      fc.property(
        hostileNumber,
        hostileNumber,
        hostileNumber,
        hostileNumber,
        hostileNumber,
        (personal, community, contribution, safety, premium) => {
          const refund = calculateRefundCents(personal, community, contribution, safety, premium);
          expect(Number.isFinite(refund)).toBe(true);
          expect(refund).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 3000 },
    );
  });

  it('still respects the cap whenever the premium itself is a real amount', () => {
    fc.assert(
      fc.property(
        hostileNumber,
        hostileNumber,
        hostileNumber,
        hostileNumber,
        realistic.premiumCents,
        (personal, community, contribution, safety, premium) => {
          expect(calculateRefundCents(personal, community, contribution, safety, premium))
            .toBeLessThanOrEqual(premium * CAP_RATE);
        },
      ),
      { numRuns: 3000 },
    );
  });
});

describe('projectedRefundCents: no premium is not a refund of zero', () => {
  const noPremium = [null, undefined, 0, -1, -60000, Number.NaN, Number.POSITIVE_INFINITY];

  for (const premium of noPremium) {
    it(`returns null for a premium of ${String(premium)}`, () => {
      expect(projectedRefundCents(85, premium as number)).toBeNull();
    });
  }

  it('returns a calculated zero when there is a premium but no earned refund', () => {
    // Score below the 70 eligibility floor. This zero was computed, so it is a
    // real answer and must stay a number.
    expect(projectedRefundCents(60, 60000)).toBe(0);
  });

  it('obeys the same cap as the function it delegates to', () => {
    fc.assert(
      fc.property(
        realistic.personalScore,
        fc.integer({ min: 1, max: 10_000_000 }),
        (personal, premium) => {
          const refund = projectedRefundCents(personal, premium);
          expect(refund).not.toBeNull();
          expect(refund as number).toBeGreaterThanOrEqual(0);
          expect(refund as number).toBeLessThanOrEqual(premium * CAP_RATE);
        },
      ),
      { numRuns: 2000 },
    );
  });
});

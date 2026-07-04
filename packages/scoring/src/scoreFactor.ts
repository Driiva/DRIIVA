/**
 * SCORE FACTOR
 * ============
 * Ported verbatim from `client/src/lib/pricingEngine.ts` (`scoreFactor` at
 * :123, `scoreDiscountPercent` at :137). Byte-faithful to current behaviour.
 *
 * Single source of truth for how a Driiva driving score maps to a premium
 * multiplier. Anything that needs the discount shown to the user (e.g. the
 * checkout quote summary) must derive it from here via scoreDiscountPercent
 * so the figure displayed always matches the factor actually charged.
 *
 * NOTE: `client/src/lib/scoring.ts` is a SEPARATE engine — out of scope for
 * M0 (see the Task 2 brief); M2 consolidates it. Not ported here.
 */

/** Maximum premium swing from the driving score, applied either side of score 75. */
const SCORE_SWING = 0.15;

/** Score band over which the swing is applied (75 is neutral, 50/100 are the extremes). */
const SCORE_RANGE = 25;

/**
 * Optional driving score refinement (±15%).
 * Only applied when a score is provided (real users post-trips).
 * Score 100 → -15%; score 50 → +15%; score 75 → neutral.
 * Frozen signature (M0 Task 2 brief).
 */
export function scoreFactor(score: number | null | undefined): number {
  if (score == null) return 1.0;
  const clamped = Math.max(50, Math.min(100, score));
  // Linear: score 75 = 1.0, 100 = 0.85, 50 = 1.15
  return 1.0 - ((clamped - 75) / SCORE_RANGE) * SCORE_SWING;
}

/**
 * Premium discount percentage implied by a driving score, derived from
 * scoreFactor so the figure shown to the user matches the factor applied.
 * Returns a whole-number discount; 0 when the score implies a loading rather
 * than a discount (score below the neutral 75 midpoint).
 */
export function scoreDiscountPercent(score: number | null | undefined): number {
  return Math.max(0, Math.round((1 - scoreFactor(score)) * 100));
}

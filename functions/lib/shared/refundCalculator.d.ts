/**
 * REFUND CALCULATOR — Single source of truth for refund pool calculations
 * =======================================================================
 * All refund-related code (Cloud Functions, server, Python API) must use
 * this formula so refund amounts are consistent everywhere.
 *
 * Formula (from CLAUDE.md Hard Stops):
 *   blendedScore = 0.8 * personalScore + 0.2 * communityScore
 *   refundRate   = 5% at score 50, scaling linearly to 15% at score 100
 *   refund       = contributionCents * refundRate * safetyFactor
 *   Hard cap:      refund <= premiumCents * 0.15
 *
 * All amounts are integer cents. No floats for money.
 */
/**
 * Calculate the blended score from personal and community scores.
 * Weights: 80% personal, 20% community (locked — see CLAUDE.md Hard Stops).
 */
export declare function blendedScore(personalScore: number, communityScore: number): number;
/**
 * Calculate the refund rate (5%–15%) from a blended score (0–100).
 * Score 50 → 5%, score 100 → 15%, linear interpolation.
 * Below 50 → 5% floor. Above 100 → 15% cap.
 */
export declare function refundRate(score: number): number;
/**
 * Calculate the projected refund in integer cents.
 *
 * @param personalScore     Driver's personal safety score (0–100)
 * @param communityScore    Community average score (default 75)
 * @param contributionCents Premium contribution in integer cents
 * @param safetyFactor      Pool safety factor (0–1, typically ~0.85)
 * @param premiumCents      Total premium in cents (for hard cap)
 * @returns Refund amount in integer cents
 */
export declare function calculateRefundCents(personalScore: number, communityScore: number, contributionCents: number, safetyFactor: number, premiumCents: number): number;
/**
 * Simplified refund projection for UI display.
 * Uses default community score (75) and safety factor (0.85).
 *
 * @param personalScore  Driver's personal safety score (0–100)
 * @param premiumCents   Total premium in integer cents
 * @returns Projected refund in integer cents
 */
export declare function projectedRefundCents(personalScore: number, premiumCents: number): number;
//# sourceMappingURL=refundCalculator.d.ts.map
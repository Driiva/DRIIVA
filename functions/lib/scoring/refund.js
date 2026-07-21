"use strict";
/**
 * REFUND CALCULATOR
 * =================
 * Ported verbatim from `shared/refundCalculator.ts:44` (`functions/src/shared/refundCalculator.ts`
 * is byte-identical, verified; this ports the one canonical copy). Keeps
 * the exact arithmetic, including `blendedScore` and `refundRate`, the two
 * helpers `calculateRefundCents` depends on, and `projectedRefundCents`
 * (the simplified UI-facing wrapper), all from the same source file.
 *
 * Formula (from CLAUDE.md Hard Stops):
 *   blendedScore = 0.8 * personalScore + 0.2 * communityScore
 *   refundRate   = 5% at score 50, scaling linearly to 15% at score 100
 *   refund       = contributionCents * refundRate * safetyFactor
 *   Hard cap:      refund <= premiumCents * 0.15
 *
 * All amounts are integer cents. No floats for money.
 *
 * NOTE on naming: the rebuild plan's frozen name `calculateRefund` refers to
 * the 3-arg `telematicsProcessor.calculateRefund(score, safetyFactor, premium)`
 * convenience wrapper (see docs/rebuild/audit-api-contracts.md API-13/API-26),
 * a different signature to this 5-arg canonical function. The brief scopes
 * this task to `shared/refundCalculator.ts:44`'s `calculateRefundCents` only,
 * so no `calculateRefund` alias is exported here; the signatures don't align.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.blendedScore = blendedScore;
exports.refundRate = refundRate;
exports.calculateRefundCents = calculateRefundCents;
exports.projectedRefundCents = projectedRefundCents;
/**
 * Calculate the blended score from personal and community scores.
 * Weights: 80% personal, 20% community (locked, see CLAUDE.md Hard Stops).
 */
function blendedScore(personalScore, communityScore) {
    return 0.8 * personalScore + 0.2 * communityScore;
}
/**
 * Calculate the refund rate (5%-15%) from a blended score (0-100).
 * Score 50 → 5%, score 100 → 15%, linear interpolation.
 * Below 50 → 5% floor. Above 100 → 15% cap.
 */
function refundRate(score) {
    const clamped = Math.max(50, Math.min(100, score));
    return 0.05 + ((clamped - 50) / 50) * 0.10;
}
/**
 * Calculate the projected refund in integer cents.
 * Frozen signature (M0 Task 2 brief).
 *
 * @param personalScore     Driver's personal safety score (0-100)
 * @param communityScore    Community average score (default 75)
 * @param contributionCents Premium contribution in integer cents
 * @param safetyFactor      Pool safety factor (0-1, typically ~0.85)
 * @param premiumCents      Total premium in cents (for hard cap)
 * @returns Refund amount in integer cents
 */
function calculateRefundCents(personalScore, communityScore, contributionCents, safetyFactor, premiumCents) {
    // Eligibility: personal score must be >= 70
    if (personalScore < 70)
        return 0;
    const score = blendedScore(personalScore, communityScore);
    const rate = refundRate(score);
    const rawRefund = contributionCents * rate * safetyFactor;
    // Hard cap: refund <= premium * 15%
    const cap = Math.round(premiumCents * 0.15);
    return Math.min(Math.round(rawRefund), cap);
}
/**
 * Simplified refund projection for UI display.
 * Uses default community score (75) and safety factor (0.85).
 *
 * @param personalScore  Driver's personal safety score (0-100)
 * @param premiumCents   Total premium in integer cents
 * @returns Projected refund in integer cents
 */
function projectedRefundCents(personalScore, premiumCents) {
    const communityScore = 75;
    const safetyFactor = 0.85;
    return calculateRefundCents(personalScore, communityScore, premiumCents, safetyFactor, premiumCents);
}
//# sourceMappingURL=refund.js.map
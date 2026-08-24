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
function finiteOr(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
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
    // Sanitise at the boundary. Every argument here has reached this function
    // from a Firestore document at some point, and a half-written document
    // yields undefined, a bad division yields Infinity, and either one turns the
    // arithmetic below into NaN. NaN survives Math.min and Math.round intact and
    // comes out the other side as a pound figure on a driver's screen.
    const personal = finiteOr(personalScore, 0);
    const community = finiteOr(communityScore, 0);
    const contribution = Math.max(0, finiteOr(contributionCents, 0));
    const safety = Math.max(0, finiteOr(safetyFactor, 0));
    const premium = Math.max(0, finiteOr(premiumCents, 0));
    // Eligibility: personal score must be >= 70
    if (personal < 70)
        return 0;
    const score = blendedScore(personal, community);
    const rate = refundRate(score);
    const rawRefund = contribution * rate * safety;
    // Hard cap: refund <= premium * 15%.
    //
    // Floor, not round. Rounding a CAP is rounding the wrong direction half the
    // time: a premium of 4 cents caps at 0.6, and Math.round awards 1, which is
    // 25% of the premium and past a limit the pricing model treats as absolute.
    // Real premiums are large enough that nobody would ever see it, which is
    // exactly why it survived; a property test over every premium does see it.
    const cap = Math.floor(premium * 0.15);
    return Math.max(0, Math.min(Math.round(rawRefund), cap));
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
    // No premium is not a refund of zero.
    //
    // Zero is a calculated answer: it means the driver has a policy and has
    // earned nothing back from it yet. Null means there is no policy to earn
    // against, which is the true state of every driver before they buy. Handing
    // both back as 0 let the screens render a confident "£0.00" at a driver who
    // had simply never started, and left no way to tell the two apart. Callers
    // render the empty state on null and a real figure on a number.
    if (typeof premiumCents !== 'number' || !Number.isFinite(premiumCents) || premiumCents <= 0) {
        return null;
    }
    const communityScore = 75;
    const safetyFactor = 0.85;
    return calculateRefundCents(personalScore, communityScore, premiumCents, safetyFactor, premiumCents);
}
//# sourceMappingURL=refund.js.map
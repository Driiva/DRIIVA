/**
 * BETA ESTIMATE PRICING & REFUND CALCULATOR
 * ==========================================
 * Deterministic, non-binding premium and refund estimates for UX and learning.
 * Designed so internals can be swapped for Root/MGA API later without changing
 * the function signature or Firestore document shape.
 */
export declare const BETA_ESTIMATE_VERSION = "beta-v1";
export interface BetaEstimateInput {
    personalScore: number | null | undefined;
    age: number | null | undefined;
    postcode: string | null | undefined;
    communityPoolSafety: number | null | undefined;
}
export interface BetaEstimateResult {
    estimatedPremium: number;
    minPremium: number;
    maxPremium: number;
    refundRate: number;
    estimatedRefund: number;
    estimatedNetCost: number;
}
/**
 * Extract outward code from UK postcode (e.g. "SW1A 1AA" → "SW1").
 */
export declare function extractOutwardCode(postcode: string): string;
/**
 * Compute beta premium and refund estimate from user inputs.
 * Returns null if required fields are missing (no write to Firestore).
 */
export declare function calculateBetaEstimate(input: BetaEstimateInput): BetaEstimateResult | null;
//# sourceMappingURL=betaEstimateService.d.ts.map
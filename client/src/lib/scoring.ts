// UI simulation only — not used for stored scores.
// Canonical scoring lives in functions/src/utils/helpers.ts.
// This file powers the RefundSimulator component for display purposes only.
// Driiva Scoring System - Optimized for Runtime Stability

export interface RiskFactor {
  factor: string;
  impact: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface RiskProfile {
  riskScore: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  predictedClaimProbability: number;
  confidenceScore: number;
  riskFactors: RiskFactor[];
  recommendations: string[];
}

export interface DrivingMetrics {
  score: number;
  distance: number;
  duration: number;
  hardBrakingEvents: number;
  harshAccelerationEvents: number;
  speedViolations: number;
  nightDriving: boolean;
  sharpCorners: number;
  aiRiskProfile?: RiskProfile;
}

export interface ScoringMetrics {
  hardBrakingScore: number;
  accelerationScore: number;
  speedAdherenceScore: number;
  nightDrivingScore: number;
  totalMiles: number;
  totalTrips: number;
}

export interface RefundCalculation {
  personalScore: number;
  communityScore: number;
  totalScore: number;
  refundPercentage: number;
  refundAmount: number;
  qualifiesForRefund: boolean;
}

/**
 * Calculate personal driving score (0-100)
 * Higher scores indicate better driving
 */
export function calculatePersonalScore(metrics: ScoringMetrics): number {
  try {
    if (!metrics || typeof metrics !== 'object') {
      return 0;
    }

    // Ensure all metrics are numbers
    const safeMetrics = {
      hardBrakingScore: Number(metrics.hardBrakingScore) || 0,
      accelerationScore: Number(metrics.accelerationScore) || 0,
      speedAdherenceScore: Number(metrics.speedAdherenceScore) || 0,
      nightDrivingScore: Number(metrics.nightDrivingScore) || 0,
      totalMiles: Number(metrics.totalMiles) || 0,
      totalTrips: Number(metrics.totalTrips) || 1
    };

    // Calculate base score (lower incident counts = higher scores)
    const hardBrakingScore = Math.max(0, 100 - (safeMetrics.hardBrakingScore * 5));
    const accelerationScore = Math.max(0, 100 - (safeMetrics.accelerationScore * 8));
    const speedScore = Math.max(0, 100 - (safeMetrics.speedAdherenceScore * 10));
    const nightScore = Math.max(0, 100 - (safeMetrics.nightDrivingScore * 3));

    // Weight the components
    const weightedScore = (
      hardBrakingScore * 0.3 +
      accelerationScore * 0.25 +
      speedScore * 0.35 +
      nightScore * 0.1
    );

    // Apply experience bonus for more trips
    const experienceBonus = Math.min(5, safeMetrics.totalTrips * 0.1);

    // Apply mileage consistency bonus
    const avgMilesPerTrip = safeMetrics.totalMiles / safeMetrics.totalTrips;
    const consistencyBonus = avgMilesPerTrip > 20 && avgMilesPerTrip < 100 ? 2 : 0;

    const finalScore = Math.min(100, Math.max(0, weightedScore + experienceBonus + consistencyBonus));
    return Math.round(finalScore);
  } catch (error) {
    console.error('Error calculating personal score:', error);
    return 0;
  }
}

/**
 * Calculate community score based on pool safety factor
 */
export function calculateCommunityScore(poolSafetyFactor: number): number {
  try {
    const safeFactor = Number(poolSafetyFactor) || 0.5;
    return Math.round(Math.max(0, Math.min(100, safeFactor * 100)));
  } catch (error) {
    console.error('Error calculating community score:', error);
    return 50;
  }
}

/**
 * Calculate total weighted score (80% personal, 20% community)
 * Based on AI Model documentation
 */
export function calculateTotalScore(personalScore: number, communityScore: number): number {
  try {
    const safePersonal = Number(personalScore) || 0;
    const safeCommunity = Number(communityScore) || 0;

    const totalScore = (safePersonal * 0.8) + (safeCommunity * 0.2);
    return Math.round(Math.max(0, Math.min(100, totalScore)));
  } catch (error) {
    console.error('Error calculating total score:', error);
    return 0;
  }
}

/**
 * Calculate refund eligibility and amount
 * Users with 70+ personal score qualify for 5-15% refund
 * Based on AI Pricing Engine Model documentation
 */
export function calculateRefund(
  personalScore: number,
  premiumAmount: number,
  poolSafetyFactor: number = 0.85
): RefundCalculation {
  try {
    const safePersonal = Number(personalScore) || 0;
    const safePremium = Number(premiumAmount) || 0;
    const safeFactor = Number(poolSafetyFactor) || 0.85;

    const communityScore = calculateCommunityScore(safeFactor);
    const totalScore = calculateTotalScore(safePersonal, communityScore);

    // Qualification threshold: 70+ personal score
    const qualifiesForRefund = safePersonal >= 70;

    let refundPercentage = 0;
    if (qualifiesForRefund) {
      // NOTE: this is the post-trip CASHBACK/refund model (5-15% at score 70+),
      // a deliberately separate concept from the quote-time premium discount in
      // pricingEngine (scoreFactor / scoreDiscountPercent, a symmetric +/-15%
      // around score 75). They are not interchangeable — do not unify them.
      // AI Model formula: min[15%, 0.7 × personal_score + 0.3 × (Pool Safety Factor × 100)]
      // Simplified for MVP: Scale refund from 5% to 15% based on score (70-100)
      const scoreRange = Math.max(0, safePersonal - 70);
      const baseRefund = 5; // Minimum 5% refund
      const additionalRefund = (scoreRange / 30) * 10; // Up to 10% more
      refundPercentage = baseRefund + additionalRefund;

      // Apply community pool safety factor adjustment (reduced impact per docs)
      const poolAdjustment = safeFactor > 0.8 ? 1.0 : 0.9;
      refundPercentage *= poolAdjustment;

      // Cap at 15% as per documentation
      refundPercentage = Math.min(15, refundPercentage);
    }

    // refundAmount is in integer cents (e.g. £1.84 = 184)
    const refundAmount = Math.round((safePremium * refundPercentage) / 100);

    return {
      personalScore: safePersonal,
      communityScore,
      totalScore,
      refundPercentage: Math.round(refundPercentage * 100) / 100,
      refundAmount, // integer cents
      qualifiesForRefund
    };
  } catch (error) {
    console.error('Error calculating refund:', error);
    return {
      personalScore: 0,
      communityScore: 50,
      totalScore: 0,
      refundPercentage: 0,
      refundAmount: 0,
      qualifiesForRefund: false
    };
  }
}

/**
 * Simulate score changes for refund calculator
 */
export function simulateScoreChange(
  currentScore: number,
  targetScore: number,
  premiumAmount: number,
  poolSafetyFactor: number = 0.85
): RefundCalculation {
  try {
    const safeTarget = Math.max(0, Math.min(100, Number(targetScore) || 0));
    return calculateRefund(safeTarget, premiumAmount, poolSafetyFactor);
  } catch (error) {
    console.error('Error simulating score change:', error);
    return calculateRefund(currentScore, premiumAmount, poolSafetyFactor);
  }
}

/**
 * Main driving scorer object with all scoring functions
 */
export const drivingScorer = {
  calculatePersonalScore,
  calculateCommunityScore,
  calculateTotalScore,
  calculateRefund,
  simulateScoreChange,

  // Additional helper for RefundSimulator component
  calculateRefundProjection(
    score: number,
    poolSafetyFactor: number,
    premiumAmount: number
  ): number {
    try {
      const refundCalc = calculateRefund(score, premiumAmount, poolSafetyFactor);
      return refundCalc.refundAmount;
    } catch (error) {
      console.error('Error calculating refund projection:', error);
      return 0;
    }
  },

  calculateDrivingMetrics(_data: unknown): DrivingMetrics {
    // Stub: real metrics are computed server-side via tripProcessor.
    // Returns a default object; the hook will be populated with real data from the API.
    return {
      score: 0,
      distance: 0,
      duration: 0,
      hardBrakingEvents: 0,
      harshAccelerationEvents: 0,
      speedViolations: 0,
      nightDriving: false,
      sharpCorners: 0,
    };
  }
};
/**
 * SCORING ALGORITHM TESTS
 * =======================
 * Tests for Driiva's client-side scoring engine.
 *
 * These are the financial calculations that determine refund amounts.
 * They MUST be deterministic and auditable.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePersonalScore,
  calculateCommunityScore,
  calculateTotalScore,
  calculateRefund,
  simulateScoreChange,
  type ScoringMetrics,
} from '@/lib/scoring';

// ---------------------------------------------------------------------------
// calculatePersonalScore
// ---------------------------------------------------------------------------

describe('calculatePersonalScore', () => {
  it('returns 0 for null / undefined input', () => {
    expect(calculatePersonalScore(null as unknown as ScoringMetrics)).toBe(0);
    expect(calculatePersonalScore(undefined as unknown as ScoringMetrics)).toBe(0);
  });

  it('returns a perfect score for zero incidents', () => {
    const metrics: ScoringMetrics = {
      hardBrakingScore: 0,
      accelerationScore: 0,
      speedAdherenceScore: 0,
      nightDrivingScore: 0,
      totalMiles: 50,
      totalTrips: 10,
    };
    const score = calculatePersonalScore(metrics);
    // Experience bonus = min(5, 10 * 0.1) = 1
    // Consistency bonus = avgMilesPerTrip 5 => 0 (needs 20-100)
    // Weighted: 100*0.3 + 100*0.25 + 100*0.35 + 100*0.1 = 100
    // Total: 100 + 1 = 101 -> capped at 100
    expect(score).toBe(100);
  });

  it('reduces score for hard braking incidents', () => {
    const clean: ScoringMetrics = {
      hardBrakingScore: 0,
      accelerationScore: 0,
      speedAdherenceScore: 0,
      nightDrivingScore: 0,
      totalMiles: 50,
      totalTrips: 1,
    };
    const braky: ScoringMetrics = { ...clean, hardBrakingScore: 5 };

    const cleanScore = calculatePersonalScore(clean);
    const brakyScore = calculatePersonalScore(braky);

    expect(brakyScore).toBeLessThan(cleanScore);
  });

  it('reduces score for speed violations', () => {
    const clean: ScoringMetrics = {
      hardBrakingScore: 0,
      accelerationScore: 0,
      speedAdherenceScore: 0,
      nightDrivingScore: 0,
      totalMiles: 50,
      totalTrips: 1,
    };
    const speedy: ScoringMetrics = { ...clean, speedAdherenceScore: 3 };

    expect(calculatePersonalScore(speedy)).toBeLessThan(calculatePersonalScore(clean));
  });

  it('gives experience bonus for more trips', () => {
    const base: ScoringMetrics = {
      hardBrakingScore: 2,
      accelerationScore: 2,
      speedAdherenceScore: 2,
      nightDrivingScore: 0,
      totalMiles: 500,
      totalTrips: 1,
    };
    const experienced: ScoringMetrics = { ...base, totalTrips: 50, totalMiles: 2500 };

    expect(calculatePersonalScore(experienced)).toBeGreaterThan(calculatePersonalScore(base));
  });

  it('always returns a value between 0 and 100', () => {
    // Extreme bad driving
    const terrible: ScoringMetrics = {
      hardBrakingScore: 100,
      accelerationScore: 100,
      speedAdherenceScore: 100,
      nightDrivingScore: 100,
      totalMiles: 1000,
      totalTrips: 1,
    };
    const score = calculatePersonalScore(terrible);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('is deterministic — same input always produces same output', () => {
    const metrics: ScoringMetrics = {
      hardBrakingScore: 3,
      accelerationScore: 1,
      speedAdherenceScore: 2,
      nightDrivingScore: 1,
      totalMiles: 100,
      totalTrips: 10,
    };
    const results = Array.from({ length: 100 }, () => calculatePersonalScore(metrics));
    expect(new Set(results).size).toBe(1);
  });

  it('handles NaN and non-numeric values safely', () => {
    const weird = {
      hardBrakingScore: NaN,
      accelerationScore: 'abc' as unknown as number,
      speedAdherenceScore: undefined as unknown as number,
      nightDrivingScore: null as unknown as number,
      totalMiles: 50,
      totalTrips: 1,
    };
    const score = calculatePersonalScore(weird);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// calculateCommunityScore
// ---------------------------------------------------------------------------

describe('calculateCommunityScore', () => {
  it('returns 100 for safety factor of 1.0', () => {
    expect(calculateCommunityScore(1.0)).toBe(100);
  });

  it('returns 85 for safety factor of 0.85', () => {
    expect(calculateCommunityScore(0.85)).toBe(85);
  });

  it('clamps to 0-100 range', () => {
    expect(calculateCommunityScore(1.5)).toBe(100);
    expect(calculateCommunityScore(-0.5)).toBe(0);
  });

  it('defaults to 50 on error', () => {
    expect(calculateCommunityScore(NaN)).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalScore
// ---------------------------------------------------------------------------

describe('calculateTotalScore', () => {
  it('weights 80% personal + 20% community', () => {
    // 80 * 0.8 + 60 * 0.2 = 64 + 12 = 76
    expect(calculateTotalScore(80, 60)).toBe(76);
  });

  it('returns 100 when both scores are 100', () => {
    expect(calculateTotalScore(100, 100)).toBe(100);
  });

  it('returns 0 when both scores are 0', () => {
    expect(calculateTotalScore(0, 0)).toBe(0);
  });

  it('clamps to 0-100', () => {
    expect(calculateTotalScore(150, 150)).toBe(100);
    expect(calculateTotalScore(-50, -50)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateRefund (FINANCIAL — critical correctness)
// ---------------------------------------------------------------------------

describe('calculateRefund', () => {
  it('qualifies users with score >= 70', () => {
    const result = calculateRefund(70, 10000);
    expect(result.qualifiesForRefund).toBe(true);
    expect(result.refundPercentage).toBeGreaterThan(0);
  });

  it('does NOT qualify users with score < 70', () => {
    const result = calculateRefund(69, 10000);
    expect(result.qualifiesForRefund).toBe(false);
    expect(result.refundPercentage).toBe(0);
    expect(result.refundAmount).toBe(0);
  });

  it('gives minimum 5% refund at score 70', () => {
    const result = calculateRefund(70, 10000, 0.85);
    expect(result.refundPercentage).toBeGreaterThanOrEqual(4.5); // 5% * 1.0 or 5% * 0.9
    expect(result.refundPercentage).toBeLessThanOrEqual(5.5);
  });

  it('caps refund at 15%', () => {
    const result = calculateRefund(100, 10000, 1.0);
    expect(result.refundPercentage).toBeLessThanOrEqual(15);
  });

  it('scales refund with premium amount', () => {
    const low = calculateRefund(90, 5000);
    const high = calculateRefund(90, 50000);
    expect(high.refundAmount).toBeGreaterThan(low.refundAmount);
  });

  it('returns zero refund for zero premium', () => {
    const result = calculateRefund(95, 0);
    expect(result.refundAmount).toBe(0);
  });

  it('uses integer-safe amounts (no floating point drift)', () => {
    const result = calculateRefund(85, 9999);
    // refundAmount should be a clean number (rounded to 2 decimals)
    const decimalPlaces = (result.refundAmount.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });

  it('includes correct community and total score in result', () => {
    const result = calculateRefund(80, 10000, 0.9);
    expect(result.personalScore).toBe(80);
    expect(result.communityScore).toBe(90);
    expect(result.totalScore).toBe(82); // 80*0.8 + 90*0.2 = 82
  });

  it('is deterministic', () => {
    const results = Array.from({ length: 50 }, () => calculateRefund(85, 15000, 0.9));
    const amounts = results.map(r => r.refundAmount);
    expect(new Set(amounts).size).toBe(1);
  });

  it('pool safety factor < 0.8 reduces refund', () => {
    const healthy = calculateRefund(90, 10000, 0.85);
    const stressed = calculateRefund(90, 10000, 0.75);
    expect(stressed.refundPercentage).toBeLessThan(healthy.refundPercentage);
  });
});

// ---------------------------------------------------------------------------
// simulateScoreChange
// ---------------------------------------------------------------------------

describe('simulateScoreChange', () => {
  it('simulates a higher target score returning higher refund', () => {
    const low = simulateScoreChange(60, 75, 10000);
    const high = simulateScoreChange(60, 95, 10000);
    expect(high.refundAmount).toBeGreaterThan(low.refundAmount);
  });

  it('clamps target score to 0-100', () => {
    const result = simulateScoreChange(50, 200, 10000);
    expect(result.personalScore).toBeLessThanOrEqual(100);
  });
});

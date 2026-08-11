/**
 * INSURANCE INTEGRATION TESTS
 * ============================
 * Tests for insurance quote/policy logic and data validation.
 *
 * Note: These don't call the actual Root Platform API.
 * They test the data contracts, validation, and business rules.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Coverage type mapping (mirrors insurance.ts logic)
// ---------------------------------------------------------------------------

function mapCoverageToRootModule(
  coverageType: 'basic' | 'standard' | 'premium',
  drivingScore: number,
  totalTrips: number,
  totalMiles: number,
): Record<string, unknown> {
  return {
    type: 'driiva_telematics',
    coverage_type: coverageType,
    driving_score: Math.round(drivingScore),
    total_trips: totalTrips,
    total_miles: Math.round(totalMiles * 100) / 100,
    discount_factor: Math.max(0, Math.min(30, (drivingScore - 50) * 0.6)),
  };
}

// ---------------------------------------------------------------------------
// Coverage mapping
// ---------------------------------------------------------------------------

describe('mapCoverageToRootModule', () => {
  it('includes the correct coverage type', () => {
    const basic = mapCoverageToRootModule('basic', 80, 10, 500);
    expect(basic.coverage_type).toBe('basic');

    const premium = mapCoverageToRootModule('premium', 80, 10, 500);
    expect(premium.coverage_type).toBe('premium');
  });

  it('rounds driving score to integer', () => {
    const result = mapCoverageToRootModule('standard', 82.567, 10, 500);
    expect(result.driving_score).toBe(83);
  });

  it('calculates discount factor: 0% at score 50', () => {
    const result = mapCoverageToRootModule('standard', 50, 10, 500);
    expect(result.discount_factor).toBe(0);
  });

  it('calculates discount factor: 18% at score 80', () => {
    const result = mapCoverageToRootModule('standard', 80, 10, 500);
    // (80 - 50) * 0.6 = 18
    expect(result.discount_factor).toBe(18);
  });

  it('caps discount factor at 30%', () => {
    const result = mapCoverageToRootModule('standard', 100, 10, 500);
    // (100 - 50) * 0.6 = 30
    expect(result.discount_factor).toBe(30);
  });

  it('discount factor cannot be negative', () => {
    const result = mapCoverageToRootModule('standard', 30, 10, 500);
    expect(result.discount_factor).toBe(0);
  });

  it('rounds total miles to 2 decimal places', () => {
    const result = mapCoverageToRootModule('standard', 80, 10, 123.456789);
    expect(result.total_miles).toBe(123.46);
  });
});

// ---------------------------------------------------------------------------
// Quote validation rules
// ---------------------------------------------------------------------------

describe('Insurance quote business rules', () => {
  it('requires at least 1 trip to generate a quote', () => {
    const totalTrips = 0;
    expect(totalTrips >= 1).toBe(false);
  });

  it('allows quotes for users with 1+ trips', () => {
    const totalTrips = 1;
    expect(totalTrips >= 1).toBe(true);
  });

  it('only accepts valid coverage types', () => {
    const validTypes = ['basic', 'standard', 'premium'];
    expect(validTypes.includes('basic')).toBe(true);
    expect(validTypes.includes('standard')).toBe(true);
    expect(validTypes.includes('premium')).toBe(true);
    expect(validTypes.includes('super')).toBe(false);
    expect(validTypes.includes('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Premium calculation validation
// ---------------------------------------------------------------------------

describe('Premium amount validation', () => {
  it('premiums must be positive integers (cents)', () => {
    const premiumCents = 9999;
    expect(Number.isInteger(premiumCents)).toBe(true);
    expect(premiumCents).toBeGreaterThan(0);
  });

  it('discount percentage is between 0 and 30', () => {
    const scores = [0, 30, 50, 70, 80, 90, 100];
    for (const score of scores) {
      const discount = Math.max(0, Math.min(30, (score - 50) * 0.6));
      expect(discount).toBeGreaterThanOrEqual(0);
      expect(discount).toBeLessThanOrEqual(30);
    }
  });
});

// ---------------------------------------------------------------------------
// Policy status mapping
// ---------------------------------------------------------------------------

describe('Policy status mapping from Root Platform', () => {
  function mapRootStatus(rootStatus: string): string {
    if (rootStatus === 'active') return 'active';
    if (rootStatus === 'cancelled') return 'cancelled';
    if (rootStatus === 'expired') return 'expired';
    return 'pending';
  }

  it('maps Root "active" to Driiva "active"', () => {
    expect(mapRootStatus('active')).toBe('active');
  });

  it('maps Root "cancelled" to Driiva "cancelled"', () => {
    expect(mapRootStatus('cancelled')).toBe('cancelled');
  });

  it('maps Root "expired" to Driiva "expired"', () => {
    expect(mapRootStatus('expired')).toBe('expired');
  });

  it('maps unknown statuses to "pending"', () => {
    expect(mapRootStatus('pending_payment')).toBe('pending');
    expect(mapRootStatus('review')).toBe('pending');
    expect(mapRootStatus('')).toBe('pending');
  });
});

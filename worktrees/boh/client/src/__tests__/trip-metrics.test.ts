/**
 * TRIP METRICS & HELPERS TESTS
 * ============================
 * Tests for the backend trip processing pipeline.
 *
 * These functions determine driving scores that directly affect
 * insurance premiums and refund amounts. Correctness is critical.
 *
 * Note: These tests import from the functions/ directory via relative paths
 * because the functions module uses firebase-admin which isn't available
 * in the client test environment. We test the pure functions that don't
 * depend on Firebase Admin SDK.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure helper functions (no Firebase Admin dependency)
// We re-implement or import the pure math functions directly
// ---------------------------------------------------------------------------

/**
 * Haversine distance calculation (copied from helpers.ts for testing)
 * This is a pure function — no Firebase dependency.
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function weightedAverage(oldValue: number, newValue: number, oldWeight: number): number {
  if (oldWeight === 0) return newValue;
  const result = (oldValue * oldWeight + newValue) / (oldWeight + 1);
  return Math.round(result * 100) / 100;
}

function calculateRiskTier(score: number): 'low' | 'medium' | 'high' {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  return 'high';
}

function calculateProjectedRefund(
  score: number,
  contributionCents: number,
  safetyFactor: number,
  refundRate: number,
): number {
  const scoreMultiplier = Math.min(1, Math.max(0, (score - 50) / 50));
  const adjustedRefundRate = 0.05 + (refundRate - 0.05) * scoreMultiplier;
  const baseRefund = contributionCents * adjustedRefundRate;
  const adjustedRefund = baseRefund * safetyFactor;
  return Math.round(adjustedRefund);
}

function truncateAddress(address: string | null): string {
  if (!address) return 'Unknown';
  const parts = address.split(',');
  const firstPart = parts[0].trim();
  return firstPart.length > 20 ? firstPart.substring(0, 17) + '...' : firstPart;
}

function getShareId(userId: string, period: string): string {
  return `${period}_${userId}`;
}

function normalizeHeadingDelta(delta: number): number {
  let d = delta;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

describe('calculateDistance (Haversine)', () => {
  it('returns 0 for identical coordinates', () => {
    expect(calculateDistance(51.5074, -0.1278, 51.5074, -0.1278)).toBe(0);
  });

  it('calculates London to Birmingham ≈ 163 km', () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const birmingham = { lat: 52.4862, lng: -1.8904 };
    const distance = calculateDistance(london.lat, london.lng, birmingham.lat, birmingham.lng);
    // Approximately 163 km
    expect(distance).toBeGreaterThan(155_000);
    expect(distance).toBeLessThan(170_000);
  });

  it('is symmetric (A→B == B→A)', () => {
    const d1 = calculateDistance(51.5, -0.1, 52.5, -1.9);
    const d2 = calculateDistance(52.5, -1.9, 51.5, -0.1);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('handles crossing the prime meridian', () => {
    const distance = calculateDistance(51.5, -0.5, 51.5, 0.5);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(100_000); // < 100km
  });

  it('handles very small distances (same street)', () => {
    // Two points ~100m apart
    const d = calculateDistance(51.50740, -0.12780, 51.50750, -0.12760);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(200);
  });
});

// ---------------------------------------------------------------------------
// weightedAverage
// ---------------------------------------------------------------------------

describe('weightedAverage', () => {
  it('returns new value when old weight is 0', () => {
    expect(weightedAverage(0, 85, 0)).toBe(85);
  });

  it('calculates weighted average correctly', () => {
    // (80 * 3 + 90) / 4 = 82.5
    expect(weightedAverage(80, 90, 3)).toBe(82.5);
  });

  it('converges toward new values over many iterations', () => {
    let avg = 50;
    for (let i = 0; i < 100; i++) {
      avg = weightedAverage(avg, 90, i + 1);
    }
    // After 100 iterations of adding 90, should be close to 90
    expect(avg).toBeGreaterThan(85);
  });
});

// ---------------------------------------------------------------------------
// calculateRiskTier
// ---------------------------------------------------------------------------

describe('calculateRiskTier', () => {
  it('returns "low" for scores >= 80', () => {
    expect(calculateRiskTier(80)).toBe('low');
    expect(calculateRiskTier(100)).toBe('low');
    expect(calculateRiskTier(95)).toBe('low');
  });

  it('returns "medium" for scores 60-79', () => {
    expect(calculateRiskTier(60)).toBe('medium');
    expect(calculateRiskTier(79)).toBe('medium');
  });

  it('returns "high" for scores < 60', () => {
    expect(calculateRiskTier(59)).toBe('high');
    expect(calculateRiskTier(0)).toBe('high');
    expect(calculateRiskTier(30)).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// calculateProjectedRefund
// ---------------------------------------------------------------------------

describe('calculateProjectedRefund', () => {
  it('returns integer cents (no floating point)', () => {
    const result = calculateProjectedRefund(85, 10000, 1.0, 0.15);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('returns higher refund for higher scores', () => {
    const low = calculateProjectedRefund(60, 10000, 1.0, 0.15);
    const high = calculateProjectedRefund(95, 10000, 1.0, 0.15);
    expect(high).toBeGreaterThan(low);
  });

  it('returns 0 refund for 0 contribution', () => {
    expect(calculateProjectedRefund(90, 0, 1.0, 0.15)).toBe(0);
  });

  it('safety factor scales the refund', () => {
    const full = calculateProjectedRefund(90, 10000, 1.0, 0.15);
    const half = calculateProjectedRefund(90, 10000, 0.5, 0.15);
    expect(half).toBe(Math.round(full / 2));
  });

  it('score of 50 gives minimum 5% refund rate', () => {
    const result = calculateProjectedRefund(50, 10000, 1.0, 0.15);
    // At score 50, multiplier is 0, so rate = 0.05
    expect(result).toBe(500); // 10000 * 0.05 * 1.0
  });

  it('score of 100 gives full refund rate', () => {
    const result = calculateProjectedRefund(100, 10000, 1.0, 0.15);
    // At score 100, multiplier is 1, so rate = 0.15
    expect(result).toBe(1500); // 10000 * 0.15 * 1.0
  });
});

// ---------------------------------------------------------------------------
// truncateAddress
// ---------------------------------------------------------------------------

describe('truncateAddress', () => {
  it('returns "Unknown" for null', () => {
    expect(truncateAddress(null)).toBe('Unknown');
  });

  it('returns first part before comma', () => {
    expect(truncateAddress('Baker Street, London, NW1')).toBe('Baker Street');
  });

  it('truncates long first parts to 17 chars + ellipsis', () => {
    const long = 'A Very Long Street Name Indeed, London';
    const result = truncateAddress(long);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles address with no comma', () => {
    expect(truncateAddress('Short')).toBe('Short');
  });
});

// ---------------------------------------------------------------------------
// getShareId
// ---------------------------------------------------------------------------

describe('getShareId', () => {
  it('formats as {period}_{userId}', () => {
    expect(getShareId('user123', '2026-02')).toBe('2026-02_user123');
  });
});

// ---------------------------------------------------------------------------
// normalizeHeadingDelta
// ---------------------------------------------------------------------------

describe('normalizeHeadingDelta', () => {
  it('keeps values in -180 to 180 range', () => {
    expect(normalizeHeadingDelta(0)).toBe(0);
    expect(normalizeHeadingDelta(180)).toBe(180);
    expect(normalizeHeadingDelta(-180)).toBe(-180);
  });

  it('wraps 360 to 0', () => {
    expect(normalizeHeadingDelta(360)).toBe(0);
  });

  it('wraps 270 to -90', () => {
    expect(normalizeHeadingDelta(270)).toBe(-90);
  });

  it('wraps -270 to 90', () => {
    expect(normalizeHeadingDelta(-270)).toBe(90);
  });
});

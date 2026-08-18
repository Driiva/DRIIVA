/**
 * RESOLVED: phone-usage wiring (M2-DEC-1 Option A).
 *
 * This suite used to pin the OPPOSITE of what it asserts now: that
 * `events.phonePickupCount` could never leave 0 because `computeTripMetrics`
 * had no input to carry a pickup signal on. That gap is documented in
 * docs/rebuild/m2-dec-1-phone-usage.md, which recommended Option A (wire the
 * signal through) as its explicit recommendation, and this suite's job was to
 * force a conscious decision before anyone closed it. `computeTripMetrics`
 * now takes an optional `clientReportedPhonePickupCount` second parameter -
 * see that function's header comment in ../tripMetrics.ts for the full
 * rationale, and `sanitizePhonePickupCount` for what "wired" means here (a
 * client-reported number the server sanitises and rate-caps, not one it can
 * independently verify).
 *
 * What stays pinned below: the two cases where phone-usage is STILL always
 * 100, because they are still true and worth guarding -
 *   - no count is passed at all (a caller that has not been updated), and
 *   - the degenerate short-trip default path, which never reaches the
 *     pickup-count parameter at all.
 * What is new: non-zero counts actually move `events.phonePickupCount` and
 * `phoneUsageScore`, deterministically, and the sanitiser's guards
 * (non-finite/negative rejected, rate capped) are exercised directly.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { TripPoint } from '@driiva/contracts';
import { computeTripMetrics } from '../tripMetrics';
import { tripPointsArb } from './arbitraries';

describe('phone-usage: still neutral 100 when no count is reported', () => {
  it('phonePickupCount stays 0 for every realistic TripPoint stream when the second argument is omitted', () => {
    fc.assert(
      fc.property(tripPointsArb(), (points) => {
        expect(computeTripMetrics(points).events.phonePickupCount).toBe(0);
      })
    );
  });

  it('phoneUsageScore is exactly 100 for every realistic TripPoint stream when the second argument is omitted', () => {
    fc.assert(
      fc.property(tripPointsArb(), (points) => {
        expect(computeTripMetrics(points).scoreBreakdown.phoneUsageScore).toBe(100);
      })
    );
  });

  it('the degenerate short-trip default path reports a neutral 100 even if a count is passed', () => {
    // Fewer than 2 points takes the getDefaultMetrics branch, which returns
    // before clientReportedPhonePickupCount is ever read. A <2-point trip
    // never reaches computeTripMetrics in production anyway - finalizeTripFromPoints
    // marks it failed first - so this is a degenerate-input guard, not a
    // production path, and it stays aligned with the events default.
    const { scoreBreakdown, events } = computeTripMetrics(
      [{ t: 0, lat: 51.5074, lng: -0.1278, spd: 1000, hdg: 90, acc: 5 }],
      7
    );

    expect(events.phonePickupCount).toBe(0);
    expect(scoreBreakdown.phoneUsageScore).toBe(100);
  });
});

describe('phone-usage: a reported count now moves the score (M2-DEC-1 Option A)', () => {
  const points: TripPoint[] = Array.from({ length: 11 }, (_, i) => ({
    t: i * 60_000, // 1 point/minute, 10 minutes total
    lat: 51.5074 + i * 0.001,
    lng: -0.1278,
    spd: 1000,
    hdg: 90,
    acc: 5,
  }));

  it('a non-zero, in-range count is reflected exactly in events.phonePickupCount', () => {
    const { events } = computeTripMetrics(points, 2);
    expect(events.phonePickupCount).toBe(2);
  });

  it('phoneUsageScore drops as the reported rate rises, deterministically, floor 20', () => {
    // 10-minute trip: rate = count per 10 min directly.
    // score = max(20, round(100 - rate*16)) per computePhoneUsageScore.
    expect(computeTripMetrics(points, 0).scoreBreakdown.phoneUsageScore).toBe(100);
    expect(computeTripMetrics(points, 1).scoreBreakdown.phoneUsageScore).toBe(84);
    expect(computeTripMetrics(points, 5).scoreBreakdown.phoneUsageScore).toBe(20); // floor
  });

  it('same input -> same output (deterministic, no hidden state between calls)', () => {
    const a = computeTripMetrics(points, 2);
    const b = computeTripMetrics(points, 2);
    expect(a).toEqual(b);
  });

  it('a worse phoneUsageScore pulls the overall composite score down (10% weight is live, not a free +10)', () => {
    const clean = computeTripMetrics(points, 0).score;
    const withPickups = computeTripMetrics(points, 5).score;
    expect(withPickups).toBeLessThan(clean);
  });
});

describe('phone-usage: sanitizePhonePickupCount guards (via computeTripMetrics)', () => {
  const points: TripPoint[] = [
    { t: 0, lat: 51.5074, lng: -0.1278, spd: 1000, hdg: 90, acc: 5 },
    { t: 60_000, lat: 51.5084, lng: -0.1278, spd: 1000, hdg: 90, acc: 5 },
  ]; // 1-minute trip

  it('rejects negative counts back to 0 rather than passing them through', () => {
    expect(computeTripMetrics(points, -3).events.phonePickupCount).toBe(0);
  });

  it('rejects non-finite counts (NaN, Infinity) back to 0 - never lets them poison the composite score', () => {
    expect(computeTripMetrics(points, NaN).events.phonePickupCount).toBe(0);
    expect(computeTripMetrics(points, Infinity).events.phonePickupCount).toBe(0);
    expect(Number.isFinite(computeTripMetrics(points, Infinity).score)).toBe(true);
  });

  it('floors a fractional count to a whole pickup', () => {
    expect(computeTripMetrics(points, 2.9).events.phonePickupCount).toBe(2);
  });

  it('caps the rate at MAX_PICKUPS_PER_MINUTE rather than trusting an absurd count', () => {
    // 1-minute trip, cap is 1 * 6 = 6 pickups -> a reported 500 is capped to
    // exactly that, not passed straight through.
    expect(computeTripMetrics(points, 500).events.phonePickupCount).toBe(6);
  });

  it('a longer trip gets a proportionally larger cap (rate-based, not a flat ceiling)', () => {
    const longTrip: TripPoint[] = [
      { t: 0, lat: 51.5074, lng: -0.1278, spd: 1000, hdg: 90, acc: 5 },
      { t: 30 * 60_000, lat: 51.6, lng: -0.1278, spd: 1000, hdg: 90, acc: 5 },
    ]; // 30-minute trip, cap = 30 * 6 = 180
    const capped = computeTripMetrics(longTrip, 1000).events.phonePickupCount;
    expect(capped).toBe(180);
  });
});

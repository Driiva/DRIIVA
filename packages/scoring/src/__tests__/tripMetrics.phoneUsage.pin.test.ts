/**
 * PINNING TEST: phone-usage component is structurally starved (M2 Task 6, M2-DEC-1).
 *
 * This suite does NOT assert that the phone-usage math is correct. It asserts
 * the opposite of a fix: that given the CURRENT `TripPoint` schema (which
 * carries no phone-pickup signal), the phone-usage component of every score
 * ALWAYS evaluates to 100, because its input (`events.phonePickupCount`) can
 * never leave 0. `computePhoneUsageScore` itself is real, rate-based math; it
 * is simply never fed anything but 0.
 *
 * Why pin behaviour nobody wants: closing this starvation (wiring the pickup
 * signal through, or removing the 10% weight and renormalising the other
 * four factors) is a scoring-formula change that shifts what every score
 * means, and needs Jamal's explicit sign-off (see
 * docs/rebuild/m2-dec-1-phone-usage.md). Until then, this test is a tripwire:
 * if someone "fixes" phone-usage without that decision, the change turns this
 * suite RED and forces the conversation instead of silently altering scores.
 *
 * If this suite ever needs updating, that is the signal the formula changed -
 * do not relax the assertions to make it pass; confirm the decision was taken.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { TripPoint } from '@driiva/contracts';
import { computeTripMetrics } from '../tripMetrics';
import { tripPointsArb } from './arbitraries';

describe('phone-usage: starved input pins the component to 100 (M2-DEC-1)', () => {
  it('phonePickupCount stays 0 for every realistic TripPoint stream', () => {
    fc.assert(
      fc.property(tripPointsArb(), (points) => {
        expect(computeTripMetrics(points).events.phonePickupCount).toBe(0);
      })
    );
  });

  it('phoneUsageScore is exactly 100 for every realistic TripPoint stream', () => {
    fc.assert(
      fc.property(tripPointsArb(), (points) => {
        expect(computeTripMetrics(points).scoreBreakdown.phoneUsageScore).toBe(100);
      })
    );
  });

  it('phone-usage stays 100 even on a trip that tanks every other factor', () => {
    // Alternating full-speed and near-stop samples one second apart drive
    // hard braking, hard acceleration, speeding and sharp turns all at once.
    // Those factors collapse; phone-usage cannot move, because no TripPoint
    // field carries a pickup signal for detectDrivingEvents to read.
    const points: TripPoint[] = Array.from({ length: 40 }, (_, i) => ({
      t: i * 1000,
      lat: 51.5074 + i * 0.0003,
      lng: -0.1278 + i * 0.0003,
      spd: i % 2 === 0 ? 4000 : 100,
      hdg: i % 2 === 0 ? 10 : 200,
      acc: 5,
    }));

    const { scoreBreakdown, events } = computeTripMetrics(points);

    expect(events.phonePickupCount).toBe(0);
    expect(scoreBreakdown.phoneUsageScore).toBe(100);
    // Sanity: this trip really is punishing on the wired factors, proving the
    // phone-usage floor above is not just a quiet all-100 breakdown.
    expect(scoreBreakdown.speedScore).toBeLessThan(100);
  });

  it('phone-usage stays 100 even when points carry the optional accel/gyro fields', () => {
    // A TripPoint may carry ax/ay/az/gx/gy/gz. None of them is a pickup
    // signal, so their presence does not change the starvation either.
    const points: TripPoint[] = [
      { t: 0, lat: 51.5074, lng: -0.1278, spd: 1000, hdg: 90, acc: 5, ax: 1, ay: 2, az: 3, gx: 4, gy: 5, gz: 6 },
      { t: 1000, lat: 51.5075, lng: -0.1277, spd: 1200, hdg: 91, acc: 5, ax: 1, ay: 2, az: 3, gx: 4, gy: 5, gz: 6 },
    ];

    const { scoreBreakdown, events } = computeTripMetrics(points);

    expect(events.phonePickupCount).toBe(0);
    expect(scoreBreakdown.phoneUsageScore).toBe(100);
  });

  it('the degenerate short-trip default path also reports a neutral 100', () => {
    // Fewer than 2 points takes the getDefaultMetrics branch, which likewise
    // hardcodes phoneUsageScore to 100. Pinned so the two paths stay aligned.
    const { scoreBreakdown, events } = computeTripMetrics([
      { t: 0, lat: 51.5074, lng: -0.1278, spd: 1000, hdg: 90, acc: 5 },
    ]);

    expect(events.phonePickupCount).toBe(0);
    expect(scoreBreakdown.phoneUsageScore).toBe(100);
  });
});

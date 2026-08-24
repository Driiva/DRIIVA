/**
 * WHERE the driving events happened, not just how many.
 *
 * The trip document carries counts: hardBrakingCount, sharpTurnCount and so
 * on. The trip detail screen wants to draw each event as a marker on the
 * recorded route, which needs positions, and the only place the thresholds
 * that define an event live is detectDrivingEvents in tripMetrics.ts, where
 * they were module-private local consts.
 *
 * Retyping four thresholds into a screen is how this repo already shipped
 * transposed SCORE_WEIGHTS to the marketing site once. So instead of exposing
 * the numbers, this exposes the RESULT: locateDrivingEvents returns every
 * event with the index and timestamp of the point it happened at, and
 * detectDrivingEvents tallies that same list.
 *
 * One pass, one set of thresholds. The markers and the counts cannot disagree,
 * and these tests assert that identity rather than trusting it.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { TripPoint } from '@driiva/contracts';
import { computeTripMetrics, locateDrivingEvents } from '../tripMetrics';
import { tripPointsArb } from './arbitraries';

/** A point one second after the last, at a given speed (m/s) and heading. */
function point(index: number, speedMps: number, headingDeg = 90): TripPoint {
  return {
    t: index * 1000,
    lat: 51.5074 + index * 0.0001,
    lng: -0.1278,
    spd: Math.round(speedMps * 100),
    hdg: headingDeg,
    acc: 5,
  };
}

describe('locateDrivingEvents: shape', () => {
  it('returns nothing for a trace too short to have an interval', () => {
    expect(locateDrivingEvents([])).toEqual([]);
    expect(locateDrivingEvents([point(0, 10)])).toEqual([]);
  });

  it('reports the index and timestamp of the point the event happened at', () => {
    // 20 m/s down to 15 m/s in one second is -5 m/s2, past the braking
    // threshold. The event belongs to the second point, index 1.
    const points = [point(0, 20), point(1, 15)];
    const located = locateDrivingEvents(points);

    expect(located).toHaveLength(1);
    expect(located[0].type).toBe('braking');
    expect(located[0].index).toBe(1);
    expect(located[0].t).toBe(points[1].t);
  });
});

describe('locateDrivingEvents: each type is found', () => {
  it('finds hard braking', () => {
    const located = locateDrivingEvents([point(0, 20), point(1, 15)]);
    expect(located.map((e) => e.type)).toEqual(['braking']);
  });

  it('finds hard acceleration', () => {
    const located = locateDrivingEvents([point(0, 10), point(1, 14)]);
    expect(located.map((e) => e.type)).toEqual(['acceleration']);
  });

  it('finds cornering, but only above walking pace', () => {
    const turning = locateDrivingEvents([point(0, 10, 0), point(1, 10, 40)]);
    expect(turning.map((e) => e.type)).toEqual(['cornering']);

    // Same turn at 2 m/s. Swinging a phone around while stationary is not a
    // cornering event, which is what the speed gate is for.
    const crawling = locateDrivingEvents([point(0, 2, 0), point(1, 2, 40)]);
    expect(crawling).toEqual([]);
  });

  it('finds speeding and attributes seconds to it', () => {
    const located = locateDrivingEvents([point(0, 35), point(1, 35)]);
    expect(located.map((e) => e.type)).toEqual(['speeding']);
    expect(located[0].seconds).toBe(1);
  });

  it('leaves seconds off the three instant events', () => {
    const braking = locateDrivingEvents([point(0, 20), point(1, 15)]);
    expect(braking[0].seconds).toBeUndefined();
  });

  it('attributes the real length of the interval, not one second per event', () => {
    // Every generated trace samples once a second, so a tally that added 1 per
    // speeding event instead of the interval length passed the property test
    // and this case is what caught it. A trace sampled every three seconds
    // separates the two.
    const points: TripPoint[] = [
      { ...point(0, 35), t: 0 },
      { ...point(1, 35), t: 3000 },
      { ...point(2, 35), t: 6000 },
    ];

    const located = locateDrivingEvents(points);
    expect(located.map((e) => e.seconds)).toEqual([3, 3]);
    expect(computeTripMetrics(points).events.speedingSeconds).toBe(6);
  });
});

describe('locateDrivingEvents: the intervals it refuses', () => {
  it('skips an interval with no forward time', () => {
    const points: TripPoint[] = [point(0, 20), { ...point(1, 15), t: 0 }];
    expect(locateDrivingEvents(points)).toEqual([]);
  });

  it('skips a gap longer than ten seconds', () => {
    const points: TripPoint[] = [point(0, 20), { ...point(1, 15), t: 11_000 }];
    expect(locateDrivingEvents(points)).toEqual([]);
  });
});

describe('the counts are a tally of the located events', () => {
  it('holds for every generated trace', () => {
    fc.assert(
      fc.property(tripPointsArb(), (points) => {
        const sorted = [...points].sort((a, b) => a.t - b.t);
        const located = locateDrivingEvents(sorted);
        const { events } = computeTripMetrics(sorted);

        const countOf = (type: string) => located.filter((e) => e.type === type).length;

        expect(events.hardBrakingCount).toBe(countOf('braking'));
        expect(events.hardAccelerationCount).toBe(countOf('acceleration'));
        expect(events.sharpTurnCount).toBe(countOf('cornering'));
        expect(events.speedingSeconds).toBe(
          located
            .filter((e) => e.type === 'speeding')
            .reduce((sum, e) => sum + (e.seconds ?? 0), 0),
        );
      }),
      { numRuns: 500 },
    );
  });

  it('is not passing because the generator produces no events', () => {
    // A tally test over traces that never trigger anything compares zero
    // against zero forever and proves nothing. Prove the corpus is live before
    // believing the identity above.
    const seen = new Set<string>();
    fc.assert(
      fc.property(tripPointsArb(), (points) => {
        for (const event of locateDrivingEvents([...points].sort((a, b) => a.t - b.t))) {
          seen.add(event.type);
        }
        return true;
      }),
      { numRuns: 500 },
    );

    expect([...seen].sort()).toEqual(['acceleration', 'braking', 'cornering', 'speeding']);
  });
});

/**
 * Shared fast-check arbitraries for the scoring property tests.
 * Not a test file itself (no `.test.ts` suffix) — imported by the suites
 * under this directory.
 */
import fc from 'fast-check';
import type { TripPoint } from '@driiva/contracts';

/** Non-positional fields of a schema-valid TripPoint (position is a geographically-coherent walk, see below). */
const tripPointRestArb = fc.record({
  // spd is m/s * 100 (integer, per @driiva/contracts). 0-4000 covers 0-40 m/s (~144 km/h).
  spd: fc.integer({ min: 0, max: 4000 }),
  hdg: fc.double({ min: 0, max: 360, noNaN: true }),
  acc: fc.double({ min: 0, max: 50, noNaN: true }),
});

/** Per-step lat/lng drift, small enough that 40 steps stay nowhere near a pole or the antimeridian. */
const stepDeltaArb = fc.double({ min: -0.0005, max: 0.0005, noNaN: true });

/**
 * An array of 2-40 TripPoints with strictly distinct, ascending `t` offsets
 * one second apart, and lat/lng forming a geographically-coherent walk (a
 * random start point, then small per-step drift) rather than independently
 * random coordinates.
 *
 * Two deliberate scope decisions, not test conveniences:
 * - `computeTripMetrics` sorts by `t` internally using JavaScript's *stable*
 *   sort — with duplicate `t` values, permuting the input changes each tied
 *   element's pre-sort relative order and therefore its post-sort position,
 *   making permutation-stability ill-defined. Real GPS sample streams never
 *   repeat a timestamp, so distinct `t` is the realistic case too.
 * - Independently-random lat/lng per point can land near-antipodal pairs,
 *   which trips a latent floating-point bug in the ported (verbatim)
 *   `haversineMeters`: rounding error can push its intermediate `a` term
 *   fractionally above 1, so `Math.sqrt(1 - a)` returns NaN. This is
 *   pre-existing behaviour of the original algorithm (see the Task 2
 *   report's concerns section), not introduced by the port, and is outside
 *   this arbitrary's domain — real trip points a second apart are metres
 *   apart, never continents apart.
 */
export function tripPointsArb(): fc.Arbitrary<TripPoint[]> {
  return fc.integer({ min: 2, max: 40 }).chain(n =>
    fc
      .tuple(
        fc.double({ min: -85, max: 85, noNaN: true }), // start lat
        fc.double({ min: -180, max: 180, noNaN: true }), // start lng
        fc.array(fc.tuple(stepDeltaArb, stepDeltaArb, tripPointRestArb), { minLength: n, maxLength: n })
      )
      .map(([startLat, startLng, steps]) => {
        let lat = startLat;
        let lng = startLng;
        return steps.map(([dLat, dLng, rest], i) => {
          lat += dLat;
          lng += dLng;
          return { t: i * 1000, lat, lng, ...rest };
        });
      })
  );
}

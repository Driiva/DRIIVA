/**
 * THE ROUTE TRACE HAS NO VISUAL PROOF, SO IT HAS ARITHMETIC PROOF
 * ==============================================================
 * RouteTrace draws a trip's recorded GPS points as an SVG instrument. In Expo
 * Go there is no trip to draw, and on a real build the only way to see it is to
 * have driven one, so the part most likely to be quietly wrong (the projection)
 * is asserted here rather than eyeballed.
 *
 * Three things it has to get right, and all three fail silently:
 *
 * 1. A degree of longitude is shorter than a degree of latitude everywhere off
 *    the equator. Without the cosine correction the same drive looks stretched
 *    sideways in Sheffield and nearly square in Quito, and nobody can tell by
 *    looking because they have never seen the correct version.
 * 2. The path length feeds strokeDasharray and strokeDashoffset. If it is
 *    wrong the trace either never finishes drawing or is already finished
 *    before the animation starts.
 * 3. Everything has to land inside the padded box. A point outside it is
 *    clipped, so a route with one outlier would silently lose its end.
 */
import { describe, it, expect } from 'vitest';

import { BOX, projectTrace, thinTrace } from '../../mobile/components/ui/routeGeometry';

/** Roughly 1km east then 1km north, in Sheffield. */
const L_SHAPE = [
  { lat: 53.3811, lng: -1.4701 },
  { lat: 53.3811, lng: -1.4551 },
  { lat: 53.3901, lng: -1.4551 },
];

describe('projecting a route into the drawing box', () => {
  it('refuses a route that is not a route', () => {
    expect(projectTrace([])).toBeNull();
    expect(projectTrace([{ lat: 53.38, lng: -1.47 }])).toBeNull();
  });

  it('keeps every point inside the padded box', () => {
    const projected = projectTrace(L_SHAPE);
    expect(projected).not.toBeNull();
    for (const [x, y] of projected!.xy) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(BOX.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(BOX.height);
    }
  });

  it('puts north at the top', () => {
    // SVG y grows downward and latitude grows northward, so the northernmost
    // point must have the SMALLEST y. Getting this backwards draws every route
    // upside down, which looks plausible for exactly as long as nobody
    // recognises the road.
    const projected = projectTrace(L_SHAPE)!;
    const northernmost = projected.xy[2];
    const southern = projected.xy[0];
    expect(northernmost[1]).toBeLessThan(southern[1]);
  });

  it('corrects longitude for latitude, so a square drive draws square', () => {
    // At 53 degrees north, cos(53) is about 0.6. A box spanning the same number
    // of DEGREES each way is therefore much wider in degrees than in metres,
    // and must not be drawn as a square.
    const oneDegreeBox = [
      { lat: 53.0, lng: -1.0 },
      { lat: 53.0, lng: -0.9 },
      { lat: 53.1, lng: -0.9 },
      { lat: 53.1, lng: -1.0 },
      { lat: 53.0, lng: -1.0 },
    ];
    const xs = projectTrace(oneDegreeBox)!.xy.map(([x]) => x);
    const ys = projectTrace(oneDegreeBox)!.xy.map(([, y]) => y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    // 0.1 degrees of longitude at 53N is about 0.6 of 0.1 degrees of latitude
    // on the ground, so the drawn shape is a landscape rectangle, not a square.
    expect(width / height).toBeGreaterThan(0.5);
    expect(width / height).toBeLessThan(0.7);
  });

  it('measures the path it drew, so the dash offset can animate it', () => {
    const projected = projectTrace(L_SHAPE)!;
    let summed = 0;
    for (let i = 1; i < projected.xy.length; i++) {
      summed += Math.hypot(
        projected.xy[i][0] - projected.xy[i - 1][0],
        projected.xy[i][1] - projected.xy[i - 1][1],
      );
    }
    expect(projected.length).toBeCloseTo(summed, 4);
    expect(projected.length).toBeGreaterThan(0);
  });

  it('emits one move and then only lines', () => {
    const projected = projectTrace(L_SHAPE)!;
    expect(projected.path.startsWith('M ')).toBe(true);
    expect((projected.path.match(/M /g) ?? []).length).toBe(1);
    expect((projected.path.match(/L /g) ?? []).length).toBe(L_SHAPE.length - 1);
  });

  it('survives a route that never moved', () => {
    // A trip recorded while parked. The spans are zero, so an unguarded
    // division would put every point at NaN and the whole card would vanish.
    const parked = [
      { lat: 53.3811, lng: -1.4701 },
      { lat: 53.3811, lng: -1.4701 },
    ];
    const projected = projectTrace(parked)!;
    for (const [x, y] of projected.xy) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});

describe('thinning a long route', () => {
  const long = Array.from({ length: 7200 }, (_, i) => ({
    lat: 53.38 + i * 0.00001,
    lng: -1.47 + i * 0.00001,
  }));

  it('leaves a short route alone', () => {
    const { items, step } = thinTrace(L_SHAPE, 400);
    expect(items).toHaveLength(3);
    expect(step).toBe(1);
  });

  it('brings a two hour drive under the cap', () => {
    const { items } = thinTrace(long, 400);
    expect(items.length).toBeLessThanOrEqual(401);
  });

  it('always keeps the last point, so the trace ends where the trip did', () => {
    const { items } = thinTrace(long, 400);
    expect(items[items.length - 1]).toEqual(long[long.length - 1]);
  });

  it('reports the step, so a marker index can still be located', () => {
    // Markers carry an index into the ORIGINAL array. Without the step the
    // marker for event 3000 would be drawn at point 3000 of a 400 point array,
    // which does not exist, and every marker would pile up on the last point.
    const { step } = thinTrace(long, 400);
    expect(step).toBeGreaterThan(1);
    expect(Math.ceil(long.length / step)).toBeLessThanOrEqual(400);
  });
});

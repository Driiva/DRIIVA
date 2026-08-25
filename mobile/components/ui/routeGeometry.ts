/**
 * ROUTE GEOMETRY
 * ==============
 * The projection behind RouteTrace, with no react-native import so it can be
 * asserted in the root vitest run.
 *
 * This is the half of the route instrument that fails silently. A trace with
 * the wrong aspect ratio, or drawn upside down, or with a path length that
 * disagrees with the path, all look like a plausible squiggle to anyone who
 * has not driven that road. The drawing code either works or is obviously
 * blank; the arithmetic is wrong quietly.
 */

/** The drawing box, in SVG user units. The view scales it to the card. */
export const BOX = { width: 320, height: 190, pad: 18 } as const;

/**
 * Above this many points the trace is thinned by taking every Nth sample. A
 * two hour drive at one fix a second is 7,200 points, which is a path string
 * long enough to stall the bridge that has to serialise it. The shape of a
 * route survives thinning; the bridge does not survive not thinning.
 */
export const MAX_TRACE_POINTS = 400;

export interface TracePoint {
  lat: number;
  lng: number;
}

export interface ProjectedTrace {
  /** An SVG path: one move, then a line per remaining point. */
  path: string;
  /** Summed segment length, for strokeDasharray and strokeDashoffset. */
  length: number;
  xy: Array<[number, number]>;
}

/**
 * Latitude and longitude into the drawing box: aspect preserved, centred,
 * padded.
 *
 * A degree of longitude is shorter than a degree of latitude everywhere off
 * the equator, by cos(latitude). Without that correction the same drive looks
 * stretched sideways in Sheffield and nearly square in Quito.
 */
export function projectTrace(points: TracePoint[]): ProjectedTrace | null {
  if (points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lngScale = Math.cos(midLat);

  // Floored rather than guarded: a trip recorded while parked has a zero span
  // in both directions, and an unguarded division puts every point at NaN,
  // which makes the whole card vanish rather than show a dot.
  const spanX = Math.max((maxLng - minLng) * lngScale, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);

  const usableW = BOX.width - BOX.pad * 2;
  const usableH = BOX.height - BOX.pad * 2;
  const scale = Math.min(usableW / spanX, usableH / spanY);

  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = (BOX.width - drawnW) / 2;
  const offsetY = (BOX.height - drawnH) / 2;

  const xy = points.map((p): [number, number] => [
    offsetX + (p.lng - minLng) * lngScale * scale,
    // Latitude grows northward and SVG y grows downward, so north is the
    // SMALLEST y. Getting this backwards draws every route upside down, which
    // looks plausible until somebody recognises the road.
    offsetY + (maxLat - p.lat) * scale,
  ]);

  let length = 0;
  for (let i = 1; i < xy.length; i++) {
    length += Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]);
  }

  const path = xy
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');

  return { path, length, xy };
}

/**
 * Every Nth sample, with the last point always kept so the trace ends where
 * the trip did.
 *
 * The step is returned because event markers carry an index into the ORIGINAL
 * array. Without it a marker for point 3,000 would be drawn at index 3,000 of
 * a 400 point array, which does not exist, and every marker would pile up on
 * the final point.
 */
export function thinTrace<T>(items: T[], max: number): { items: T[]; step: number } {
  if (items.length <= max) return { items, step: 1 };
  const step = Math.ceil(items.length / max);
  const out = items.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== items[items.length - 1]) out.push(items[items.length - 1]);
  return { items: out, step };
}

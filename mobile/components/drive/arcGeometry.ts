/**
 * The 270 degree arc's geometry, shared by the arc component and the
 * stylesheet that sizes it. Kept apart from both so neither has to import the
 * other. Extracted verbatim from mobile/app/(tabs)/record.tsx.
 */
/** Same geometry as ScoreRing: a 270 degree sweep opening at the bottom. */
export const SWEEP_DEGREES = 270;
export const START_DEGREES = 135;
export const ARC_SIZE = 260;
export const ARC_STROKE = 2;

export function pointAt(centre: number, radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [centre + radius * Math.cos(radians), centre + radius * Math.sin(radians)];
}

export function arcPath(centre: number, radius: number): string {
  const [x1, y1] = pointAt(centre, radius, START_DEGREES);
  const [x2, y2] = pointAt(centre, radius, START_DEGREES + SWEEP_DEGREES);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`;
}

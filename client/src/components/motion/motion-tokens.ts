/**
 * The motion vocabulary. Two eases, one duration band, one reduced-motion rule.
 *
 * These mirror --spring and --ease-fast in index.css. A third curve is not a
 * style choice, it is drift: the eye reads inconsistent easing as a different
 * product. Durations stay inside 150-450ms so nothing on a tab screen feels
 * like it is loading when it is only arriving.
 */

/** Reveals, entrances, anything arriving. Matches --ease-fast. */
export const EASE_FAST = [0.22, 1, 0.36, 1] as const;

/** Press and hover. The small overshoot you feel on touch. Matches --spring. */
export const SPRING = [0.34, 1.56, 0.64, 1] as const;

/** Seconds, because framer-motion counts in seconds. The 150-450ms band. */
export const DURATION = {
  instant: 0.15,
  fast: 0.2,
  base: 0.25,
  slow: 0.35,
  slower: 0.45,
} as const;

/** Physical springs for layout and gesture, not for entrances. */
export const springs = {
  /** Taps and selections. */
  snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
  /** Layout changes. */
  smooth: { type: 'spring' as const, stiffness: 300, damping: 30 },
  /** Sheets and modals, heavier body. */
  heavy: { type: 'spring' as const, stiffness: 200, damping: 26, mass: 1.2 },
  /** Nav indicator travel. */
  nav: { type: 'spring' as const, stiffness: 400, damping: 28 },
} as const;

/** Press and hover deltas. Small. Restraint is the brand. */
export const press = {
  tap: { scale: 0.97 },
  hover: { scale: 1.02 },
  hoverSubtle: { scale: 1.01 },
  cardPress: { scale: 0.98 },
} as const;

/**
 * True when the reader has asked the operating system for less motion.
 * Read at call time, not module load, so a mid-session change is honoured.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

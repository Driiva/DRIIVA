/**
 * MOTION CORE
 * ===========
 * The arithmetic behind every animation in the app, with no react-native
 * import so it can be asserted in the root vitest run rather than eyeballed in
 * a simulator. motion.tsx is the Reanimated shell over this.
 *
 * WHY THE SPLIT IS NOT JUST A TESTING CONVENIENCE
 * The reduced-motion decision is the one part of a motion system a driver
 * actually depends on, and it is the first thing lost when somebody edits
 * choreography six months from now. Every function here takes the preference
 * as an argument and returns the answer, so the guard is a value that can be
 * checked rather than a branch buried in a component.
 *
 * THE BUDGETS ARE THE BRAND
 * Driiva is an instrument, not a toy. Motion here confirms a press, bridges a
 * state change and paces an entrance. It never performs. Press feedback lives
 * in the 100 to 160ms band, entrances stay under the 300ms UI ceiling, and the
 * stagger total is capped so a long list cannot trickle in behind the reader.
 */

export const MOTION = {
  duration: {
    /** Press acknowledgement. Under 160ms or it stops reading as a response. */
    press: 130,
    /** A card arriving. Under the 300ms UI ceiling. */
    enter: 280,
    /** A figure counting to its value. Reveal, not UI, so it may run longer. */
    count: 900,
  },

  /**
   * Springs rather than curves for anything a finger is touching: a spring
   * keeps its velocity when interrupted, and a press that is released
   * mid-animation has to reverse from where it actually is.
   */
  spring: {
    press: { damping: 15, stiffness: 300, mass: 0.6 },
    settle: { damping: 18, stiffness: 180, mass: 1 },
  },

  stagger: {
    /** Gap between neighbours. Short enough to read as one gesture. */
    step: 40,
    /** Ceiling on the whole cascade, however long the list. */
    cap: 240,
  },

  enter: {
    /** Distance a card travels into place, in px. Upward, always. */
    translateY: 12,
    /** Nothing appears from nothing, so an entrance starts at its own size. */
    scale: 0.98,
  },

  press: {
    /** The dip. Subtle by design: 0.95 to 0.98 is the whole usable range. */
    scale: 0.98,
    /** What a press does instead when transforms are unwelcome. */
    opacity: 0.72,
  },
} as const;

export interface EnterState {
  opacity: number;
  translateY: number;
  scale: number;
}

export interface PressState {
  scale: number;
  opacity: number;
}

/**
 * Delay for one item in a staggered group.
 *
 * Capped rather than uncapped: at 40ms a step, a fifty row leaderboard would
 * spend two seconds assembling itself while the driver waits to read row one.
 * Past the cap every remaining item arrives together, which nobody notices and
 * everybody benefits from.
 */
export function staggerDelay(index: number, count: number, reduceMotion = false): number {
  if (reduceMotion) return 0;
  if (index <= 0 || count <= 1) return 0;
  return Math.min(index * MOTION.stagger.step, MOTION.stagger.cap);
}

/**
 * The state a card animates OUT of on entry.
 *
 * Reduced motion keeps the fade and drops the movement. "Fewer and gentler",
 * not "none": an element that pops into existence with no bridge at all reads
 * as a glitch, which is the jarring change the animation existed to prevent.
 */
export function enterFrom(reduceMotion: boolean): EnterState {
  if (reduceMotion) return { opacity: 0, translateY: 0, scale: 1 };
  return { opacity: 0, translateY: MOTION.enter.translateY, scale: MOTION.enter.scale };
}

/**
 * The state a pressable holds WHILE it is held.
 *
 * Under reduced motion the transform is swapped for an opacity dip rather than
 * dropped, because a tappable surface that does nothing at all under the
 * finger reads as broken, and the feedback is the point.
 */
export function pressFeedback(reduceMotion: boolean): PressState {
  if (reduceMotion) return { scale: 1, opacity: MOTION.press.opacity };
  return { scale: MOTION.press.scale, opacity: 1 };
}

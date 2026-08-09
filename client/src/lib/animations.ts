/**
 * Shared framer-motion variants, built on the canonical motion vocabulary.
 *
 * The single source for curves and durations is components/motion/motion-tokens,
 * which mirrors --spring and --ease-fast in index.css. This file used to carry
 * five eases of its own (material, iosSpring, button, elastic, smoothDecel),
 * so two cards side by side could arrive on different curves. They now all
 * resolve to the two the brand allows.
 *
 * The export names are unchanged because nineteen modules import them.
 */
import { DURATION, EASE_FAST, SPRING, press, springs } from '@/components/motion/motion-tokens';

export { springs };

/** Seconds. Every value sits inside the 150-450ms band. */
export const timing = {
  quick: DURATION.instant,
  interaction: DURATION.fast,
  cardEntrance: DURATION.slow,
  pageTransition: DURATION.base,
  counter: 0.8,
  loop: 1.5,
  shimmer: 1.6,
} as const;

/**
 * Two curves. `elastic` is the press spring, everything else is the reveal
 * curve; the old names are kept so call sites resolve without a sweep.
 */
export const easing = {
  button: EASE_FAST,
  elastic: SPRING,
  smoothDecel: EASE_FAST,
  material: EASE_FAST,
  iosSpring: SPRING,
} as const;

export const microInteractions = {
  tap: press.tap,
  hover: press.hover,
  hoverSubtle: press.hoverSubtle,
  hoverShift: { x: 4 },
  press: { scale: 0.95 },
  cardPress: press.cardPress,
} as const;

export const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Parent of a staggered list. Children arrive 60ms apart. */
export const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

/** A child of `container`. */
export const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: timing.cardEntrance, ease: EASE_FAST },
  },
};

export const entranceVariants = {
  fadeUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: timing.cardEntrance, ease: EASE_FAST },
  },
  scaleIn: {
    initial: { scale: 0.94, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: timing.cardEntrance, ease: SPRING },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: timing.pageTransition, ease: EASE_FAST },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DURATION.slower, ease: EASE_FAST },
  },
};

/**
 * Ambient loops. These run forever, so they stay small: a 2% breath, not a
 * pulse. Components using them must gate on useReducedMotion.
 */
export const loopAnimations = {
  pulse: {
    animate: { scale: [1, 1.02, 1] },
    transition: { duration: timing.shimmer, repeat: Infinity, ease: 'easeInOut' },
  },
  glow: {
    animate: { opacity: [0.5, 1, 0.5] },
    transition: { duration: timing.loop, repeat: Infinity, ease: 'easeInOut' },
  },
  shimmer: {
    initial: { x: '-100%' },
    animate: { x: '200%' },
    transition: { duration: timing.shimmer, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' },
  },
  breathe: {
    animate: { scale: [1, 1.02, 1], opacity: [0.7, 1, 0.7] },
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
};

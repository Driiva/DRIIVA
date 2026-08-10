/**
 * Entrance primitives, vendored from Amicro
 * (github.com/Subhan-code/Amicro--Micro-transitions-, registry/ui/entrance).
 *
 * Adapted rather than copied: the upstream components carry their own eases
 * (easeOutExpo, easeOutCubic) and ignore prefers-reduced-motion. Both are
 * replaced here with the canonical vocabulary, and every one of them renders
 * its end state immediately when the reader has asked for less motion.
 */
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE_FAST } from './motion-tokens';

interface RevealProps {
  children: ReactNode;
  /** Seconds. Keep inside the 150-450ms band. */
  duration?: number;
  delay?: number;
  className?: string;
}

/** Opacity only. The quietest arrival there is. */
export function FadeIn({
  children,
  duration = DURATION.base,
  delay = 0,
  className = '',
}: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduce ? { duration: 0 } : { duration, delay, ease: EASE_FAST }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface FadeUpProps extends RevealProps {
  /** Pixels of travel. 12 is the house default; 20 reads as a slide. */
  yOffset?: number;
}

/** Fade with a short lift. The default card entrance. */
export function FadeUp({
  children,
  duration = DURATION.slow,
  delay = 0,
  yOffset = 12,
  className = '',
}: FadeUpProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: yOffset }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration, delay, ease: EASE_FAST }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Arrives when it is actually scrolled to, once.
 *
 * Adapted from registry/ui/scroll/scroll-reveal.tsx, which lifts 30px and
 * scales from 0.95 over 600ms. On a list of trip cards that reads as each row
 * zooming at the reader, so the scale is dropped entirely and the lift is
 * halved: below the fold the job is to acknowledge arrival, not to perform it.
 *
 * Use this rather than FadeUp for anything that starts off screen. FadeUp
 * animates on mount, so a card below the fold finishes before it is ever seen.
 */
export function RevealOnScroll({
  children,
  duration = DURATION.slow,
  delay = 0,
  yOffset = 14,
  className = '',
}: FadeUpProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={reduce ? { duration: 0 } : { duration, delay, ease: EASE_FAST }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface ScaleInProps extends RevealProps {
  /** Starting scale. Stay above 0.96: below that it reads as a zoom. */
  from?: number;
}

/**
 * Settles into place from very slightly small. For a figure or a badge
 * appearing in a space that was already there, where a lift would look like
 * the layout moving.
 *
 * Upstream scale-in starts at 0.8, which on a dashboard tile is a pop.
 */
export function ScaleIn({
  children,
  duration = DURATION.base,
  delay = 0,
  from = 0.97,
  className = '',
}: ScaleInProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: from }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? { duration: 0 } : { duration, delay, ease: EASE_FAST }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

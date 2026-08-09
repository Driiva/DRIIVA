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

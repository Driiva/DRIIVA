/**
 * Route transition shell, ported from the StrydeOS dashboard and adapted from
 * next/navigation to wouter.
 *
 * The animated element becomes a containing block for position:fixed children
 * (transform and filter both do this), which is why page-level fixed chrome
 * such as BottomNav renders through FixedLayer instead of staying inside the
 * routed subtree.
 *
 * Perceived cost is one duration, not two: AnimatePresence in "wait" mode runs
 * the exit before the enter, so the numbers here are chosen to keep the pair
 * inside the 350ms budget.
 */
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'wouter';
import { EASE_FAST } from './motion/motion-tokens';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export default function PageTransition({ children, className = '' }: PageTransitionProps) {
  const [location] = useLocation();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: 'blur(1px)' }}
        transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE_FAST }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

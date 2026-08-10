/**
 * Stagger primitives, vendored from Amicro
 * (github.com/Subhan-code/Amicro--Micro-transitions-, registry/hooks/use-stagger.ts).
 *
 * Adapted rather than copied. Upstream returns a delay per index and leaves the
 * caller to wire the animation, with a 50ms step and no ceiling, so a list of
 * twenty rows finishes arriving a full second after the first one did. Here the
 * step is 40ms and the total entrance is capped: past the cap every remaining
 * item shares the last delay, so a long list still lands inside the 600ms a tab
 * screen is allowed rather than trickling in behind the reader's attention.
 *
 * Reduced motion renders everything in place, with no delay and no transform.
 */
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { DURATION, EASE_FAST } from './motion-tokens';

/** Seconds between siblings. Below 0.03 the stagger stops being legible. */
const STEP = 0.04;

/** Seconds. Nothing arrives later than this, however long the list. */
const MAX_TOTAL = 0.32;

/**
 * Delay per index, capped so a long list does not outrun the entrance budget.
 * Exported because a caller animating something other than a div still wants
 * the same rhythm.
 */
export function useStagger(count: number, baseDelay = 0): number[] {
  return useMemo(() => {
    const last = Math.max(count - 1, 1);
    const step = Math.min(STEP, MAX_TOTAL / last);
    return Array.from({ length: count }, (_, i) => baseDelay + i * step);
  }, [count, baseDelay]);
}

const StaggerContext = createContext<{ step: number } | null>(null);

interface StaggerProps {
  children: ReactNode;
  /** Seconds before the first child moves. */
  delay?: number;
  className?: string;
}

/**
 * Wraps a list or grid so its children arrive in sequence. Pair with
 * StaggerItem, which reads the step out of context rather than being handed an
 * index, so inserting a row never means renumbering the ones after it.
 */
export function Stagger({ children, delay = 0, className = '' }: StaggerProps) {
  const reduce = useReducedMotion();

  return (
    <StaggerContext.Provider value={{ step: STEP }}>
      <motion.div
        className={className}
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: {
            transition: reduce
              ? {}
              : { staggerChildren: STEP, delayChildren: delay },
          },
        }}
      >
        {children}
      </motion.div>
    </StaggerContext.Provider>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  /** Pixels of lift. 10 is the house default for a row, 12 for a card. */
  yOffset?: number;
  className?: string;
}

/** One member of a Stagger. Outside a Stagger it simply fades up on its own. */
export function StaggerItem({ children, yOffset = 10, className = '' }: StaggerItemProps) {
  const reduce = useReducedMotion();
  const inStagger = useContext(StaggerContext) !== null;

  const variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: yOffset },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce ? { duration: 0 } : { duration: DURATION.base, ease: EASE_FAST },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      {...(inStagger ? {} : { initial: 'hidden', animate: 'show' })}
    >
      {children}
    </motion.div>
  );
}

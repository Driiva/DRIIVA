/**
 * The loading placeholder.
 *
 * It used to pulse its whole opacity between 0.5 and 1, which on a screen of
 * six placeholders reads as the page flashing rather than as data arriving.
 * The sweep is vendored from Amicro's fluid-skeleton
 * (github.com/Subhan-code/Amicro--Micro-transitions-, registry/ui/loading),
 * adapted twice over: upstream sweeps a white/60 band, far too bright against
 * these surfaces, and runs linear, which makes the highlight arrive and leave
 * at the same speed as it crosses. Here the band is a hairline tint and the
 * sweep carries a pause at the end of each pass, so it reads as a scan rather
 * than a conveyor.
 *
 * Reduced motion renders the plain surface with no sweep at all. A placeholder
 * that does not move is still a placeholder.
 */
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

function Skeleton({ className, style, ...props }: SkeletonProps) {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn('relative overflow-hidden rounded-md bg-white/5', className)}
      style={style}
      aria-hidden="true"
      {...(props as object)}
    >
      {!reduce && (
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--hairline-hi) 50%, transparent 100%)',
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            repeatDelay: 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      )}
    </div>
  );
}

export { Skeleton };

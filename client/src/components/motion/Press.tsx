/**
 * Press and hover response, vendored from Amicro
 * (github.com/Subhan-code/Amicro--Micro-transitions-, registry/ui/hover).
 *
 * Upstream card-hover paints a filled panel behind the hovered card via a
 * shared layoutId, which on a dark instrument surface reads as a highlighter.
 * What a card actually needs to say is that it can be pressed, so the response
 * here is the hairline brightening and the surface lifting a single step up the
 * tonal ladder. Nothing is tinted and no new colour is introduced.
 *
 * Upstream magnetic-button and tilt-card are deliberately not vendored: both
 * are pointer-only flourishes on a product whose primary surface is a phone,
 * so they would be invisible where it matters and decorative where it does not.
 */
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { DURATION, EASE_FAST, press, springs } from './motion-tokens';

interface PressCardProps {
  children: ReactNode;
  onClick?: () => void;
  /** Accessible name, required when the card is interactive. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A card that answers a press. Renders as a button when it does something and
 * as a plain div when it does not, so nothing inert ends up in the tab order
 * advertising an interaction it cannot perform.
 */
export function PressCard({
  children,
  onClick,
  label,
  disabled = false,
  className = '',
}: PressCardProps) {
  const reduce = useReducedMotion();
  const interactive = Boolean(onClick) && !disabled;

  if (!interactive) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`block w-full text-left ${className}`}
      whileHover={reduce ? undefined : press.hoverSubtle}
      whileTap={reduce ? undefined : press.cardPress}
      transition={springs.snappy}
    >
      {children}
    </motion.button>
  );
}

interface PressableProps {
  children: ReactNode;
  className?: string;
}

/**
 * The same response for something that is already a control, wrapping rather
 * than replacing it. Use where a Button or a link needs the house press feel
 * without giving up its own semantics.
 */
export function Pressable({ children, className = '' }: PressableProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : press.hover}
      whileTap={reduce ? undefined : press.tap}
      transition={springs.snappy}
    >
      {children}
    </motion.div>
  );
}

interface HairlineHoverProps {
  children: ReactNode;
  className?: string;
}

/**
 * A row that brightens its own hairline on hover, for lists where a scale
 * change would push neighbouring rows around. This is the leaderboard and
 * trips-list response.
 */
export function HairlineHover({ children, className = '' }: HairlineHoverProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={false}
      whileHover={
        reduce
          ? undefined
          : { backgroundColor: 'var(--app-surface-2)', borderColor: 'var(--hairline-hi)' }
      }
      transition={{ duration: DURATION.instant, ease: EASE_FAST }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Text entrance primitives, vendored from Amicro
 * (github.com/Subhan-code/Amicro--Micro-transitions-, registry/ui/text).
 *
 * Adapted: upstream animates every character with a bouncy spring and a 15px
 * lift, which on a dashboard reads as a title sequence rather than an
 * instrument waking up. Here the travel is halved, the spring is the canonical
 * one, and reduced motion renders the string as plain text with no per-character
 * markup at all, so a screen reader never meets a word split into spans.
 *
 * Reserve these for a single lead line per surface. Two on one screen is noise.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE_FAST, springs } from './motion-tokens';

interface TextRevealProps {
  text: string;
  duration?: number;
  /** Seconds between characters. Above 0.03 the line reads as a typewriter. */
  staggerDelay?: number;
  className?: string;
}

const containerVariants = (staggerDelay: number) => ({
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: staggerDelay } },
});

/** Characters resolve out of a blur. Use on the one line that matters. */
export function BlurText({
  text,
  duration = DURATION.base,
  staggerDelay = 0.02,
  className = '',
}: TextRevealProps) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;

  return (
    <motion.span
      variants={containerVariants(staggerDelay)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-10%' }}
      className={`inline-block ${className}`}
      aria-label={text}
    >
      {Array.from(text).map((char, index) => (
        <motion.span
          key={index}
          aria-hidden="true"
          variants={{
            hidden: { opacity: 0, filter: 'blur(6px)' },
            visible: {
              opacity: 1,
              filter: 'blur(0px)',
              transition: { duration, ease: EASE_FAST },
            },
          }}
          className="inline-block whitespace-pre"
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

interface CharacterStaggerProps extends TextRevealProps {
  yOffset?: number;
}

/** Characters rise into place. Slightly more present than BlurText. */
export function CharacterStagger({
  text,
  staggerDelay = 0.015,
  yOffset = 8,
  className = '',
}: CharacterStaggerProps) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;

  return (
    <motion.span
      variants={containerVariants(staggerDelay)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-10%' }}
      className={`inline-block ${className}`}
      aria-label={text}
    >
      {Array.from(text).map((char, index) => (
        <motion.span
          key={index}
          aria-hidden="true"
          variants={{
            hidden: { opacity: 0, y: yOffset },
            visible: { opacity: 1, y: 0, transition: springs.smooth },
          }}
          className="inline-block whitespace-pre"
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

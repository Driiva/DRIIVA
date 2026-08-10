/**
 * Instrument motion, vendored from Amicro
 * (github.com/Subhan-code/Amicro--Micro-transitions-, registry/ui/loading).
 *
 * Three pieces earn their place on this product, and each is tied to a fact:
 * an arc that traces while a reading is still resolving, a glow that breathes
 * only while something is genuinely live, and a single pulse when a figure has
 * just landed. Nothing here loops for decoration.
 *
 * Adapted from upstream in the same three ways every time: the pasted colours
 * (#00f2fe, blue-500, zinc-800) become tokens, the eases become the two
 * canonical curves, and prefers-reduced-motion is honoured, which upstream
 * never checks. Where upstream loops forever, that is kept only for the two
 * components that describe an ongoing state, and dropped for the one that
 * describes an event.
 */
import { motion, useReducedMotion } from 'framer-motion';

import { DURATION, EASE_FAST } from './motion-tokens';

interface ArcTracerProps {
  /** Pixels. The arc is drawn to fill the box. */
  size?: number;
  /** Stroke width in pixels, scaled with size by default. */
  strokeWidth?: number;
  /** What the reading is. Announced, because the arc itself says nothing. */
  label?: string;
  /**
   * True when a visible line beside the arc already says what is loading. The
   * arc then carries no role and no label, so a screen reader hears the status
   * once rather than twice.
   */
  decorative?: boolean;
  className?: string;
}

/**
 * An arc tracing round a track, for a reading that has been asked for and has
 * not arrived. Upstream (arc-tracer) runs a full 360 circle on easeInOut; this
 * keeps the 270 degree sweep the gauges use, so a pending reading and a
 * resolved one occupy the same shape.
 */
export function ArcTracer({
  size = 40,
  strokeWidth,
  label = 'Loading',
  decorative = false,
  className = '',
}: ArcTracerProps) {
  const reduce = useReducedMotion();
  const stroke = strokeWidth ?? Math.max(2, Math.round(size * 0.075));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // 270 degrees of the circle, the automotive sweep the score gauge uses.
  const arc = circumference * 0.75;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      {/* The track starts at the seven o'clock position, as the gauges do. */}
      <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--app-surface-3)"
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${circumference}`}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--app-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc * 0.25} ${circumference}`}
          animate={reduce ? undefined : { strokeDashoffset: [0, -arc] }}
          transition={
            reduce ? undefined : { duration: 1.4, repeat: Infinity, ease: 'linear' }
          }
        />
      </g>
    </svg>
  );
}

interface LiveGlowProps {
  /** Only ever true when something really is happening right now. */
  live?: boolean;
  size?: number;
  label?: string;
  /**
   * The tone the live state has earned. Positive by default, because most
   * live signals on this product are good news. Recording is the exception:
   * capture is not praise, and red is what a driver already reads as capture.
   */
  colour?: string;
  className?: string;
}

/**
 * A dot with a halo that breathes while a state is live, for example while a
 * trip is recording. Colour is earned here: the dot is muted until `live`, and
 * only then takes the positive tone.
 *
 * Upstream (breathing-glow) is a blue orb that breathes unconditionally, which
 * on an instrument reads as an animation rather than a signal.
 */
export function LiveGlow({
  live = false,
  size = 8,
  label,
  colour: liveColour = 'var(--ok)',
  className = '',
}: LiveGlowProps) {
  const reduce = useReducedMotion();
  const colour = live ? liveColour : 'var(--app-text-mut)';

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size * 2.5, height: size * 2.5 }}
      role={label ? 'status' : undefined}
      aria-label={label}
    >
      {live && !reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{ width: size, height: size, background: colour }}
          animate={{ scale: [1, 2.4, 1], opacity: [0.45, 0, 0.45] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <span
        aria-hidden="true"
        className="relative rounded-full"
        style={{ width: size, height: size, background: colour }}
      />
    </span>
  );
}

interface SettlePulseProps {
  children: React.ReactNode;
  /**
   * Change this when a new value has landed. A ring expands once and stops.
   * Passing a stable key means nothing animates, which is the common case.
   */
  pulseKey?: string | number;
  className?: string;
}

/**
 * One ring, expanding out from a figure that has just changed, then gone.
 *
 * This is the refund moment and the score moment: the number is already
 * counting up, and this is what makes the change felt rather than merely
 * displayed. Upstream (haptic-ring) is a spinner that rotates forever; an
 * event is not a state, so the loop is dropped and it fires once per change.
 */
export function SettlePulse({ children, pulseKey, className = '' }: SettlePulseProps) {
  const reduce = useReducedMotion();

  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      {!reduce && pulseKey !== undefined && (
        <motion.span
          key={pulseKey}
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl border"
          style={{ borderColor: 'var(--app-primary)' }}
          initial={{ opacity: 0.5, scale: 0.94 }}
          animate={{ opacity: 0, scale: 1.18 }}
          transition={{ duration: DURATION.slower, ease: EASE_FAST }}
        />
      )}
      {children}
    </span>
  );
}

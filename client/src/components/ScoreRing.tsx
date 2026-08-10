/**
 * ScoreRing - the score as a 270-degree arc gauge.
 *
 * Rule 6 of the design system: an automotive gauge, not a 360-degree progress
 * ring. A full circle reads as "loading" and gives the eye no start and no end;
 * a 270-degree sweep opening at the bottom reads as an instrument, which is
 * what the score is.
 *
 * This is the web half of a pair. mobile/components/ui/ScoreRing.tsx is the
 * same gauge and the two must stay in step, so the geometry constants and the
 * polar maths below are deliberately identical to it rather than re-derived.
 * The score is the hero number of the product; the two surfaces disagreeing
 * about its shape was the most visible inconsistency between them.
 */
import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** The gauge sweeps 270 degrees, opening at the bottom: 225deg round to 135deg. */
const SWEEP_DEGREES = 270;
const START_DEGREES = 225;

/** Polar to cartesian on the gauge circle, with 0deg at twelve o'clock. */
function pointAt(centre: number, radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [centre + radius * Math.cos(radians), centre + radius * Math.sin(radians)];
}

/** The full 270-degree track as a single SVG arc path. */
function arcPath(centre: number, radius: number): string {
  const [x1, y1] = pointAt(centre, radius, START_DEGREES);
  const [x2, y2] = pointAt(centre, radius, START_DEGREES + SWEEP_DEGREES);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`;
}

/**
 * The stroke carries the brand gradient, which is the one place the gradient is
 * allowed above the ground. Stops are set as CSS properties rather than SVG
 * attributes because an attribute will not resolve a var(), and index.css is
 * explicit that a component never carries a literal hex. This replaces four
 * pasted values that also encoded a tier ramp the design system does not have.
 */
const RING_STOPS = [
  { offset: '0%', token: 'var(--brand-amber)' },
  { offset: '33%', token: 'var(--brand-burnt)' },
  { offset: '66%', token: 'var(--brand-violet)' },
  { offset: '100%', token: 'var(--brand-indigo)' },
] as const;

export default function ScoreRing({
  score,
  size = 140,
  strokeWidth = 8,
  className = '',
}: ScoreRingProps) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const reduce = useReducedMotion();

  const centre = size / 2;
  const radius = (size - strokeWidth) / 2;
  const arcLength = (2 * Math.PI * radius * SWEEP_DEGREES) / 360;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const resting = arcLength * (1 - pct);

  // One id per instance: two gauges on a page must not share a gradient.
  const gradientId = useRef(`score-grad-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    const node = numberRef.current;
    const path = pathRef.current;
    if (!node || !path) return;

    // A driver who has asked the system to stop animating gets the figure
    // straight away. The score is information, never withheld for an effect.
    if (reduce) {
      node.textContent = Math.round(score).toString();
      path.style.strokeDashoffset = String(resting);
      return;
    }

    node.textContent = '0';
    path.style.strokeDashoffset = String(arcLength);

    const counter = animate(0, score, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate: (v) => {
        node.textContent = Math.round(v).toString();
      },
    });
    const sweep = animate(arcLength, resting, {
      duration: 1.4,
      ease: 'easeOut',
      delay: 0.3,
      onUpdate: (v) => {
        path.style.strokeDashoffset = String(v);
      },
    });

    return () => {
      counter.stop();
      sweep.stop();
    };
  }, [score, reduce, arcLength, resting]);

  const track = arcPath(centre, radius);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Safety score ${Math.round(score)} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {RING_STOPS.map((stop) => (
              <stop key={stop.offset} offset={stop.offset} style={{ stopColor: stop.token }} />
            ))}
          </linearGradient>
        </defs>

        <path
          d={track}
          fill="none"
          stroke="var(--app-surface-3)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          ref={pathRef}
          d={track}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={arcLength}
        />
      </svg>

      {/* aria-hidden: the gauge already carries the reading in its own label,
          so a reader should not hear the figure a second time. */}
      <div className="relative z-10 flex flex-col items-center" aria-hidden="true">
        <span ref={numberRef} className="text-4xl font-bold tabular" style={{ color: 'var(--app-text-hero)' }}>
          0
        </span>
        <span className="-mt-0.5 text-xs" style={{ color: 'var(--app-text-mut)' }}>
          / 100
        </span>
      </div>
    </div>
  );
}

/**
 * Readout - the instrument tile for a single figure.
 *
 * Ported from the StrydeOS StatCard: IntersectionObserver so the count starts
 * when the tile is actually seen rather than when it mounts offscreen, RAF with
 * a cubic ease-out, digit-aware sizing so a long value does not overflow a card
 * that a short one fits, and an 80ms stagger by index across a row.
 *
 * Reduced motion skips the count entirely and renders the final value: the
 * figure is information, so it is never withheld for the sake of an effect.
 *
 * Status is carried by SHAPE and colour together (chevron up, chevron down,
 * warning triangle, dash), never by colour alone. Red against green is
 * invisible to a deuteranopic reader, and roughly one man in twelve is.
 */
import { useState, useEffect, useRef, useCallback, memo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, Minus, AlertTriangle } from 'lucide-react';

export type ReadoutTrend = 'up' | 'down' | 'warn' | 'flat';

interface ReadoutProps {
  /** Mono eyebrow above the figure. Sentence case, no colon. */
  label: string;
  /** The figure. Accepts a prefix or suffix, for example "£12.40" or "82%". */
  value: string | number;
  /** Small trailing unit rendered beside the figure, not counted up. */
  unit?: string;
  /** Direction of travel. Drawn as an icon, so it survives colour blindness. */
  trend?: ReadoutTrend;
  trendPercent?: number;
  /** One line under the figure. Say what it means, never pad it. */
  caption?: ReactNode;
  onClick?: () => void;
  /** Position in a row. Drives the 80ms entrance stagger. */
  index?: number;
  className?: string;
}

const TREND_ICON = {
  up: ChevronUp,
  down: ChevronDown,
  warn: AlertTriangle,
  flat: Minus,
} as const;

/* Down is not automatically bad on this product: a falling premium is the
   point. The caller picks the trend, this only picks how it is drawn. */
const TREND_COLOUR: Record<ReadoutTrend, string> = {
  up: 'var(--ok)',
  down: 'var(--app-text-sec)',
  warn: 'var(--warn)',
  flat: 'var(--app-text-mut)',
};

/**
 * Counts a numeric value up from zero once, when it first scrolls into view.
 * Non-numeric values, and readers who prefer reduced motion, get the value as
 * given with no animation at all.
 */
export function useCountUp(rawTarget: string | number, duration = 800) {
  const target = String(rawTarget);
  const numericPart = parseFloat(target.replace(/[^0-9.-]/g, ''));
  const isNumeric = !Number.isNaN(numericPart);
  const prefix = isNumeric ? (target.match(/^[^0-9.-]*/)?.[0] ?? '') : '';
  const suffix = isNumeric ? (target.match(/[^0-9.-]*$/)?.[0] ?? '') : '';
  const decimals = target.includes('.')
    ? (target.split('.')[1]?.replace(/[^0-9]/g, '').length ?? 0)
    : 0;

  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const hasAnimated = useRef(false);
  const elRef = useRef<HTMLElement | null>(null);

  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const step = useCallback(() => {
    const elapsed = performance.now() - startRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    setDisplay(`${prefix}${(numericPart * eased).toFixed(decimals)}${suffix}`);
    if (progress < 1) rafRef.current = requestAnimationFrame(step);
  }, [numericPart, prefix, suffix, decimals, duration]);

  const start = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    setDisplay(`${prefix}${(0).toFixed(decimals)}${suffix}`);
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(step);
  }, [prefix, suffix, decimals, step]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !isNumeric || reducedMotion || typeof IntersectionObserver === 'undefined') {
      setDisplay(target);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          start();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, isNumeric, reducedMotion, start]);

  // A new value counts again, so a landed trip is felt rather than swapped in.
  useEffect(() => {
    hasAnimated.current = false;
  }, [target]);

  return { display, ref: elRef };
}

function Readout({
  label,
  value,
  unit,
  trend,
  trendPercent,
  caption,
  onClick,
  index,
  className = '',
}: ReadoutProps) {
  const { display, ref } = useCountUp(value);

  // Long values step down so a card sized for "82" still holds "£1,204.50".
  const length = String(value).length;
  const valueSize = length <= 4 ? 40 : length <= 6 ? 32 : length <= 9 ? 26 : 20;

  const TrendIcon = trend ? TREND_ICON[trend] : null;
  const trendColour = trend ? TREND_COLOUR[trend] : undefined;

  const interactive = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`readout-tile ${interactive ? 'cursor-pointer' : ''} ${className}`}
      style={{ animationDelay: index !== undefined ? `${index * 80}ms` : '0ms' }}
    >
      <span className="stat-label block mb-2">{label}</span>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          ref={ref as React.RefObject<HTMLSpanElement>}
          className="font-display stat-value leading-none"
          style={{ fontSize: valueSize, color: 'var(--app-text-hero)' }}
        >
          {display}
        </span>
        {unit && (
          <span className="text-[13px]" style={{ color: 'var(--app-text-sec)' }}>
            {unit}
          </span>
        )}
        {TrendIcon && (
          <span className="inline-flex items-center gap-0.5">
            <TrendIcon size={14} strokeWidth={2.5} color={trendColour} aria-hidden="true" />
            {trendPercent !== undefined && (
              <span className="text-[11px] font-medium tabular" style={{ color: trendColour }}>
                {trendPercent > 0 ? '+' : ''}
                {trendPercent.toFixed(0)}%
              </span>
            )}
          </span>
        )}
      </div>

      {caption && (
        <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--app-text-sec)' }}>
          {caption}
        </p>
      )}
    </div>
  );
}

export default memo(Readout);

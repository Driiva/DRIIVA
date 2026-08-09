/**
 * Animated number counter that smoothly transitions between values.
 * Used for scores, stats, and financial figures.
 *
 * Three behaviours ported from the StrydeOS StatCard count-up:
 *
 * 1. It waits until the figure is actually on screen. Counting on mount meant
 *    the pool total below the fold had finished animating before the reader
 *    ever scrolled to it, so the effect was paid for and never seen.
 * 2. It respects prefers-reduced-motion by rendering the final value at once.
 *    The figure is information; it is never withheld for the sake of an effect.
 * 3. Tabular figures, so digits hold their columns instead of jittering the
 *    width of the number on every frame of the count.
 */
import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';
import { EASE_FAST, prefersReducedMotion } from '@/components/motion/motion-tokens';

interface AnimatedNumberProps {
  value: number;
  /** Duration of the count animation in seconds */
  duration?: number;
  /** Number of decimal places */
  decimals?: number;
  /** Prefix to display (e.g. "£") */
  prefix?: string;
  /** Suffix to display (e.g. "mi") */
  suffix?: string;
  /** Additional class name */
  className?: string;
  /** Format with locale commas */
  locale?: boolean;
}

export function AnimatedNumber({
  value,
  duration = 0.8,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  locale = false,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    const settle = () => {
      node.textContent = formatNumber(to, decimals, prefix, suffix, locale);
    };

    if (from === to || prefersReducedMotion()) {
      settle();
      return;
    }

    let controls: { stop: () => void } | undefined;

    const run = () => {
      controls = animate(from, to, {
        duration,
        ease: EASE_FAST,
        onUpdate: (v) => {
          node.textContent = formatNumber(v, decimals, prefix, suffix, locale);
        },
      });
    };

    if (typeof IntersectionObserver === 'undefined') {
      run();
      return () => controls?.stop();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [value, duration, decimals, prefix, suffix, locale]);

  return (
    <span ref={ref} className={`tabular ${className}`} data-readout>
      {formatNumber(0, decimals, prefix, suffix, locale)}
    </span>
  );
}

function formatNumber(
  n: number,
  decimals: number,
  prefix: string,
  suffix: string,
  locale: boolean,
): string {
  const rounded = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
  const formatted = locale
    ? Number(rounded).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : rounded;
  return `${prefix}${formatted}${suffix ? ` ${suffix}` : ''}`;
}

import { useEffect, useRef, useState } from 'react';
import { useInView } from '@/hooks/useInView';
import { animate, prefersReducedMotion } from '@/lib/motion';

interface Stat {
  prefix?: string;
  value: number;
  suffix?: string;
  decimals?: number;
  claim: string;
}

const STATS: readonly Stat[] = [
  { value: 75, suffix: '%', claim: 'of young UK drivers pay more than their risk justifies.' },
  { prefix: '£', value: 16.8, suffix: 'B', decimals: 1, claim: 'in motor premiums paid by UK drivers last year.' },
  { value: 0, claim: 'mainstream insurers return premium surplus to their community.' },
] as const;

function formatStat(value: number, stat: Stat): string {
  const fixed = (stat.decimals ?? 0) > 0 ? value.toFixed(stat.decimals) : Math.round(value).toString();
  return `${stat.prefix ?? ''}${fixed}${stat.suffix ?? ''}`;
}

interface CountUpProps {
  stat: Stat;
  trigger: boolean;
}

function CountUp({ stat, trigger }: CountUpProps) {
  const elRef = useRef<HTMLSpanElement | null>(null);
  const [displayed, setDisplayed] = useState(0);
  const fired = useRef(false);

  useEffect(() => {
    if (!trigger || fired.current) return;
    fired.current = true;
    const target = stat.value;
    if (prefersReducedMotion()) {
      setDisplayed(target);
      return;
    }
    const proxy = { v: 0 };
    animate(proxy as unknown as Element, {
      v: [0, target],
      duration: 1600,
      ease: 'cubicBezier(0.22, 1, 0.36, 1)',
      update: () => setDisplayed(proxy.v),
    } as never);
  }, [trigger, stat.value]);

  return (
    <span ref={elRef} className="mono tabular text-[clamp(3rem,8vw,5.75rem)] leading-none text-text-1">
      {formatStat(displayed, stat)}
    </span>
  );
}

export function Problem() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2, once: true });
  const cardsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!inView) return;
    const cards = cardsRef.current?.querySelectorAll('[data-card]');
    if (!cards || cards.length === 0) return;
    animate(Array.from(cards) as Element[], {
      opacity: [0, 1],
      translateY: [32, 0],
      duration: 800,
      ease: 'cubicBezier(0.22, 1, 0.36, 1)',
      delay: (_: unknown, i: number) => i * 80,
    } as never);
  }, [inView]);

  return (
    <section
      ref={ref}
      data-section="problem"
      className="relative mx-auto w-full max-w-6xl px-6 py-32"
    >
      <p className="eyebrow mb-6">The problem</p>
      <h2 className="display-2 mb-16 max-w-3xl">
        The market punishes inexperience, not risk.
      </h2>
      <div ref={cardsRef} className="grid gap-6 md:grid-cols-3">
        {STATS.map((stat, i) => (
          <div
            key={i}
            data-card
            data-testid={`problem-card-${i}`}
            className="surface flex flex-col gap-6 rounded-lg p-8"
            style={{ opacity: 0 }}
          >
            <CountUp stat={stat} trigger={inView} />
            <p className="text-text-2 text-base leading-relaxed">{stat.claim}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

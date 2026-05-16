import { useEffect, useRef, useState } from 'react';
import { useInView } from '@/hooks/useInView';
import { animate, createTimeline, prefersReducedMotion } from '@/lib/motion';

interface Trip {
  id: string;
  route: string;
  score: number;
  refund: number;
}

const TRIPS: readonly Trip[] = [
  { id: 't1', route: 'Camden to Brixton', score: 92, refund: 1.42 },
  { id: 't2', route: 'A406 north circular', score: 88, refund: 0.96 },
  { id: 't3', route: 'M25 J16 to J21', score: 95, refund: 2.11 },
] as const;

const SCORE_TARGET = 87;
const REFUND_START = 127.45;
const REFUND_END = 132.10;

export function Product() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2, once: true });
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<SVGCircleElement | null>(null);
  const scoreLabelRef = useRef<HTMLSpanElement | null>(null);
  const refundLabelRef = useRef<HTMLSpanElement | null>(null);
  const tripsRef = useRef<HTMLDivElement | null>(null);
  const [scoreText, setScoreText] = useState(0);
  const [refundText, setRefundText] = useState(REFUND_START);

  useEffect(() => {
    if (!inView) return;
    const phone = phoneRef.current;
    const ring = ringRef.current;
    const trips = tripsRef.current?.querySelectorAll('[data-trip]');
    if (!phone || !ring || !trips) return;

    const circumference = 2 * Math.PI * 80;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference);

    if (prefersReducedMotion()) {
      phone.style.opacity = '1';
      phone.style.transform = 'none';
      ring.style.strokeDashoffset = String(circumference * (1 - SCORE_TARGET / 100));
      setScoreText(SCORE_TARGET);
      setRefundText(REFUND_END);
      for (const t of Array.from(trips)) {
        (t as HTMLElement).style.opacity = '1';
        (t as HTMLElement).style.transform = 'none';
      }
      return;
    }

    const tl = createTimeline({ defaults: { ease: 'cubicBezier(0.22, 1, 0.36, 1)' } });
    tl.add(phone, { opacity: [0, 1], translateY: [32, 0], scale: [0.96, 1], duration: 900 })
      .add(
        ring,
        {
          strokeDashoffset: [circumference, circumference * (1 - SCORE_TARGET / 100)],
          duration: 1400,
          ease: 'cubicBezier(0.65, 0, 0.35, 1)',
        },
        '-=500',
      );

    const scoreProxy = { v: 0 };
    animate(scoreProxy as unknown as Element, {
      v: [0, SCORE_TARGET],
      duration: 1400,
      delay: 400,
      ease: 'cubicBezier(0.65, 0, 0.35, 1)',
      update: () => setScoreText(Math.round(scoreProxy.v)),
    } as never);

    animate(Array.from(trips) as Element[], {
      opacity: [0, 1],
      translateX: [-20, 0],
      duration: 600,
      delay: (_: unknown, i: number) => 900 + i * 140,
    } as never);

    const refundProxy = { v: REFUND_START };
    animate(refundProxy as unknown as Element, {
      v: [REFUND_START, REFUND_END],
      duration: 1600,
      delay: 1200,
      ease: 'cubicBezier(0.22, 1, 0.36, 1)',
      update: () => setRefundText(refundProxy.v),
    } as never);
  }, [inView]);

  return (
    <section
      ref={ref}
      data-section="product"
      className="relative mx-auto w-full max-w-6xl px-6 py-32"
    >
      <p className="eyebrow mb-6">The product</p>
      <h2 className="display-2 mb-6 max-w-3xl">
        See where your premium goes. To the penny.
      </h2>
      <p className="lede mb-16">
        Your trips score themselves. Surplus accrues in real time. No paperwork.
      </p>

      <div
        ref={phoneRef}
        className="mx-auto w-full max-w-[320px]"
        style={{ opacity: 0 }}
        data-testid="product-phone"
      >
        <div className="surface rounded-xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <span className="eyebrow">Driving score</span>
            <span className="mono text-xs text-text-3">live</span>
          </div>

          <div className="relative mx-auto mb-8 h-[200px] w-[200px]">
            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
              <circle
                cx="100"
                cy="100"
                r="80"
                stroke="var(--hairline-hi)"
                strokeWidth="6"
                fill="none"
              />
              <circle
                ref={ringRef}
                cx="100"
                cy="100"
                r="80"
                stroke="var(--ok)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                ref={scoreLabelRef}
                className="mono tabular text-5xl font-medium text-text-1"
              >
                {scoreText}
              </span>
              <span className="eyebrow mt-1">of 100</span>
            </div>
          </div>

          <div ref={tripsRef} className="mb-6 space-y-2">
            {TRIPS.map((t) => (
              <div
                key={t.id}
                data-trip
                className="flex items-center justify-between rounded border border-hairline px-3 py-2 text-sm"
                style={{ opacity: 0 }}
              >
                <span className="text-text-2">{t.route}</span>
                <span className="mono tabular text-ok">{t.score}</span>
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-between border-t border-hairline pt-4">
            <span className="eyebrow">Refund so far</span>
            <span
              ref={refundLabelRef}
              className="mono tabular text-2xl font-medium text-text-1"
            >
              £{refundText.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef } from 'react';
import { useInView } from '@/hooks/useInView';
import { animate, prefersReducedMotion } from '@/lib/motion';

interface Pillar {
  id: string;
  title: string;
  body: string;
  icon: (props: { className?: string }) => JSX.Element;
}

function IconPhone({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect data-stroke x="14" y="6" width="20" height="36" rx="3" />
      <line data-stroke x1="22" y1="36" x2="26" y2="36" />
      <path data-stroke d="M20 14h8" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path data-stroke d="M4 24c4-8 12-12 20-12s16 4 20 12c-4 8-12 12-20 12S8 32 4 24z" />
      <circle data-stroke cx="24" cy="24" r="5" />
    </svg>
  );
}

function IconCrescent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path data-stroke d="M32 8a16 16 0 1 0 0 32A12 12 0 0 1 32 8z" />
    </svg>
  );
}

function IconPool({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle data-stroke cx="24" cy="24" r="14" />
      <path data-stroke d="M10 28c4-3 8-3 14 0s10 3 14 0" />
      <path data-stroke d="M10 22c4-3 8-3 14 0s10 3 14 0" />
    </svg>
  );
}

const PILLARS: readonly Pillar[] = [
  {
    id: 'no-hardware',
    title: 'No hardware',
    body: 'No black box. Your phone is the sensor. Install once, drive normally.',
    icon: IconPhone,
  },
  {
    id: 'explainable-ai',
    title: 'Explainable AI',
    body: 'Every signal scored, every adjustment shown. You see why your premium moves, not just the result.',
    icon: IconEye,
  },
  {
    id: 'shariah-compliant',
    title: 'Shariah-compliant',
    body: 'Community-pooled, surplus-shared. Structured to avoid riba and gharar.',
    icon: IconCrescent,
  },
  {
    id: 'community-pool',
    title: 'Community-pool',
    body: 'Premium funds claims. Surplus comes back to drivers, not shareholders.',
    icon: IconPool,
  },
] as const;

export function Differentiators() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2, once: true });
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!inView) return;
    const cards = gridRef.current?.querySelectorAll('[data-pillar]');
    if (!cards) return;
    animate(Array.from(cards) as Element[], {
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 700,
      ease: 'cubicBezier(0.22, 1, 0.36, 1)',
      delay: (_: unknown, i: number) => i * 70,
    } as never);
  }, [inView]);

  function onCardEnter(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion()) return;
    const strokes = e.currentTarget.querySelectorAll<SVGPathElement | SVGCircleElement | SVGLineElement>('[data-stroke]');
    if (strokes.length === 0) return;
    for (const s of Array.from(strokes)) {
      const el = s as SVGPathElement;
      let len = 100;
      const geo = el as unknown as { getTotalLength?: () => number };
      if (typeof geo.getTotalLength === 'function') len = geo.getTotalLength();
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
    }
    animate(Array.from(strokes) as Element[], {
      strokeDashoffset: [(el: SVGGeometryElement) => {
        const geo = el as unknown as { getTotalLength?: () => number };
        return typeof geo.getTotalLength === 'function' ? geo.getTotalLength() : 100;
      }, 0],
      duration: 700,
      ease: 'cubicBezier(0.22, 1, 0.36, 1)',
      delay: (_: unknown, i: number) => i * 60,
    } as never);
  }

  return (
    <section
      ref={ref}
      data-section="differentiators"
      className="relative mx-auto w-full max-w-6xl px-6 py-32"
    >
      <p className="eyebrow mb-6">Why us</p>
      <h2 className="display-2 mb-16 max-w-3xl">
        Four things mainstream insurers cannot copy on Monday.
      </h2>

      <div
        ref={gridRef}
        className="grid gap-6 sm:grid-cols-2"
      >
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.id}
              data-pillar={p.id}
              data-testid={`pillar-${p.id}`}
              onMouseEnter={onCardEnter}
              className="surface group flex flex-col gap-6 rounded-lg p-8 transition-colors"
              style={{ opacity: 0 }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded text-accent-iris">
                <Icon className="h-full w-full" />
              </div>
              <div>
                <h3 className="mb-3 font-display text-2xl font-medium text-text-1">{p.title}</h3>
                <p className="text-text-2 leading-relaxed">{p.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

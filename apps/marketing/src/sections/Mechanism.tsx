import { useEffect, useRef } from 'react';
import { useInView } from '@/hooks/useInView';
import { animate, prefersReducedMotion } from '@/lib/motion';

interface Node {
  id: string;
  label: string;
  cx: number;
  cy: number;
}

const NODES: readonly Node[] = [
  { id: 'driver', label: 'Driver', cx: 100, cy: 200 },
  { id: 'premium', label: 'Premium', cx: 280, cy: 100 },
  { id: 'pool', label: 'Pool', cx: 460, cy: 200 },
  { id: 'surplus', label: 'Surplus', cx: 280, cy: 320 },
  { id: 'refund', label: 'Refund', cx: 100, cy: 320 },
] as const;

const PATHS: readonly { from: string; to: string }[] = [
  { from: 'driver', to: 'premium' },
  { from: 'premium', to: 'pool' },
  { from: 'pool', to: 'surplus' },
  { from: 'surplus', to: 'refund' },
  { from: 'refund', to: 'driver' },
] as const;

function nodeById(id: string): Node {
  const n = NODES.find((x) => x.id === id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
}

export function Mechanism() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2, once: true });
  const pathsRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!inView) return;
    const svgEl = pathsRef.current;
    if (!svgEl) return;
    const lines = svgEl.querySelectorAll<SVGPathElement>('[data-flow]');
    if (lines.length === 0) return;

    const lenOf = (el: SVGPathElement): number =>
      typeof el.getTotalLength === 'function' ? el.getTotalLength() : 200;

    for (const line of Array.from(lines)) {
      const len = lenOf(line);
      line.style.strokeDasharray = String(len);
      line.style.strokeDashoffset = String(len);
    }

    if (prefersReducedMotion()) {
      for (const line of Array.from(lines)) {
        line.style.strokeDashoffset = '0';
      }
      return;
    }

    animate(Array.from(lines) as Element[], {
      strokeDashoffset: [(el: SVGPathElement) => lenOf(el), 0],
      duration: 1200,
      ease: 'cubicBezier(0.65, 0, 0.35, 1)',
      delay: (_: unknown, i: number) => i * 180,
    } as never);

    const nodes = svgEl.querySelectorAll<SVGGElement>('[data-node]');
    animate(Array.from(nodes) as Element[], {
      opacity: [0, 1],
      scale: [0.85, 1],
      duration: 700,
      ease: 'cubicBezier(0.22, 1, 0.36, 1)',
      delay: (_: unknown, i: number) => 200 + i * 90,
    } as never);
  }, [inView]);

  return (
    <section
      ref={ref}
      data-section="mechanism"
      className="relative mx-auto w-full max-w-6xl px-6 py-32"
    >
      <p className="eyebrow mb-6">The mechanism</p>
      <h2 className="display-2 mb-6 max-w-3xl">
        Pool the premium. Refund the surplus.
      </h2>
      <p className="lede mb-16">
        Premium flows into a community pool. Claims pay out of the pool.
        Surplus, the bit nobody used, comes back to drivers.
      </p>

      <div className="surface relative overflow-hidden rounded-xl p-8">
        <svg
          ref={pathsRef}
          viewBox="0 0 560 400"
          className="block h-auto w-full"
          role="img"
          aria-label="Premium pool flywheel"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10z" fill="var(--accent)" />
            </marker>
          </defs>

          {PATHS.map((p, i) => {
            const from = nodeById(p.from);
            const to = nodeById(p.to);
            const mx = (from.cx + to.cx) / 2;
            const my = (from.cy + to.cy) / 2 - 30;
            const d = `M ${from.cx} ${from.cy} Q ${mx} ${my} ${to.cx} ${to.cy}`;
            return (
              <path
                key={i}
                data-flow={`${p.from}-${p.to}`}
                d={d}
                stroke="var(--accent)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                markerEnd="url(#arrow)"
                opacity="0.8"
              />
            );
          })}

          {NODES.map((n) => (
            <g key={n.id} data-node={n.id} style={{ opacity: 0 }}>
              <circle
                cx={n.cx}
                cy={n.cy}
                r="38"
                fill="rgba(255,255,255,0.04)"
                stroke="var(--hairline-bright)"
                strokeWidth="1"
              />
              <text
                x={n.cx}
                y={n.cy + 5}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="13"
                fill="var(--text-1)"
                letterSpacing="0.02em"
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

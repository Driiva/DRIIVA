import { useEffect, useRef, useState } from 'react';
import { useReveal } from '@/hooks/useReveal';

interface Factor {
  name: string;
  weight: number; // 0..100
  blurb: string;
}

// These weights are a published claim about how the model scores drivers, so
// they must track SCORE_WEIGHTS in packages/scoring/src/tripMetrics.ts exactly.
// Speed and acceleration were previously swapped here.
const FACTORS: readonly Factor[] = [
  { name: 'Speed discipline', weight: 25, blurb: 'Within the limit, especially residential.' },
  { name: 'Gentle braking', weight: 25, blurb: 'Anticipation over emergency stops.' },
  { name: 'Smooth acceleration', weight: 20, blurb: 'No jackrabbit starts; gradual builds.' },
  { name: 'Calm cornering', weight: 20, blurb: 'Lateral g-force kept in comfort range.' },
  { name: 'Phone-free driving', weight: 10, blurb: 'No screen handling while in motion.' },
];

export function ScoreBreakdown() {
  const ref = useReveal<HTMLElement>();
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setPlayed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setPlayed(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id="score-breakdown" className="breakdown" data-section="breakdown">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow-mini">Explainable scoring</span>
          <h2>Every factor. Every weight. Public.</h2>
          <p>
            We publish the full scoring algorithm. These are the five inputs the model uses,
            ranked by weight.
          </p>
        </div>
        <div ref={innerRef} className={`breakdown-card glass reveal-init${played ? ' is-played' : ''}`}>
          {FACTORS.map((f, i) => (
            <div key={f.name} className="breakdown-row" style={{ ['--breakdown-delay' as string]: i * 90 + 'ms' }}>
              <div className="breakdown-row-head">
                <span className="breakdown-row-name">{f.name}</span>
                <span className="breakdown-row-weight">{f.weight}%</span>
              </div>
              <div className="breakdown-bar-track">
                <div className="breakdown-bar-fill" style={{ ['--breakdown-w' as string]: f.weight + '%' }} />
              </div>
              <p className="breakdown-row-body">{f.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

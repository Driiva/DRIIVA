import { useEffect, useRef } from 'react';
import { useReveal } from '@/hooks/useReveal';
import { useInView } from '@/hooks/useInView';

const POOL_FILL_PCT = 68;

export function Pool() {
  const revealRef = useReveal<HTMLElement>();
  const [inViewRef, inView] = useInView<HTMLDivElement>({ threshold: 0.3, once: true });
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!inView) return;
    const bar = barRef.current;
    if (!bar) return;
    const t = window.setTimeout(() => {
      bar.style.width = `${POOL_FILL_PCT}%`;
    }, 280);
    return () => window.clearTimeout(t);
  }, [inView]);

  return (
    <section ref={revealRef} id="pool" data-section="pool">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow">The community pool</span>
          <h2>Your premium works harder.</h2>
          <p>
            80% of your refund is based on <em>your</em> driving. The other 20% is a community bonus: the
            safer everyone drives, the bigger the pot.
          </p>
        </div>

        <div ref={inViewRef} className="pool-card reveal-init" data-testid="pool-card">
          <div className="pool-flow">
            <div className="pool-node">
              <div className="pool-node-label">Your premium</div>
              <div className="pool-node-value">£840/yr</div>
            </div>
            <div className="pool-arrow" aria-hidden="true">→</div>
            <div className="pool-node">
              <div className="pool-node-label">Pool (60–70%)</div>
              <div className="pool-node-value">Covers claims</div>
            </div>
            <div className="pool-arrow" aria-hidden="true">→</div>
            <div className="pool-node">
              <div className="pool-node-label">Surplus</div>
              <div className="pool-node-value" style={{ color: 'var(--ok)' }}>Refunded</div>
            </div>
          </div>

          <div className="pool-bar-wrap">
            <div className="pool-bar-head">
              <span className="label">Pool funded · Q1 2026</span>
              <span className="value">{POOL_FILL_PCT}% of reserve target</span>
            </div>
            <div className="pool-bar-track">
              <div ref={barRef} className="pool-bar-fill" data-pct={POOL_FILL_PCT} />
            </div>
          </div>

          <div className="pool-split">
            <div className="pool-split-item">
              <span className="lbl">Your score refund</span>
              <span className="amt">£105</span>
            </div>
            <div className="pool-split-item">
              <span className="lbl">Community bonus</span>
              <span className="amt" style={{ color: 'var(--ok)' }}>+£21</span>
            </div>
          </div>
        </div>

        <div className="pool-bullets">
          <div className="glass glass-hover pool-bullet reveal-init">
            <div className="pool-bullet-lead">Your driving matters most</div>
            <div className="pool-bullet-body">
              80% of your refund weighting comes from your personal score. Community performance is a bonus
              on top, never a penalty.
            </div>
          </div>
          <div className="glass glass-hover pool-bullet reveal-init">
            <div className="pool-bullet-lead">The pool protects itself</div>
            <div className="pool-bullet-body">
              High-risk drivers pay more, claim more, and get zero refunds. Bad actors cannot drain the pot:
              the math will not let them.
            </div>
          </div>
          <div className="glass glass-hover pool-bullet reveal-init">
            <div className="pool-bullet-lead">Transparency, built in</div>
            <div className="pool-bullet-body">
              See exactly how your driving affects your refund in real time. No settlement mystery at
              renewal: every factor is public.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

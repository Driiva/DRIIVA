import { useReveal } from '@/hooks/useReveal';
import { useInView } from '@/hooks/useInView';

/*
 * WAVE G: this section used to carry a progress bar reading "Pool funded ·
 * Q1 2026 - 68% of reserve target", animating up to 68 on scroll. There is no
 * reserve target and no pool: addPoolContribution has never had a caller, so
 * the balance is zero by construction. A funded percentage was the most
 * concrete financial claim on the site and it was a constant. The worked
 * example below is kept because the mechanism is real, but it is now labelled
 * as an illustration rather than presented as a statement of position.
 */

export function Pool() {
  const revealRef = useReveal<HTMLElement>();
  const [poolRef] = useInView<HTMLDivElement>({ threshold: 0.3, once: true });

  return (
    <section ref={revealRef} id="pool" data-section="pool">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow-mini">The Driiva Pool</span>
          <h2>Your premium works harder.</h2>
          <p>
            Your driving builds a pool that covers real claims. When the pool performs, the surplus comes
            back, directly to your bank.
          </p>
        </div>

        <div ref={poolRef} className="pool-card reveal-init" data-testid="pool-card">
          <div className="pool-flow">
            <div className="pool-node">
              <div className="pool-node-label">Your Premium</div>
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

          <div className="pool-bar-head">
            <span className="label">Illustration, not a quote</span>
            <span className="value">Nothing is paid until we are FCA-authorised</span>
          </div>

          <div className="pool-split">
            <div className="pool-split-item">
              <span className="lbl">Your score refund</span>
              <span className="amt">£150</span>
            </div>
            <div className="pool-split-item">
              <span className="lbl">Community bonus</span>
              <span className="amt" style={{ color: 'var(--ok)' }}>+£30</span>
            </div>
            <div className="pool-split-item">
              <span className="lbl">Total annual refund</span>
              <span className="amt">£180</span>
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
              High-risk drivers pay more, claim more, and get zero refunds. Bad actors cannot drain the pot,
              the math will not let them.
            </div>
          </div>
          <div className="glass glass-hover pool-bullet reveal-init">
            <div className="pool-bullet-lead">Transparency, built in</div>
            <div className="pool-bullet-body">
              See exactly how your driving affects your refund in real time. No settlement mystery at
              renewal, every factor is public.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

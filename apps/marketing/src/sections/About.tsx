import { useReveal } from '@/hooks/useReveal';

export function About() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="about" data-section="about">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow-mini">From the founder</span>
          <h2>Why Driiva exists.</h2>
        </div>
        <div className="glass founder-card reveal-init" data-testid="founder-card">
          <p className="founder-quote">
            "Motor insurance is the only product where{' '}
            <span className="hl">good behaviour goes unrewarded</span>. You pay the same as the speeder
            down the road. We built Driiva because the math{' '}
            <span className="hl">should reward the people who keep the roads safer</span>, not punish them
            at renewal."
          </p>
          <div className="founder-meta">
            <div className="founder-avatar" aria-hidden="true">J</div>
            <div>
              <div className="founder-name">Jamal</div>
              <div className="founder-role">Founder &amp; CEO, Driiva</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

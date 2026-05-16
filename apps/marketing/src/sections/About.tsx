import { useReveal } from '@/hooks/useReveal';

export function About() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="about" data-section="about">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow">About</span>
          <h2>Built by a physiotherapist who thinks in systems.</h2>
        </div>
        <div className="glass founder-card reveal-init" data-testid="founder-card">
          <div className="founder-quote">
            "Clinical medicine teaches you <span className="highlight">risk stratification</span>,{' '}
            <span className="highlight">behaviour change</span>, and{' '}
            <span className="highlight">trust</span>. Insurance needs all three."
          </div>
          <div className="founder-body">
            Driiva is what happens when you rebuild motor insurance from the patient's perspective: fair
            pricing, honest data, real rewards. No commission-driven upsells. No fine print that exists to
            confuse. Every feature designed around one question: does this make driving safer, or does it
            just make the spreadsheet look nicer?
          </div>
          <div className="founder-name">
            <strong>Jamal</strong>, Founder &amp; CEO · Driiva Ltd
          </div>
        </div>
      </div>
    </section>
  );
}

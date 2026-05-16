import { useReveal } from '@/hooks/useReveal';

interface Step {
  num: string;
  title: string;
  body: string;
}

const STEPS: readonly Step[] = [
  {
    num: '01. Download',
    title: 'Install the app',
    body: "No OBD plugs, no dashcams. Your phone's GPS and accelerometer do the work.",
  },
  {
    num: '02. Drive',
    title: 'Drive normally',
    body: 'Our AI scores every trip across speed, braking, cornering, and night driving. Every factor, every weight: visible.',
  },
  {
    num: '03. Score',
    title: 'Build your score',
    body: 'Your driving builds a personal score out of 100. Above 70 qualifies for refunds. Updates in real time.',
  },
  {
    num: '04. Earn',
    title: 'Get paid back',
    body: "When safe drivers keep claims low, the pool's surplus returns to you: up to 15% annually, straight to your bank.",
  },
] as const;

export function HowItWorks() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="how-it-works" data-section="how-it-works">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow">How it works</span>
          <h2>From download to refund in four steps.</h2>
          <p>No hardware. No black box. Just your phone, your driving, and your reward.</p>
        </div>
        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <div key={i} className="glass glass-hover step reveal-init" data-testid={`step-${i + 1}`}>
              <div className="step-num">{s.num}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-body">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

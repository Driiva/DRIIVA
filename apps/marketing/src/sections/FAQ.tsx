import { useReveal } from '@/hooks/useReveal';

interface Q {
  q: string;
  a: string;
}

const QS: readonly Q[] = [
  {
    q: 'Will this really be cheaper than my current insurance?',
    a: "For safe drivers, yes, demonstrably. Our modelling shows the top 40% of drivers save 8 to 15% versus their current renewal. If you drive aggressively, we're not for you, and that's deliberate.",
  },
  {
    q: 'What counts as a "safe" trip?',
    a: 'We score five factors: smooth acceleration, gentle braking, calm cornering, speed discipline, and phone-free driving. Every factor is weighted and published in the app in real time. You see the score change as you drive.',
  },
  {
    q: 'What happens if I have an accident?',
    a: 'Your claim is paid immediately and in full by our reinsurance capital. Score refunds are separate from claim protection. One bad week does not bankrupt you.',
  },
  {
    q: 'Is this legal? Are you FCA-regulated?',
    a: 'Application in progress with the FCA Regulatory Sandbox, underwritten by a PRA-regulated UK reinsurer. We cannot sell policies yet, that is why this is a waitlist, not a checkout.',
  },
  {
    q: 'Do I need to install a dashcam or OBD dongle?',
    a: 'No. Your phone does everything. No hardware to buy, install, or forget to plug back in.',
  },
] as const;

export function FAQ() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="faq" data-section="faq">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow-mini">Questions, answered</span>
          <h2>You asked. We answered.</h2>
        </div>
        <div className="faq-list reveal-init">
          {QS.map((qa, i) => (
            <details key={i} className="glass faq" data-testid={`faq-${i + 1}`}>
              <summary>
                {qa.q}
                <svg
                  className="chev"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div className="faq-body">{qa.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

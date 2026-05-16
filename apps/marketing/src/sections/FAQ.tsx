import { useReveal } from '@/hooks/useReveal';

interface Q {
  q: string;
  a: string;
}

const QS: readonly Q[] = [
  {
    q: 'How does the refund pool work?',
    a: 'Your premium feeds a shared pool alongside other drivers’ premiums. Roughly 60–70% covers claims. When the pool performs well, because safe drivers keep claims low, the SURPLUS gets distributed back as refunds, weighted 80% by your personal score and 20% by community performance. Refunds are paid annually, up to 15%.',
  },
  {
    q: 'What if other drivers are reckless?',
    a: "They don't drain the pool. Our underwriting prices high-risk drivers at higher premiums upfront, so they contribute more. If their score stays below 70 they receive ZERO refunds. Only safe drivers earn cashback. The model protects the pot, not the reckless.",
  },
  {
    q: 'What data do you collect?',
    a: "Only what's needed to score driving: GPS speed, accelerometer (braking, cornering, acceleration), gyroscope (phone handling), trip timing. We NEVER sell location data. Encrypted at rest and in transit. You can delete your account and data at any time.",
  },
  {
    q: 'Do I need any hardware?',
    a: 'No. Your phone is the sensor. No OBD dongle, no dashcam, nothing to install in your car. Drop it in a pocket or cup holder and the app detects trips automatically.',
  },
  {
    q: 'How is my score calculated?',
    a: 'Four factors, weighted and visible: SPEED (speeding vs posted limits), BRAKING (harshness), ACCELERATION (smoothness), CORNERING (G-force). Each factor scored 0–100, aggregated into your trip and 30-day average scores. Every trip includes a plain-English breakdown.',
  },
  {
    q: 'Is Driiva regulated?',
    a: "Motor insurance in the UK must be FCA-authorised. Our FCA Sandbox application is in progress, meaning we will operate under full regulatory oversight and consumer-duty obligations from the moment we write policies. We'll publish our authorisation status transparently when granted.",
  },
  {
    q: "What's the Early Refund Guarantee?",
    a: 'A commitment to beta participants: if our underwriting model underperforms expectations and your cohort would otherwise receive no refund, we top up from reserves. Subject to eligibility criteria, caps, and FCA guidance. Not a guaranteed profit scheme. This exists to prove the model works, not to promise returns.',
  },
] as const;

export function FAQ() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="faq" data-section="faq">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow">Questions</span>
          <h2>The important stuff, answered.</h2>
          <p>
            If we've missed one, email{' '}
            <a href="mailto:hello@driiva.co.uk" style={{ color: 'var(--brand-lilac)', textDecoration: 'none' }}>
              hello@driiva.co.uk
            </a>
            .
          </p>
        </div>
        <div className="faq-list reveal-init">
          {QS.map((qa, i) => (
            <details key={i} className="faq-item" data-testid={`faq-${i + 1}`}>
              <summary>
                {qa.q}
                <span className="faq-toggle" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <div className="faq-body">{qa.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

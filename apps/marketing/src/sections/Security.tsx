import { useReveal } from '@/hooks/useReveal';
import type { JSX } from 'react';

interface TrustCard {
  id: string;
  title: string;
  body: string;
  icon: () => JSX.Element;
}

const Shield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const Lock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const Globe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const Speech = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);
const Symbol = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const CheckCircle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 12l2 2 4-4" />
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const CARDS: readonly TrustCard[] = [
  {
    id: 'fca',
    title: 'FCA Sandbox in progress',
    body: 'Application underway with the FCA. Full regulatory oversight from the day we write our first policy.',
    icon: Shield,
  },
  {
    id: 'encryption',
    title: 'End-to-end encryption',
    body: 'Your data is encrypted in transit and at rest. We score your driving, not your life. Location trails are never shared.',
    icon: Lock,
  },
  {
    id: 'algorithm',
    title: 'Transparent algorithm',
    body: 'Every scoring factor is defined before the model trains. No hidden weights, no opaque tuning after the fact.',
    icon: Globe,
  },
  {
    id: 'explainable',
    title: 'Explainable AI',
    body: 'Our AI explains every score in plain English. "Hard braking on the A40: costs you 3 points this trip." No black boxes.',
    icon: Speech,
  },
  {
    id: 'shariah',
    title: 'Shariah-compliant structure',
    body: 'Profit-sharing pool mechanics align with ethical finance principles: interest-free, transparent, risk-shared.',
    icon: Symbol,
  },
  {
    id: 'guarantee',
    title: 'Early Refund Guarantee',
    body: "Beta participants are covered: if our underwriting model doesn't deliver, we refund early, subject to eligibility criteria.",
    icon: CheckCircle,
  },
] as const;

export function Security() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="security" data-section="security">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow">Security &amp; trust</span>
          <h2>Built different. Regulated properly.</h2>
          <p>
            Motor insurance is heavily regulated in the UK, and we are building for that from day one, not
            after launch.
          </p>
        </div>
        <div className="trust-grid">
          {CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.id} className="glass glass-hover trust-card reveal-init" data-testid={`trust-${c.id}`}>
                <div className="trust-icon">
                  <Icon />
                </div>
                <div className="trust-title">{c.title}</div>
                <div className="trust-body">{c.body}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

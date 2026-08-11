import { useReveal } from '@/hooks/useReveal';
import type { JSX } from 'react';

interface TrustCard {
  id: string;
  title: string;
  body: string;
  icon: () => JSX.Element;
}

const Lock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const Brackets = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);
const Clock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const ShieldCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const Capital = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6z" />
  </svg>
);

const CARDS: readonly TrustCard[] = [
  {
    id: 'encrypted',
    title: 'End-to-end encrypted',
    body: 'Driving data is encrypted at rest (AES-256) and in flight (TLS 1.3). UK-sovereign servers only. GDPR Article 15 data export in one tap.',
    icon: Lock,
  },
  {
    id: 'open-algo',
    title: 'Open scoring algorithm',
    body: 'Every factor, weighting, and threshold is published. No black-box models. Audit it, argue with it, propose changes. PRs welcome.',
    icon: Brackets,
  },
  {
    id: 'annual',
    title: 'Annual refunds, no fine print',
    body: "Pool surplus is paid back once a year, cleanly. No 'subject to conditions' at renewal. The weighting is visible every day in-app.",
    icon: Clock,
  },
  {
    id: 'data-rights',
    title: 'Your data, your rights',
    body: 'We never sell driving data. Delete your account and every trip is purged within 30 days. You can export the lot in JSON anytime.',
    icon: ShieldCheck,
  },
  {
    id: 'capital',
    title: 'Capital-backed, not crowd-funded',
    body: 'Claims will be met from reinsurance capital, not from the refund pool, so a claim and a refund never compete. The capital comes from a PRA-regulated UK reinsurer once underwriting begins.',
    icon: Capital,
  },
] as const;

export function Security() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="security" data-section="security">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow-mini">Trust &amp; security</span>
          <h2>Built for regulation, not around it.</h2>
          <p>
            Motor insurance is heavily regulated in the UK, and we're building for that from day one, not
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

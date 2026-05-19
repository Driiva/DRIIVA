import { useEffect, useRef, useState } from 'react';
import { useReveal } from '@/hooks/useReveal';

// Target beta-open date. Updated alongside the FCA Sandbox milestone.
const BETA_TARGET = new Date('2026-09-01T09:00:00+01:00');

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function remainingFrom(target: Date): Remaining {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, seconds, done: false };
}

export function BetaCountdown() {
  const sectionRef = useReveal<HTMLElement>();
  const [r, setR] = useState<Remaining>(() => remainingFrom(BETA_TARGET));
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setR(remainingFrom(BETA_TARGET)), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="beta-countdown"
      data-section="beta-countdown"
      aria-label="Beta launch countdown"
    >
      <div className="container">
        <div className="beta-countdown-card reveal-init glass">
          <div className="beta-countdown-head">
            <span className="beta-countdown-pulse" aria-hidden="true" />
            <span ref={labelRef} className="beta-countdown-label">
              {r.done ? 'Beta is now open' : 'Beta opens in'}
            </span>
          </div>
          <div className="beta-countdown-grid" role="timer" aria-live="off">
            <Cell value={r.days} label="days" />
            <Cell value={r.hours} label="hours" />
            <Cell value={r.minutes} label="min" />
            <Cell value={r.seconds} label="sec" pulse />
          </div>
          <p className="beta-countdown-foot">
            Target unlock {BETA_TARGET.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
            Waitlist members are notified first.
          </p>
        </div>
      </div>
    </section>
  );
}

function Cell({ value, label, pulse }: { value: number; label: string; pulse?: boolean }) {
  return (
    <div className={`beta-countdown-cell${pulse ? ' is-pulse' : ''}`}>
      <span className="beta-countdown-value">{String(value).padStart(2, '0')}</span>
      <span className="beta-countdown-cell-label">{label}</span>
    </div>
  );
}

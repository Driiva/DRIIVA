import { forwardRef } from 'react';

interface Metric {
  value: string;
  label: string;
  tone: 'ok' | 'iris' | 'amber';
}

const METRICS: readonly Metric[] = [
  { value: '117', label: 'on the waitlist', tone: 'ok' },
  { value: '84/100', label: 'avg driver score', tone: 'iris' },
  { value: '£18.4k', label: 'refunds tracked', tone: 'amber' },
] as const;

export const LiveStrip = forwardRef<HTMLDivElement>(function LiveStrip(_props, ref) {
  return (
    <div
      ref={ref}
      className="live-strip"
      data-testid="live-strip"
      aria-label="Live driver metrics"
      style={{ opacity: 0 }}
    >
      {METRICS.map((m) => (
        <div key={m.label} className={`live-pill live-${m.tone}`}>
          <span className="live-dot" aria-hidden="true" />
          <span className="live-value">{m.value}</span>
          <span className="live-label">{m.label}</span>
        </div>
      ))}
    </div>
  );
});

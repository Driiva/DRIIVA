/**
 * EmptyState and the skeleton family, ported from the StrydeOS dashboard
 * (components/ui/EmptyState.tsx) and retuned to Driiva instrument tokens.
 *
 * The rule this enforces: empty means empty. An empty state never fills the
 * gap with a sample trip, a demo leaderboard, or a plausible number. It says
 * what is not there yet, why, and what produces the first row.
 */
import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Lucide icon at 24px, or a mark. Never an emoji. */
  icon?: ReactNode;
  heading: string;
  subtext: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, heading, subtext, action }: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center justify-center py-14 px-6 text-center overflow-hidden">
      {/* A single wash of the accent, well under the text. Colour is earned. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(360px circle at 50% 40%, rgba(var(--app-primary-rgb), 0.07), transparent 70%)',
        }}
        aria-hidden="true"
      />

      {icon && (
        <span
          className="relative mb-5 inline-flex h-14 w-14 items-center justify-center"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'rgba(var(--app-primary-rgb), 0.10)',
            boxShadow: 'inset 0 0 0 1px rgba(var(--app-primary-rgb), 0.18)',
            color: 'var(--app-primary)',
          }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}

      <h3 className="relative font-display text-xl mb-2" style={{ color: 'var(--app-text-hero)' }}>
        {heading}
      </h3>
      <p
        className="relative text-[15px] max-w-sm leading-relaxed"
        style={{ color: 'var(--app-text-sec)' }}
      >
        {subtext}
      </p>
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

/**
 * Skeleton - a shimmering block the size of the thing that is coming.
 *
 * Sized to the real content rather than a generic bar, so the page does not
 * reflow when the data lands. The shimmer is CSS, not framer-motion, so a list
 * of forty of them costs one animation rather than forty.
 */
export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton-shimmer ${className}`} style={style} aria-hidden="true" />;
}

/** A readout tile placeholder: label, figure, caption. */
export function SkeletonStat() {
  return (
    <div
      className="p-4"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--app-surface-1)',
        border: '1px solid var(--app-border)',
      }}
    >
      <Skeleton className="h-2.5 w-16 mb-3" style={{ borderRadius: 4 }} />
      <Skeleton className="h-8 w-20 mb-2" style={{ borderRadius: 6 }} />
      <Skeleton className="h-2 w-12" style={{ borderRadius: 4 }} />
    </div>
  );
}

/** A trip or leaderboard row: avatar, two lines, trailing figure. */
export function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-3 p-4"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--app-surface-1)',
        border: '1px solid var(--app-border)',
      }}
    >
      <Skeleton className="h-10 w-10 shrink-0" style={{ borderRadius: 'var(--radius-md)' }} />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-3 w-32 mb-2" style={{ borderRadius: 4 }} />
        <Skeleton className="h-2.5 w-20" style={{ borderRadius: 4 }} />
      </div>
      <Skeleton className="h-6 w-10 shrink-0" style={{ borderRadius: 6 }} />
    </div>
  );
}

/** `count` rows with the standard gap. */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export default EmptyState;

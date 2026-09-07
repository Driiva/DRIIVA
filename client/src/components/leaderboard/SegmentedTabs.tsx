/**
 * The period and scope tab strips, and the two unions they switch between.
 * Extracted verbatim from client/src/pages/leaderboard.tsx.
 */
import { motion } from 'framer-motion';

export type PeriodType = 'weekly' | 'monthly' | 'all_time';
export type Scope = 'global' | 'friends';

export function SegmentedTabs<T extends string>({
  tabs,
  selected,
  onChange,
  ariaLabel,
}: {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  selected: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex p-1 mb-4"
      style={{ borderRadius: 'var(--radius-card)', background: 'var(--app-surface-1)' }}
    >
      {tabs.map((tab) => {
        const active = selected === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className="flex-1 py-2 px-3 text-[14px] transition-colors"
            style={{
              borderRadius: 'var(--radius-md)',
              background: active ? 'var(--app-primary)' : 'transparent',
              color: active ? 'var(--app-text-hero)' : 'var(--app-text-sec)',
              fontWeight: active ? 600 : 500,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

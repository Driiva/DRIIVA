/**
 * The leaderboard's row parts: the rank marker, the movement indicator and the
 * row itself. Extracted verbatim from client/src/pages/leaderboard.tsx,
 * including the note on why the top three are not gold, silver and bronze.
 */
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Minus } from 'lucide-react';

import type { LeaderboardEntry } from '@/hooks/useCommunityData';

/**
 * Rank marker. The top three are distinguished by WEIGHT and a filled surface
 * rather than by gold, silver and bronze: medal colours are three more hues on
 * a surface whose whole discipline is one accent, and they carry no meaning a
 * position number does not already carry.
 */
export function RankBadge({ rank, isCurrentUser }: { rank: number; isCurrentUser: boolean }) {
  const podium = rank <= 3;
  return (
    <div
      className="w-8 h-8 flex items-center justify-center text-[13px] tabular shrink-0"
      style={{
        borderRadius: 'var(--radius-md)',
        background: isCurrentUser
          ? 'var(--app-primary)'
          : podium
            ? 'rgba(var(--app-primary-rgb), 0.18)'
            : 'var(--app-surface-2)',
        color: isCurrentUser
          ? 'var(--app-text-hero)'
          : podium
            ? 'var(--app-primary-text)'
            : 'var(--app-text-sec)',
        fontWeight: podium || isCurrentUser ? 600 : 500,
      }}
    >
      {rank}
    </div>
  );
}

/**
 * Movement since the previous period. Direction is carried by the ICON as well
 * as the colour, because up-green against down-red is the single most common
 * thing a colour-blind reader cannot separate.
 */
export function ChangeIndicator({ change }: { change: number }) {
  const Icon = change > 0 ? ChevronUp : change < 0 ? ChevronDown : Minus;
  const colour =
    change > 0 ? 'var(--ok)' : change < 0 ? 'var(--app-text-sec)' : 'var(--app-text-mut)';
  const label = change > 0 ? `up ${change}` : change < 0 ? `down ${Math.abs(change)}` : 'no change';

  return (
    <div className="flex items-center gap-0.5 w-12 justify-end" title={label}>
      <Icon size={14} strokeWidth={2.5} color={colour} aria-hidden="true" />
      <span className="text-[12px] tabular" style={{ color: colour }}>
        {change === 0 ? '0' : Math.abs(change)}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LeaderboardRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.02, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center justify-between p-3"
      style={{
        borderRadius: 'var(--radius-card)',
        background: entry.isCurrentUser
          ? 'rgba(var(--app-primary-rgb), 0.12)'
          : 'var(--app-surface-1)',
        border: entry.isCurrentUser
          ? '1px solid rgba(var(--app-primary-rgb), 0.30)'
          : '1px solid var(--app-border)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RankBadge rank={entry.rank} isCurrentUser={entry.isCurrentUser} />
        <div className="min-w-0">
          <div
            className="text-[15px] truncate"
            style={{ color: entry.isCurrentUser ? 'var(--app-primary-text)' : 'var(--app-text-pri)' }}
          >
            {entry.anonymizedName}
            {entry.isCurrentUser && (
              <span className="ml-2 text-[13px]" style={{ color: 'var(--app-text-sec)' }}>
                you
              </span>
            )}
          </div>
          <div className="text-[13px]" style={{ color: 'var(--app-text-sec)' }}>
            <span className="tabular">{entry.totalTrips}</span> trips ·{' '}
            <span className="tabular">{Math.round(entry.totalMiles)}</span> mi
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-[18px] tabular" style={{ color: 'var(--app-text-hero)', fontWeight: 600 }}>
          {entry.score}
        </div>
        <ChangeIndicator change={entry.change} />
      </div>
    </motion.div>
  );
}

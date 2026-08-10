/**
 * LEADERBOARD PAGE
 * ================
 * Community rankings, read from the real `leaderboard` collection that the
 * scheduled function recomputes every 15 minutes.
 *
 * Scope: global (everyone) or friends (the viewer's social graph). The friends
 * board is the global board filtered by real friendships, not a second data
 * source, so a friend's rank always agrees with their rank overall.
 *
 * Pagination is in-memory by design. A board is ONE Firestore document holding
 * at most 100 rankings, so the page is already loaded by the time it renders;
 * slicing it is honest and a cursor would be theatre. If the board ever
 * outgrows a single document, this is the seam to change.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  Trophy,
  ChevronUp,
  ChevronDown,
  Minus,
  RefreshCw,
  Users,
  UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageWrapper } from '../components/PageWrapper';
import { BottomNav } from '../components/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommunityData, LeaderboardEntry } from '@/hooks/useCommunityData';
import { useFriends } from '@/hooks/useFriends';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState, SkeletonList, SkeletonStat } from '@/components/ui/EmptyState';
import { InviteSheet } from '@/components/InviteSheet';
import { PoolPanel } from '@/components/PoolPanel';

const PAGE_SIZE = 25;

// ============================================================================
// SKELETONS
// ============================================================================

function LeaderboardSkeleton() {
  return <SkeletonList count={8} />;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

// ============================================================================
// ROW PARTS
// ============================================================================

/**
 * Rank marker. The top three are distinguished by WEIGHT and a filled surface
 * rather than by gold, silver and bronze: medal colours are three more hues on
 * a surface whose whole discipline is one accent, and they carry no meaning a
 * position number does not already carry.
 */
function RankBadge({ rank, isCurrentUser }: { rank: number; isCurrentUser: boolean }) {
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
function ChangeIndicator({ change }: { change: number }) {
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

function LeaderboardRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
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

// ============================================================================
// TABS
// ============================================================================

type PeriodType = 'weekly' | 'monthly' | 'all_time';
type Scope = 'global' | 'friends';

function SegmentedTabs<T extends string>({
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

// ============================================================================
// PAGE
// ============================================================================

/**
 * Pool totals span three orders of magnitude between launch and scale, so the
 * unit adapts rather than flooring small real values to "GBP 0k".
 */
function formatPoolTotal(pounds: number): string {
  if (pounds >= 10000) return `£${Math.round(pounds / 1000)}k`;
  if (pounds >= 1000) return `£${(pounds / 1000).toFixed(1)}k`;
  return `£${Math.round(pounds)}`;
}

const PERIOD_TABS = [
  { id: 'weekly' as const, label: 'This week' },
  { id: 'monthly' as const, label: 'This month' },
  { id: 'all_time' as const, label: 'All time' },
];

const SCOPE_TABS = [
  { id: 'global' as const, label: 'Global' },
  { id: 'friends' as const, label: 'Friends' },
];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [scope, setScope] = useState<Scope>('global');
  const [page, setPage] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('driiva-demo-mode') === 'true') setIsDemoMode(true);
  }, []);

  const firebaseUserId = isDemoMode ? null : (user?.id ?? null);

  const {
    pool,
    poolLoading,
    userShare,
    leaderboard,
    leaderboardLoading,
    leaderboardError,
    refresh,
    setLeaderboardPeriodType,
  } = useCommunityData(firebaseUserId);

  const { friends, loading: friendsLoading } = useFriends(firebaseUserId);

  // Wave B: the demo leaderboard was fifteen invented drivers with invented
  // scores, ranks and movement. Demo mode now reads the same real board as
  // everyone else and shows the same honest empty state when there is nothing
  // in it yet.
  const allRankings = leaderboard?.rankings ?? [];

  const friendUids = useMemo(() => new Set(friends.map((f) => f.uid)), [friends]);

  // The friends board is the global board filtered, so a friend's rank here is
  // their real standing overall rather than a position within a small group.
  const rankings = useMemo(() => {
    if (scope === 'global') return allRankings;
    return allRankings.filter((entry) => entry.isCurrentUser || friendUids.has(entry.userId));
  }, [scope, allRankings, friendUids]);

  useEffect(() => setPage(0), [scope, leaderboard?.periodType]);

  const pageCount = Math.max(1, Math.ceil(rankings.length / PAGE_SIZE));
  const visible = rankings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const userEntry = leaderboard?.userEntry ?? null;
  const userRank = leaderboard?.userRank ?? null;
  // Pinned when the viewer is ranked but not on the page in front of them.
  const showPinnedRank =
    Boolean(userEntry) && !visible.some((e) => e.isCurrentUser) && scope === 'global';

  const activeParticipants = pool?.activeParticipants || leaderboard?.totalParticipants || 0;
  const avgScore = leaderboard?.averageScore || 0;
  const poolTotalPounds = pool?.totalPoolPounds || 0;

  const periodLabel =
    leaderboard?.periodType === 'weekly'
      ? 'This week'
      : leaderboard?.periodType === 'monthly'
        ? 'This month'
        : 'All time';

  const loadingBoard = leaderboardLoading || (scope === 'friends' && friendsLoading);

  return (
    <PageWrapper>
      <div className="pb-24">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <button
                  aria-label="Back to dashboard"
                  className="w-10 h-10 flex items-center justify-center"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--app-surface-1)',
                    border: '1px solid var(--app-border)',
                  }}
                >
                  <ArrowLeft className="w-5 h-5" style={{ color: 'var(--app-text-pri)' }} />
                </button>
              </Link>
              <div>
                <h1 className="text-[18px]" style={{ color: 'var(--app-text-hero)' }}>
                  Leaderboard
                </h1>
                <p className="text-[13px]" style={{ color: 'var(--app-text-sec)' }}>
                  {periodLabel}
                  {leaderboard?.calculatedAt && (
                    <span style={{ color: 'var(--app-text-mut)' }}>
                      {' · updated '}
                      {new Date(leaderboard.calculatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={refresh}
              aria-label="Refresh leaderboard"
              className="w-10 h-10 flex items-center justify-center"
              style={{
                borderRadius: 'var(--radius-md)',
                background: 'var(--app-surface-1)',
                border: '1px solid var(--app-border)',
              }}
            >
              <RefreshCw
                className={`w-4 h-4 ${leaderboardLoading ? 'animate-spin' : ''}`}
                style={{ color: 'var(--app-text-pri)' }}
              />
            </button>
          </div>
        </header>

        <SegmentedTabs tabs={SCOPE_TABS} selected={scope} onChange={setScope} ariaLabel="Leaderboard scope" />
        <SegmentedTabs
          tabs={PERIOD_TABS}
          selected={(leaderboard?.periodType as PeriodType) || 'weekly'}
          onChange={(p) => setLeaderboardPeriodType(p)}
          ariaLabel="Leaderboard period"
        />

        {/* Community stats */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card
            style={{
              background: 'var(--app-surface-1)',
              border: '1px solid var(--app-border)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: 'var(--app-text-hero)' }}>
                <Trophy className="w-5 h-5" style={{ color: 'var(--app-primary-text)' }} />
                <span className="text-[16px]">{periodLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {poolLoading ? (
                <StatsSkeleton />
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-[18px] tabular" style={{ color: 'var(--app-text-hero)', fontWeight: 600 }}>
                      {activeParticipants.toLocaleString('en-GB')}
                    </div>
                    <div className="stat-label mt-1">Drivers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[18px] tabular" style={{ color: 'var(--app-text-hero)', fontWeight: 600 }}>
                      {avgScore.toFixed(1)}
                    </div>
                    <div className="stat-label mt-1">Avg score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[18px] tabular" style={{ color: 'var(--app-text-hero)', fontWeight: 600 }}>
                      {formatPoolTotal(poolTotalPounds)}
                    </div>
                    <div className="stat-label mt-1">Pool</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <PoolPanel
          activeParticipants={activeParticipants}
          averagePoolScore={pool?.averagePoolScore ?? 0}
          safetyFactor={pool?.safetyFactor ?? 0}
          userSharePercentage={userShare?.sharePercentage ?? 0}
          userWeightedScore={Math.round(userShare?.weightedScore ?? 0)}
          loading={poolLoading}
        />

        {/* Rankings */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card
            style={{
              background: 'var(--app-surface-1)',
              border: '1px solid var(--app-border)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between" style={{ color: 'var(--app-text-hero)' }}>
                <span className="text-[16px]">{scope === 'friends' ? 'Friends' : 'Rankings'}</span>
                {rankings.length > 0 && (
                  <span className="text-[13px] tabular" style={{ color: 'var(--app-text-sec)' }}>
                    {rankings.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBoard ? (
                <LeaderboardSkeleton />
              ) : leaderboardError ? (
                <EmptyState
                  icon={<Trophy size={24} strokeWidth={2} />}
                  heading="The leaderboard did not load"
                  subtext="Your score and trips are safe. This is a problem reading the board, not a problem with your data."
                  action={
                    <button
                      onClick={refresh}
                      className="px-5 py-2.5 text-[14px]"
                      style={{
                        borderRadius: 'var(--radius-button)',
                        background: 'var(--app-primary)',
                        color: 'var(--app-text-hero)',
                      }}
                    >
                      Try again
                    </button>
                  }
                />
              ) : scope === 'friends' && friends.length === 0 ? (
                <EmptyState
                  icon={<UserPlus size={24} strokeWidth={2} />}
                  heading="No friends yet"
                  subtext="Invite someone you drive against. Their real scores appear here, on the same board as everyone else."
                  action={
                    <button
                      onClick={() => setInviteOpen(true)}
                      className="px-5 py-2.5 text-[14px]"
                      style={{
                        borderRadius: 'var(--radius-button)',
                        background: 'var(--app-primary)',
                        color: 'var(--app-text-hero)',
                      }}
                    >
                      Invite a friend
                    </button>
                  }
                />
              ) : rankings.length === 0 ? (
                <EmptyState
                  icon={<Users size={24} strokeWidth={2} />}
                  heading={
                    scope === 'friends'
                      ? 'No friends on this board yet'
                      : 'No rankings yet this period'
                  }
                  subtext={
                    scope === 'friends'
                      ? 'Your friends appear here once they complete a scored trip in this period.'
                      : 'The board fills as drivers complete scored trips. Yours appears once your first trip of the period lands.'
                  }
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {visible.map((entry, index) => (
                      <LeaderboardRow key={`${entry.rank}-${entry.userId}`} entry={entry} index={index} />
                    ))}
                  </div>

                  {pageCount > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-4 py-2 text-[14px] disabled:opacity-40"
                        style={{
                          borderRadius: 'var(--radius-button)',
                          background: 'var(--app-surface-2)',
                          color: 'var(--app-text-pri)',
                        }}
                      >
                        Previous
                      </button>
                      <span className="text-[13px] tabular" style={{ color: 'var(--app-text-sec)' }}>
                        Page {page + 1} of {pageCount}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        disabled={page >= pageCount - 1}
                        className="px-4 py-2 text-[14px] disabled:opacity-40"
                        style={{
                          borderRadius: 'var(--radius-button)',
                          background: 'var(--app-surface-2)',
                          color: 'var(--app-text-pri)',
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* The viewer's own standing, pinned when they are off-page. */}
        {showPinnedRank && userEntry && (
          <div className="sticky bottom-24 mt-4">
            <div
              className="flex items-center justify-between p-3"
              style={{
                borderRadius: 'var(--radius-card)',
                background: 'var(--app-surface-2)',
                border: '1px solid rgba(var(--app-primary-rgb), 0.30)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="flex items-center gap-3">
                <RankBadge rank={userEntry.rank} isCurrentUser />
                <div>
                  <div className="text-[15px]" style={{ color: 'var(--app-primary-text)' }}>
                    Your position
                  </div>
                  <div className="text-[13px]" style={{ color: 'var(--app-text-sec)' }}>
                    <span className="tabular">{userEntry.totalTrips}</span> trips ·{' '}
                    <span className="tabular">{Math.round(userEntry.totalMiles)}</span> mi
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[18px] tabular" style={{ color: 'var(--app-text-hero)', fontWeight: 600 }}>
                  {userEntry.score}
                </div>
                <ChangeIndicator change={userEntry.change} />
              </div>
            </div>
          </div>
        )}

        {/* Ranked-but-absent is different from unranked, and says so. */}
        {!loadingBoard && !leaderboardError && !userRank && allRankings.length > 0 && (
          <p className="text-[13px] mt-4 text-center" style={{ color: 'var(--app-text-sec)' }}>
            You are not on this board yet. Complete a scored trip in this period to appear.
          </p>
        )}
      </div>

      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <BottomNav />
    </PageWrapper>
  );
}

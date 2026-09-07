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
  RefreshCw,
  Users,
  UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageWrapper } from '../components/PageWrapper';
import { BottomNav } from '../components/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommunityData } from '@/hooks/useCommunityData';
import { useFriends } from '@/hooks/useFriends';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { InviteSheet } from '@/components/InviteSheet';
import { PoolPanel } from '@/components/PoolPanel';

const PAGE_SIZE = 25;

// The skeletons, the row parts and the tab strip live in
// client/src/components/leaderboard/.
import { LeaderboardSkeleton, StatsSkeleton } from '@/components/leaderboard/skeletons';
import { ChangeIndicator, LeaderboardRow, RankBadge } from '@/components/leaderboard/rows';
import {
  SegmentedTabs,
  type PeriodType,
  type Scope,
} from '@/components/leaderboard/SegmentedTabs';

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
  // Null when no board exists. It used to fall back to 0, which rendered
  // "Avg score 0.0" as though somebody had measured the community at zero.
  const avgScore = typeof leaderboard?.averageScore === 'number' ? leaderboard.averageScore : null;
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
                  leaderboard
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
                      {avgScore != null ? avgScore.toFixed(1) : 'No data'}
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
          averagePoolScore={typeof pool?.averagePoolScore === 'number' ? pool.averagePoolScore : null}
          safetyFactor={typeof pool?.safetyFactor === 'number' ? pool.safetyFactor : null}
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
                  tone="error"
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


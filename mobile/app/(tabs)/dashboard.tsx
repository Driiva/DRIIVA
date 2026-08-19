/**
 * Dashboard - Driiva Mobile
 *
 * The home screen leads with the three Driiva targets, in order: the safety
 * score, the cashback that score is working towards, and the community pool
 * the driver belongs to. Everything below that is supporting detail.
 *
 * WHAT THIS SCREEN WILL NOT DO
 * Two of those three targets are not funded yet, and an honest headline beats
 * a plausible one:
 *
 * - CASHBACK is a projection, shown only where a real policy premium exists to
 *   project from, which is the rule the post-trip refund moment already
 *   follows. With no policy there is no figure, only what has to happen for
 *   there to be one. Driiva has never paid a refund, so there is no
 *   "earned to date" to show either.
 * - THE POOL shows participation and the driver's share percentage, both of
 *   which are computed today, and never a pound figure. The money model (D6)
 *   is still open and addPoolContribution has no callers, so any pool value
 *   here would be a number nobody has committed to. This mirrors the web pool
 *   panel, which plots participation for exactly the same reason.
 */
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { C, T, F, S, scoreColor, FS } from '@/components/ui/theme';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { StatCard } from '@/components/ui/StatCard';
import { ScoreBreakdownBar } from '@/components/ui/ScoreBreakdownBar';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { CountUp } from '@/components/ui/CountUp';
import { SCORE_WEIGHTS, projectedRefundCents } from '@driiva/scoring';

/**
 * Mirrors RecentTripSummary in packages/contracts (and the RecentTripSummary
 * the trip-completion trigger writes). Metres and seconds; converted to miles
 * and minutes only where they are rendered.
 *
 * Wave 0 (0e): this interface used to declare `id`, `distanceMeters` and
 * `durationSeconds` against a writer that produced `tripId`, `distanceMiles`
 * and `durationMinutes`, so every row rendered "NaN mi · NaN min" under an
 * undefined React key the moment a real trip landed. The writer now emits
 * metres and seconds and this reader matches it.
 */
interface RecentTrip {
  tripId: string;
  score: number;
  distanceMeters: number;
  durationSeconds: number;
  routeSummary?: string;
}

interface ScoreBreakdown {
  speedScore: number;
  brakingScore: number;
  accelerationScore: number;
  corneringScore: number;
  phoneUsageScore: number;
}

interface DashboardData {
  overallScore: number;
  totalTrips: number;
  totalMiles: number;
  /** Pence per month, from a real policy. Null when there is no policy. */
  premiumCents: number | null;
  /** The driver's share of the pool, 0-100, as the server computed it. */
  sharePercentage: number | null;
  scoreBreakdown: ScoreBreakdown;
  recentTrips: RecentTrip[];
}

interface PoolState {
  activeParticipants: number;
  averagePoolScore: number;
}

/**
 * The five factors, in the order and at the weights the scoring engine
 * actually uses. These were five hardcoded strings ("25%", "25%", "20%"...)
 * that happened to agree with SCORE_WEIGHTS. The marketing site shipped
 * transposed weights because someone retyped the same five numbers, so the
 * display now reads the algorithm rather than remembering it.
 */
const FACTORS: ReadonlyArray<{ key: keyof ScoreBreakdown; label: string; weight: number }> = [
  { key: 'speedScore', label: 'Speed', weight: SCORE_WEIGHTS.speed },
  { key: 'brakingScore', label: 'Braking', weight: SCORE_WEIGHTS.braking },
  { key: 'accelerationScore', label: 'Acceleration', weight: SCORE_WEIGHTS.acceleration },
  { key: 'corneringScore', label: 'Cornering', weight: SCORE_WEIGHTS.cornering },
  { key: 'phoneUsageScore', label: 'Phone', weight: SCORE_WEIGHTS.phoneUsage },
];

const EMPTY_BREAKDOWN: ScoreBreakdown = {
  speedScore: 0,
  brakingScore: 0,
  accelerationScore: 0,
  corneringScore: 0,
  phoneUsageScore: 100,
};

/**
 * ISO week period, e.g. "2026-W06". Mirrors getIsoWeekPeriod in
 * functions/src/utils/helpers.ts and the copy in app/leaderboard.tsx. The week
 * YEAR is the year of the week's Thursday, not the calendar year of the date;
 * around New Year those disagree and the two sides then read and write
 * different documents with no error anywhere. Change all of them or none.
 */
function isoWeekPeriod(now: Date): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export default function Dashboard() {
  // The dashboard IS the score. Viewing it is the loop step between
  // driving and comparing, so it needs its own event or the funnel jumps
  // straight from trip to leaderboard with nothing in between.
  useEffect(() => {
    track('score_viewed');
  }, []);

  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Real-time listener on user document
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .onSnapshot((doc: { data: () => Record<string, unknown> | undefined }) => {
        const userData = doc.data();
        if (!userData) return;

        const profile = (userData.drivingProfile ?? {}) as Partial<DashboardData> & {
          currentScore?: number;
          scoreBreakdown?: ScoreBreakdown;
        };
        const policy = (userData.activePolicy ?? null) as { premiumCents?: number } | null;
        const share = (userData.poolShare ?? null) as { sharePercentage?: number } | null;

        setData({
          // Wave 0 (0e): this read `profile.overallSafetyScore`, a field no
          // writer has ever written, so the headline number of a telematics
          // app was pinned at 0 in the red tier forever. `currentScore` is the
          // canonical field in packages/contracts and the one every writer
          // (provisionUser, trip triggers, damoovSync) actually sets.
          overallScore: profile.currentScore ?? 0,
          totalTrips: profile.totalTrips ?? 0,
          totalMiles: profile.totalMiles ?? 0,
          premiumCents: typeof policy?.premiumCents === 'number' ? policy.premiumCents : null,
          sharePercentage:
            typeof share?.sharePercentage === 'number' ? share.sharePercentage : null,
          scoreBreakdown: profile.scoreBreakdown ?? EMPTY_BREAKDOWN,
          recentTrips: (userData.recentTrips ?? []) as RecentTrip[],
        });
      });

    return unsubscribe;
  }, [user?.id]);

  // The pool singleton. Missing or empty is a real state, and it says so.
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('communityPool')
      .doc('current')
      .onSnapshot(
        (snap: {
          data: () => { activeParticipants?: number; averagePoolScore?: number } | undefined;
        }) => {
          const doc = snap.data();
          setPool(
            doc
              ? {
                  activeParticipants: doc.activeParticipants ?? 0,
                  averagePoolScore: doc.averagePoolScore ?? 0,
                }
              : null,
          );
        },
        () => setPool(null),
      );
    return unsubscribe;
  }, []);

  // The rank tile was a hardcoded placeholder. The weekly board is real now, so the
  // tile either carries a real standing or is not drawn at all.
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('leaderboard')
      .doc(`${isoWeekPeriod(new Date())}_weekly`)
      .onSnapshot(
        (snap: {
          data: () => { rankings?: Array<{ rank: number; userId: string }> } | undefined;
        }) => {
          const mine = snap.data()?.rankings?.find((r) => r.userId === user.id);
          setRank(mine ? mine.rank : null);
        },
        () => setRank(null),
      );
    return unsubscribe;
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Firestore listener auto-updates, just show the indicator briefly
    setTimeout(() => setRefreshing(false), 1000);
  };

  const score = data?.overallScore ?? 0;
  const premiumCents = data?.premiumCents ?? null;
  // Pence in, pence out. Pounds happen only at the point of drawing.
  const projectedCents =
    premiumCents != null && score > 0 ? projectedRefundCents(score, premiumCents) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0] ?? 'Driver'}</Text>
          <Text style={styles.subtitle}>Your driving dashboard</Text>
        </View>

        {/* 1. SCORE, on the canonical 270-degree gauge. */}
        <View style={styles.scoreCard}>
          <ScoreRing score={score} size="lg" />
          <Text style={styles.scoreCaption}>Safety score</Text>
        </View>

        {/* 2. CASHBACK. A projection where a premium exists, honest otherwise. */}
        <SurfaceCard padding="lg" style={styles.target}>
          <View style={styles.targetHead}>
            <Ionicons name="cash-outline" size={18} color={C.text.sec} />
            <Text style={styles.targetLabel}>Cashback</Text>
          </View>
          {projectedCents != null ? (
            <>
              <CountUp
                value={projectedCents / 100}
                decimals={2}
                prefix="£"
                style={styles.targetValue}
              />
              <Text style={styles.targetNote}>
                Projected from your score of {Math.round(score)} against your current premium.
                It moves with every trip and is settled at the end of the pool period.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.targetPending}>Not started</Text>
              <Text style={styles.targetNote}>
                Cashback is projected from your score against a live policy premium. There is
                no active policy on your account yet, so there is nothing to project from.
              </Text>
            </>
          )}
        </SurfaceCard>

        {/* 3. COMMUNITY POOL. Participation and share, never a pound figure. */}
        <SurfaceCard padding="lg" style={styles.target}>
          <View style={styles.targetHead}>
            <Ionicons name="people-outline" size={18} color={C.text.sec} />
            <Text style={styles.targetLabel}>Community pool</Text>
          </View>
          {pool && pool.activeParticipants > 0 ? (
            <>
              <View style={styles.poolRow}>
                <View style={styles.poolFigure}>
                  <CountUp value={pool.activeParticipants} style={styles.targetValue} />
                  <Text style={styles.poolFigureLabel}>drivers in the pool</Text>
                </View>
                <View style={styles.poolFigure}>
                  <Text style={styles.targetValue}>
                    {data?.sharePercentage != null
                      ? `${data.sharePercentage.toFixed(2)}%`
                      : 'None yet'}
                  </Text>
                  <Text style={styles.poolFigureLabel}>your share</Text>
                </View>
              </View>
              <Text style={styles.targetNote}>
                Your share is set by your weighted score against everyone else in the pool,
                which currently averages {pool.averagePoolScore.toFixed(1)}. Shares are stated
                as a percentage, not a sum, until the pool is funded.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.targetPending}>Opens at launch</Text>
              <Text style={styles.targetNote}>
                Contributions begin when the product goes live. Your score is being recorded
                now, and it is what will set your share of the pool.
              </Text>
            </>
          )}
        </SurfaceCard>

        {/* Supporting detail, below the three targets. */}
        <View style={styles.statsRow}>
          <StatCard label="Trips" value={String(data?.totalTrips ?? 0)} />
          <StatCard label="Miles" value={String(Math.round(data?.totalMiles ?? 0))} />
          {rank != null && <StatCard label="Rank" value={String(rank)} />}
        </View>

        <SurfaceCard padding="lg" style={styles.card}>
          <Text style={styles.cardTitle}>Score breakdown</Text>
          {FACTORS.map((factor) => (
            <ScoreBreakdownBar
              key={factor.key}
              label={factor.label}
              value={Math.round(data?.scoreBreakdown[factor.key] ?? EMPTY_BREAKDOWN[factor.key])}
              weight={factor.weight}
            />
          ))}
        </SurfaceCard>

        <SurfaceCard padding="lg" style={styles.card}>
          <Text style={styles.cardTitle}>Recent trips</Text>
          {(data?.recentTrips?.length ?? 0) === 0 ? (
            <Text style={styles.emptyText}>
              No trips yet. Your score appears once your first drive has been scored.
            </Text>
          ) : (
            data?.recentTrips.slice(0, 5).map((trip) => (
              <View key={trip.tripId} style={styles.tripRow}>
                <View>
                  <Text style={styles.tripRoute}>{trip.routeSummary || 'Trip'}</Text>
                  <Text style={styles.tripMeta}>
                    {(trip.distanceMeters / 1609.34).toFixed(1)} mi ·{' '}
                    {Math.round(trip.durationSeconds / 60)} min
                  </Text>
                </View>
                <Text style={[styles.tripScore, { color: scoreColor(trip.score) }]}>
                  {trip.score}
                </Text>
              </View>
            ))
          )}
        </SurfaceCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: S.md, paddingBottom: 100 },
  header: { marginTop: S.md, marginBottom: S.lg },
  greeting: { ...T.h1, color: C.text.hero },
  subtitle: { ...T.body, color: C.text.sec, marginTop: 2 },

  scoreCard: { alignItems: 'center', marginBottom: S.lg },
  scoreCaption: {
    ...T.label,
    color: C.text.sec,
    marginTop: S.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  target: { marginBottom: S.md },
  targetHead: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm },
  targetLabel: { ...T.label, color: C.text.sec, textTransform: 'uppercase', letterSpacing: 0.5 },
  targetValue: {
    fontFamily: F.monoSemiBold,
    fontSize: FS.xxl,
    color: C.text.hero,
    fontVariant: ['tabular-nums'],
  },
  targetPending: { ...T.h2, color: C.text.sec },
  targetNote: { ...T.caption, color: C.text.mut, lineHeight: 16, marginTop: S.sm },

  poolRow: { flexDirection: 'row', gap: S.lg },
  poolFigure: { flex: 1, minWidth: 0 },
  poolFigureLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: S.sm, marginBottom: S.md },

  card: { marginBottom: S.md },
  cardTitle: { ...T.h2, color: C.text.hero, marginBottom: S.md },

  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  tripRoute: { ...T.body, color: C.text.pri },
  tripMeta: { ...T.caption, color: C.text.sec, marginTop: 2 },
  tripScore: T.stat,

  emptyText: { ...T.body, color: C.text.mut, textAlign: 'center', paddingVertical: S.lg },
});

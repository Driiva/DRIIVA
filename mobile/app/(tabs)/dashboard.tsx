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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/lib/firebase';
import { periodIdFor } from '@/lib/isoWeek';
import { formatPounds } from '@/lib/money';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { C, T, S, scoreColor } from '@/components/ui/theme';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { StatCard } from '@/components/ui/StatCard';
import { ScoreBreakdownBar } from '@/components/ui/ScoreBreakdownBar';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { CountUp } from '@/components/ui/CountUp';
import { Enter, PressableCard, tick } from '@/components/ui/motion';
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
  /** When the last trip finished scoring. Null before the first one. */
  lastTripAt: Date | null;
  /** Null until a trip has actually been scored. Never a placeholder zero. */
  overallScore: number | null;
  totalTrips: number;
  totalMiles: number;
  /** Pence per month, from a real policy. Null when there is no policy. */
  premiumCents: number | null;
  /** The driver's share of the pool, 0-100, as the server computed it. */
  sharePercentage: number | null;
  /** Null until the server has written one. A zeroed breakdown reads as bad driving. */
  scoreBreakdown: ScoreBreakdown | null;
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

/**
 * The header line. It used to read "Your driving dashboard", which named the
 * screen the driver was already looking at. A date is worth more than a label:
 * it answers whether the score below is current, which is the only reason to
 * doubt it.
 */
function lastTripLabel(lastTripAt: Date | null): string {
  if (!lastTripAt) return 'No scored trips yet.';
  const days = Math.floor((Date.now() - lastTripAt.getTime()) / 86_400_000);
  if (days <= 0) return 'Last scored trip today.';
  if (days === 1) return 'Last scored trip yesterday.';
  if (days < 14) return `Last scored trip ${days} days ago.`;
  return `Last scored trip ${lastTripAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  })}.`;
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
          lastTripAt?: { toDate?: () => Date } | null;
        };
        const policy = (userData.activePolicy ?? null) as { premiumCents?: number } | null;
        const share = (userData.poolShare ?? null) as { sharePercentage?: number } | null;

        setData({
          // Wave 0 (0e): this read `profile.overallSafetyScore`, a field no
          // writer has ever written, so the headline number of a telematics
          // app was pinned at 0 in the red tier forever. `currentScore` is the
          // canonical field in packages/contracts and the one every writer
          // (provisionUser, trip triggers, damoovSync) actually sets.
          //
          // Null when the field is absent, not zero. A zero draws the gauge in
          // the red tier, so a driver who has simply not driven yet would be
          // shown the instrument of somebody who drives badly. Empty is a
          // state; a plausible zero is the gauge lying on the app's behalf.
          overallScore: typeof profile.currentScore === 'number' ? profile.currentScore : null,
          totalTrips: profile.totalTrips ?? 0,
          totalMiles: profile.totalMiles ?? 0,
          lastTripAt: profile.lastTripAt?.toDate ? profile.lastTripAt.toDate() : null,
          premiumCents: typeof policy?.premiumCents === 'number' ? policy.premiumCents : null,
          sharePercentage:
            typeof share?.sharePercentage === 'number' ? share.sharePercentage : null,
          scoreBreakdown: profile.scoreBreakdown ?? null,
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
      .doc(periodIdFor('weekly'))
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

  const router = useRouter();

  const onRefresh = () => {
    // Every panel here is a live Firestore subscription and is already
    // current, so the gesture acknowledges itself and stops. The haptic is the
    // acknowledgement: without it a pull that fetches nothing feels ignored.
    tick('select');
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  const score = data?.overallScore ?? null;
  const premiumCents = data?.premiumCents ?? null;
  const breakdown = data?.scoreBreakdown ?? null;
  // Pence in, pence out. Pounds happen only at the point of drawing, through
  // lib/money.ts, which is why CountUp counts the PENCE figure and formats it
  // rather than being handed a float.
  const projectedCents =
    premiumCents != null && score != null && score > 0
      ? projectedRefundCents(score, premiumCents)
      : null;

  const recent = data?.recentTrips ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Enter index={0} count={7}>
          <View style={styles.header}>
            <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0] ?? 'Driver'}</Text>
            <Text style={styles.subtitle}>{lastTripLabel(data?.lastTripAt ?? null)}</Text>
          </View>
        </Enter>

        {/* 1. SCORE, on the canonical 270-degree gauge. */}
        <Enter index={1} count={7}>
          <View style={styles.scoreCard}>
            <ScoreRing score={score} size={172} />
            <Text style={styles.scoreCaption}>Safety score</Text>
          </View>
        </Enter>

        {/* 2. CASHBACK. A projection where a premium exists, honest otherwise. */}
        <Enter index={2} count={7}>
          <SurfaceCard padding="lg" style={styles.target}>
            <View style={styles.targetHead}>
              <Ionicons name="cash-outline" size={18} color={C.text.sec} />
              <Text style={styles.targetLabel}>Cashback</Text>
            </View>
            {projectedCents != null && score != null ? (
              <>
                <CountUp
                  value={projectedCents}
                  format={(pence) => formatPounds(pence)}
                  style={styles.targetValue}
                />
                <Text style={styles.targetNote}>
                  Projected from your score of {Math.round(score)} against your current premium,
                  capped at 15%. It moves with every trip and is settled at the end of the pool
                  period.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.targetPending}>Not started</Text>
                <Text style={styles.targetNote}>
                  Cashback is projected from your score against a live policy premium, up to
                  15%. There is no active policy on your account yet, so there is nothing to
                  project from.
                </Text>
              </>
            )}
          </SurfaceCard>
        </Enter>

        {/* 3. COMMUNITY POOL. Participation and share, never a pound figure. */}
        <Enter index={3} count={7}>
          <PressableCard
            onPress={() => router.push('/(tabs)/community')}
            haptic="press"
            accessibilityLabel="Open Community"
          >
            <SurfaceCard padding="lg" style={styles.target}>
              <View style={styles.targetHead}>
                <Ionicons name="people-outline" size={18} color={C.text.sec} />
                <Text style={styles.targetLabel}>Community pool</Text>
                <View style={styles.flex} />
                <Ionicons name="chevron-forward" size={16} color={C.text.mut} />
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
                    which currently averages {pool.averagePoolScore.toFixed(1)}. Shares are
                    stated as a percentage, not a sum, until the pool is funded.
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
          </PressableCard>
        </Enter>

        {/* Supporting detail, below the three targets. */}
        <Enter index={4} count={7}>
          <View style={styles.statsRow}>
            <StatCard label="Trips" value={String(data?.totalTrips ?? 0)} />
            <StatCard label="Miles" value={String(Math.round(data?.totalMiles ?? 0))} />
            {rank != null && (
              <PressableCard
                onPress={() => router.push('/leaderboard')}
                haptic="select"
                outerStyle={styles.flex}
                accessibilityLabel={`Rank ${rank}. Open the board.`}
              >
                <StatCard label="Rank" value={String(rank)} />
              </PressableCard>
            )}
          </View>
        </Enter>

        <Enter index={5} count={7}>
          <SurfaceCard padding="lg" style={styles.card}>
            <Text style={styles.cardTitle}>Score breakdown</Text>
            {breakdown ? (
              <>
                {FACTORS.map((factor) => (
                  <ScoreBreakdownBar
                    key={factor.key}
                    label={factor.label}
                    value={Math.round(breakdown[factor.key] ?? 0)}
                    weight={factor.weight}
                  />
                ))}
                <Text style={styles.breakdownNote}>
                  Each factor is scored out of 100, then weighted into your overall score. Open
                  a trip to see the events behind it.
                </Text>
              </>
            ) : (
              <Text style={styles.emptyText}>
                Nothing to break down yet. The five factors appear once your first trip has
                been scored.
              </Text>
            )}
          </SurfaceCard>
        </Enter>

        <Enter index={6} count={7}>
          <SurfaceCard padding="lg" style={styles.card}>
            <Text style={styles.cardTitle}>Recent trips</Text>
            {recent.length === 0 ? (
              <Text style={styles.emptyText}>
                No trips yet. Your score appears once your first drive has been scored.
              </Text>
            ) : (
              recent.slice(0, 5).map((trip) => (
                <PressableCard
                  key={trip.tripId}
                  onPress={() => router.push(`/trips/${trip.tripId}`)}
                  haptic="select"
                  style={styles.tripRow}
                  accessibilityLabel={`${trip.routeSummary || 'Trip'}, scored ${trip.score}`}
                >
                  <View style={styles.flex}>
                    <Text style={styles.tripRoute}>{trip.routeSummary || 'Trip'}</Text>
                    <Text style={styles.tripMeta}>
                      {(trip.distanceMeters / 1609.34).toFixed(1)} mi ·{' '}
                      {Math.round(trip.durationSeconds / 60)} min
                    </Text>
                  </View>
                  <Text style={[styles.tripScore, { color: scoreColor(trip.score) }]}>
                    {trip.score}
                  </Text>
                </PressableCard>
              ))
            )}
          </SurfaceCard>
        </Enter>
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
  /**
   * Pulled UP into the gauge, not stacked under it.
   *
   * The gauge is a 270 degree arc that opens at the bottom, and the caption
   * belongs in that opening: it is the label on the dial, not a line of body
   * copy that happens to follow it. Laid out normally it sits below the full
   * square bounding box of the ring, which leaves the better part of an inch
   * of nothing between the arc and its own label and makes the anchor of the
   * screen look like it is floating.
   */
  scoreCaption: {
    ...T.eyebrow,
    color: C.text.sec,
    marginTop: -34,
  },

  flex: { flex: 1 },

  target: { marginBottom: S.md },
  targetHead: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm },
  targetLabel: { ...T.eyebrow, color: C.text.sec },
  targetValue: {
    ...T.statLg,
    color: C.text.hero,
  },
  targetPending: { ...T.h2, color: C.text.sec },
  targetNote: { ...T.caption, color: C.text.mut, marginTop: S.sm },

  poolRow: { flexDirection: 'row', gap: S.lg },
  poolFigure: { flex: 1, minWidth: 0 },
  poolFigureLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: S.sm, marginBottom: S.md },

  card: { marginBottom: S.md },
  cardTitle: { ...T.h2, color: C.text.hero, marginBottom: S.md },
  breakdownNote: { ...T.caption, color: C.text.mut, marginTop: S.sm },

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

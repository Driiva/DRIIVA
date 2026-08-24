/**
 * COMMUNITY
 * =========
 * The social half of the product, as one screen instead of three. Four
 * sections, in the order a driver cares about them:
 *
 *   1. Pool      what everyone's driving adds up to, and where you sit on it
 *   2. Standing  this week's board, Everyone or Your circle
 *   3. Your circle  who you have brought in, and how to bring in one more
 *   4. Earned    recognition, as a strip, with the full screen one tap away
 *
 * WHAT THIS SCREEN WILL NOT SHOW
 * A pound figure against the pool. The money model (D6) is undefined and
 * addPoolContribution still has no callers, so a balance here would be a
 * number nobody has committed to, printed beside an insurance product that is
 * pending FCA authorisation. Participants, the average score and the driver's
 * share percentage are all computed server-side and all real, and they are the
 * whole of what gets rendered.
 *
 * EVERY EMPTY STATE IS A STATE
 * No pool, no board, no circle and no badges are four different situations and
 * they say four different things. None of them invents a number to fill the
 * space. "Not scored" and "Opens at launch" are answers; a plausible zero is
 * not.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { periodIdFor } from '@/lib/isoWeek';
import { C, T, S, R, FS, LH, TR, scoreColor, alpha, RGB } from '@/components/ui/theme';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { CountUp } from '@/components/ui/CountUp';
import { PoolMeter } from '@/components/ui/PoolMeter';
import { Enter, PressableCard, tick } from '@/components/ui/motion';
import { buildAchievementViews, type AchievementView } from '@driiva/contracts';

type Scope = 'everyone' | 'circle';

interface Ranking {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  totalMiles: number;
  totalTrips: number;
  change: number;
}

interface Standing {
  currentScore: number | null;
  sharePercentage: number | null;
  totalTrips: number;
  totalMiles: number;
  streakDays: number;
}

interface PoolState {
  activeParticipants: number;
  averagePoolScore: number;
}

const EMPTY_STANDING: Standing = {
  currentScore: null,
  sharePercentage: null,
  totalTrips: 0,
  totalMiles: 0,
  streakDays: 0,
};

/** Icons for the shared achievement catalogue. Ionicons, never emoji. */
const ICONS: Record<string, string> = {
  Car: 'car-sport-outline',
  Shield: 'shield-checkmark-outline',
  Target: 'locate-outline',
  Star: 'star-outline',
  Route: 'map-outline',
  Flame: 'flame-outline',
  Moon: 'moon-outline',
  Award: 'ribbon-outline',
};

/** Same masking rule as web and the full board, so nobody is named two ways. */
function anonymise(displayName: string): string {
  if (!displayName) return 'Driver';
  const shown = Math.min(5, Math.ceil(displayName.length * 0.4));
  const hidden = Math.min(displayName.length - shown, 3);
  return displayName.slice(0, shown) + '*'.repeat(Math.max(hidden, 0));
}

export default function Community() {
  const { user } = useAuth();
  const router = useRouter();

  const [pool, setPool] = useState<PoolState | null>(null);
  const [me, setMe] = useState<Standing>(EMPTY_STANDING);
  const [rankings, setRankings] = useState<Ranking[] | null>(null);
  const [circle, setCircle] = useState<string[] | null>(null);
  const [badges, setBadges] = useState<AchievementView[]>([]);
  const [scope, setScope] = useState<Scope>('everyone');
  const [refreshing, setRefreshing] = useState(false);

  // Community is its own step in the loop: driving, then comparing, then
  // bringing someone in. Without an event of its own the funnel jumps from the
  // score straight to an invite and the middle is invisible.
  useEffect(() => {
    track('community_viewed');
  }, []);

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

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .onSnapshot((snap: { data: () => Record<string, unknown> | undefined }) => {
        const data = snap.data();
        if (!data) return;
        const profile = (data.drivingProfile ?? {}) as {
          currentScore?: number;
          totalTrips?: number;
          totalMiles?: number;
          streakDays?: number;
        };
        const share = (data.poolShare ?? null) as { sharePercentage?: number } | null;
        setMe({
          // Null, not zero. A driver with no scored trip has no score, and a
          // zero would render in the red tier as though they drove badly.
          currentScore: typeof profile.currentScore === 'number' ? profile.currentScore : null,
          sharePercentage:
            typeof share?.sharePercentage === 'number' ? share.sharePercentage : null,
          totalTrips: profile.totalTrips ?? 0,
          totalMiles: profile.totalMiles ?? 0,
          streakDays: profile.streakDays ?? 0,
        });
      });
    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('leaderboard')
      .doc(periodIdFor('weekly'))
      .onSnapshot(
        (snap: { data: () => { rankings?: Ranking[] } | undefined }) => {
          setRankings(snap.data()?.rankings ?? []);
        },
        () => setRankings([]),
      );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('friendships')
      .where('users', 'array-contains', user.id)
      .onSnapshot(
        (snap: { docs: Array<{ data: () => { users?: string[] } }> }) => {
          const uids: string[] = [];
          snap.docs.forEach((d) => {
            (d.data().users ?? []).filter((u) => u !== user.id).forEach((u) => uids.push(u));
          });
          setCircle(uids);
        },
        () => setCircle([]),
      );
    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .collection('achievements')
      .onSnapshot(
        (snap: {
          docs: Array<{ id: string; data: () => { unlockedAt?: { toDate?: () => Date } } }>;
        }) => {
          const unlocked = snap.docs.map((d) => ({
            achievementId: d.id,
            unlockedAt: d.data().unlockedAt?.toDate?.() ?? null,
          }));
          setBadges(
            buildAchievementViews(unlocked, {
              totalTrips: me.totalTrips,
              totalMiles: me.totalMiles,
              streakDays: me.streakDays,
              currentScore: me.currentScore ?? 0,
            }),
          );
        },
        () => setBadges([]),
      );
    return unsubscribe;
  }, [user?.id, me.totalTrips, me.totalMiles, me.streakDays, me.currentScore]);

  const circleSet = useMemo(() => new Set(circle ?? []), [circle]);

  // The circle board is the real board filtered, so a person's rank here is
  // their standing against everyone, not a rank invented within the group.
  const visible = useMemo(() => {
    const all = rankings ?? [];
    if (scope === 'everyone') return all;
    return all.filter((r) => r.userId === user?.id || circleSet.has(r.userId));
  }, [scope, rankings, circleSet, user?.id]);

  const top = visible.slice(0, 5);
  const mine = (rankings ?? []).find((r) => r.userId === user?.id) ?? null;
  const minePinned = mine != null && !top.some((r) => r.userId === user?.id);

  const unlocked = badges.filter((b) => b.unlocked);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              // Every panel here is a live subscription and is already current.
              // The gesture acknowledges itself and stops, rather than
              // pretending to fetch.
              tick('select');
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 700);
            }}
            tintColor={C.primary}
          />
        }
      >
        <Enter index={0} count={5}>
          <View style={styles.header}>
            <Text style={styles.title}>Community</Text>
            <Text style={styles.subtitle}>
              Everyone's driving sets the community score. Your share is projected from your
              standing.
            </Text>
          </View>
        </Enter>

        {/* ─── 1. POOL ─────────────────────────────────────────────────── */}
        <Enter index={1} count={5}>
          <SurfaceCard padding="lg" style={styles.card}>
            <SectionHead icon="people-outline" label="Pool" />
            {pool && pool.activeParticipants > 0 ? (
              <>
                <View style={styles.poolHead}>
                  <CountUp
                    value={pool.averagePoolScore}
                    decimals={1}
                    style={[styles.poolScore, { color: scoreColor(pool.averagePoolScore) }]}
                  />
                  <Text style={styles.poolScoreCaption}>community score</Text>
                </View>

                <PoolMeter poolScore={pool.averagePoolScore} yourScore={me.currentScore} />

                <View style={styles.poolFigures}>
                  <Figure
                    value={<CountUp value={pool.activeParticipants} style={styles.figureValue} />}
                    label="drivers in the pool"
                  />
                  <Figure
                    value={
                      <Text style={styles.figureValue}>
                        {me.sharePercentage != null
                          ? `${me.sharePercentage.toFixed(2)}%`
                          : 'Not set'}
                      </Text>
                    }
                    label="your share"
                  />
                </View>

                <Text style={styles.note}>
                  Shares are stated as a percentage of the pool, not a sum, until the pool is
                  funded.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.pending}>Opens at launch</Text>
                <Text style={styles.note}>
                  Contributions begin when the product goes live. Your score is being recorded
                  now, and it is what will set your share.
                </Text>
              </>
            )}
          </SurfaceCard>
        </Enter>

        {/* ─── 2. STANDING ─────────────────────────────────────────────── */}
        <Enter index={2} count={5}>
          <SurfaceCard padding="lg" style={styles.card}>
            <SectionHead icon="podium-outline" label="Standing" />

            <View style={styles.segmented}>
              {(
                [
                  { id: 'everyone', label: 'Everyone' },
                  { id: 'circle', label: 'Your circle' },
                ] as const
              ).map((option) => {
                const active = option.id === scope;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      tick('select');
                      setScope(option.id);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.segment, active && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {rankings === null ? (
              <Text style={styles.note}>Loading this week's board.</Text>
            ) : top.length === 0 ? (
              <Text style={styles.note}>
                {scope === 'circle'
                  ? 'Nobody in your circle has a scored trip this week yet.'
                  : 'The board fills as drivers complete scored trips. Yours appears once your first trip of the week lands.'}
              </Text>
            ) : (
              <View style={styles.rows}>
                {top.map((entry, i) => (
                  <Enter key={entry.userId} index={i} count={top.length} delay={80}>
                    <StandingRow entry={entry} isMe={entry.userId === user?.id} />
                  </Enter>
                ))}
                {minePinned && mine && (
                  <>
                    <View style={styles.pinDivider} />
                    <StandingRow entry={mine} isMe />
                  </>
                )}
              </View>
            )}

            <PressableCard
              onPress={() => router.push('/leaderboard')}
              haptic="select"
              style={styles.linkRow}
              accessibilityLabel="Open the full board"
            >
              <Text style={styles.linkText}>Full board</Text>
              <Ionicons name="chevron-forward" size={16} color={C.primary} />
            </PressableCard>
          </SurfaceCard>
        </Enter>

        {/* ─── 3. YOUR CIRCLE ──────────────────────────────────────────── */}
        <Enter index={3} count={5}>
          <SurfaceCard padding="lg" style={styles.card}>
            <SectionHead icon="person-add-outline" label="Your circle" />

            {circle === null ? (
              <Text style={styles.note}>Loading your circle.</Text>
            ) : circle.length === 0 ? (
              <Text style={styles.note}>
                Nobody yet. A board of strangers is a scoreboard. A board of people you know is
                a reason to come back.
              </Text>
            ) : (
              <View style={styles.rows}>
                {circle.map((uid, i) => {
                  const entry = (rankings ?? []).find((r) => r.userId === uid);
                  return (
                    <Enter key={uid} index={i} count={circle.length} delay={80}>
                      <View style={styles.circleRow}>
                        <View style={styles.circleAvatar}>
                          <Text style={styles.circleInitial}>
                            {(entry?.displayName ?? 'D')[0].toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.circleName} numberOfLines={1}>
                          {entry ? anonymise(entry.displayName) : 'Driver'}
                        </Text>
                        <Text
                          style={[
                            styles.circleScore,
                            { color: entry ? scoreColor(entry.score) : C.text.mut },
                          ]}
                        >
                          {entry ? Math.round(entry.score) : 'No trips'}
                        </Text>
                      </View>
                    </Enter>
                  );
                })}
              </View>
            )}

            <PressableCard
              onPress={() => router.push('/invite')}
              haptic="press"
              style={styles.linkRow}
              accessibilityLabel="Bring someone in"
            >
              <Text style={styles.linkText}>Bring someone in</Text>
              <Ionicons name="chevron-forward" size={16} color={C.primary} />
            </PressableCard>
          </SurfaceCard>
        </Enter>

        {/* ─── 4. EARNED ───────────────────────────────────────────────── */}
        <Enter index={4} count={5}>
          <SurfaceCard padding="lg" style={styles.card}>
            <View style={styles.earnedHead}>
              <SectionHead icon="ribbon-outline" label="Earned" />
              {badges.length > 0 && (
                <Text style={styles.earnedCount}>
                  {unlocked.length} of {badges.length}
                </Text>
              )}
            </View>

            {badges.length === 0 ? (
              <Text style={styles.note}>
                Recognition appears here once your first trip has been scored. Badges carry no
                cash value.
              </Text>
            ) : (
              <View style={styles.badgeGrid}>
                {badges.map((badge) => (
                  <View
                    key={badge.id}
                    style={[styles.badge, badge.unlocked && styles.badgeUnlocked]}
                    accessibilityLabel={`${badge.name}, ${badge.unlocked ? 'earned' : 'not yet earned'}`}
                  >
                    <Ionicons
                      name={
                        (badge.unlocked
                          ? (ICONS[badge.icon] ?? 'ribbon-outline')
                          : 'lock-closed-outline') as never
                      }
                      size={18}
                      color={badge.unlocked ? C.primary : C.text.mut}
                    />
                    <Text
                      style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]}
                      numberOfLines={2}
                    >
                      {badge.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <PressableCard
              onPress={() => router.push('/(tabs)/rewards')}
              haptic="select"
              style={styles.linkRow}
              accessibilityLabel="Open all recognition"
            >
              <Text style={styles.linkText}>All recognition</Text>
              <Ionicons name="chevron-forward" size={16} color={C.primary} />
            </PressableCard>
          </SurfaceCard>
        </Enter>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHead({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionHead}>
      <Ionicons name={icon as never} size={16} color={C.text.sec} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function Figure({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <View style={styles.figure}>
      {value}
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

function StandingRow({ entry, isMe }: { entry: Ranking; isMe: boolean }) {
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <Text style={[styles.rank, isMe && styles.rankMe]}>{entry.rank}</Text>
      <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
        {isMe ? 'You' : anonymise(entry.displayName)}
      </Text>
      <Text style={[styles.rowScore, { color: scoreColor(entry.score) }]}>
        {Math.round(entry.score)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: S.md, paddingBottom: 100 },

  header: { marginTop: S.md, marginBottom: S.lg },
  title: { ...T.h1, color: C.text.hero },
  subtitle: { ...T.bodySm, color: C.text.sec, marginTop: S.xs },

  card: { marginBottom: S.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: S.sm },
  sectionLabel: { ...T.eyebrow, color: C.text.sec },

  poolHead: { alignItems: 'center', marginBottom: S.md },
  poolScore: { ...T.hero },
  poolScoreCaption: { ...T.eyebrow, color: C.text.mut, marginTop: -2 },

  poolFigures: { flexDirection: 'row', gap: S.lg, marginTop: S.md },
  figure: { flex: 1, minWidth: 0 },
  figureValue: { ...T.stat, color: C.text.hero },
  figureLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },

  pending: { ...T.h2, color: C.text.sec },
  note: { ...T.caption, color: C.text.mut, marginTop: S.sm },

  segmented: {
    flexDirection: 'row',
    backgroundColor: C.surface2,
    borderRadius: R.badge,
    padding: 3,
    marginBottom: S.md,
  },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: 'center' },
  segmentActive: { backgroundColor: C.primary },
  segmentLabel: { ...T.label, color: C.text.sec },
  segmentLabelActive: { color: C.text.hero },

  rows: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingVertical: S.sm,
    paddingHorizontal: S.sm,
    borderRadius: R.badge,
    backgroundColor: C.surface2,
  },
  rowMe: { backgroundColor: alpha(RGB.primary, 0.16) },
  rank: { ...T.numberSm, color: C.text.mut, width: 22 },
  rankMe: { color: C.primaryLight },
  name: { ...T.bodySm, color: C.text.pri, flex: 1, minWidth: 0 },
  nameMe: { color: C.text.hero },
  rowScore: { ...T.number },
  pinDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: S.xs,
  },

  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingVertical: 6,
  },
  circleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInitial: { ...T.numberSm, color: C.text.sec },
  circleName: { ...T.bodySm, color: C.text.pri, flex: 1, minWidth: 0 },
  circleScore: { ...T.numberSm },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: S.md,
    paddingTop: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  linkText: { ...T.label, color: C.primary },

  earnedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earnedCount: { ...T.numberSm, color: C.text.sec, marginBottom: S.sm },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  badge: {
    width: '30%',
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: S.sm,
    paddingHorizontal: 6,
    borderRadius: R.badge,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    opacity: 0.6,
  },
  badgeUnlocked: { opacity: 1, borderColor: alpha(RGB.primary, 0.3) },
  badgeName: {
    ...T.caption,
    fontSize: FS.xs,
    lineHeight: LH.xs,
    letterSpacing: TR.sm,
    color: C.text.pri,
    textAlign: 'center',
  },
  badgeNameLocked: { color: C.text.mut },
});

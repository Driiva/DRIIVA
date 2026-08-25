/**
 * Leaderboard - Driiva Mobile
 *
 * The full board behind the Community tab's Standing section. Reads the real
 * `leaderboard/{period}_{periodType}` document the scheduled function
 * recomputes every 15 minutes, and filters it against the viewer's real
 * friendships for the "Your circle" scope.
 *
 * The period ID derivation moved to lib/isoWeek.ts. It was hand-copied here
 * and into the dashboard, and the Community screen would have been a third
 * copy. The week YEAR is the year of the week's Thursday, NOT the calendar
 * year: around New Year those disagree and the two sides then read and write
 * different documents, which empties the board with no error anywhere. See
 * tests/unit/week-period-convention.test.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { periodIdFor, type PeriodType } from '@/lib/isoWeek';
import { C, T, S, R, FS, LH, TR } from '@/components/ui/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';

type Scope = 'global' | 'circle';

interface Ranking {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  totalMiles: number;
  totalTrips: number;
  change: number;
}

/** Same masking rule as web, so one person is not named two different ways. */
function anonymise(displayName: string): string {
  if (!displayName) return 'Driver';
  const shown = Math.min(5, Math.ceil(displayName.length * 0.4));
  const hidden = Math.min(displayName.length - shown, 3);
  return displayName.slice(0, shown) + '*'.repeat(Math.max(hidden, 0));
}

const PERIODS: ReadonlyArray<{ id: PeriodType; label: string }> = [
  { id: 'weekly', label: 'Week' },
  { id: 'monthly', label: 'Month' },
  { id: 'all_time', label: 'All time' },
];

/**
 * "Your circle" replaced "Friends" across the app: the product noun for the
 * people a driver brought in. The scope ID moved with the label rather than
 * being left as 'friends', because an identifier that disagrees with every
 * surface it describes is the next person's wrong assumption.
 */
const SCOPES: ReadonlyArray<{ id: Scope; label: string }> = [
  { id: 'global', label: 'Everyone' },
  { id: 'circle', label: 'Your circle' },
];

function Segmented<Id extends string>({
  options, value, onChange,
}: {
  options: ReadonlyArray<{ id: Id; label: string }>;
  value: Id;
  onChange: (id: Id) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
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
  );
}

/** Direction is an icon as well as a colour, for readers who cannot separate the hues. */
function Change({ change }: { change: number }) {
  const name = change > 0 ? 'chevron-up' : change < 0 ? 'chevron-down' : 'remove';
  const colour = change > 0 ? C.success : change < 0 ? C.text.sec : C.text.mut;
  const label = change > 0 ? `up ${change}` : change < 0 ? `down ${Math.abs(change)}` : 'no change';
  return (
    <View style={styles.change} accessibilityLabel={label}>
      <Ionicons name={name as never} size={14} color={colour} />
      <Text style={[styles.changeText, { color: colour }]}>
        {change === 0 ? '0' : Math.abs(change)}
      </Text>
    </View>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [periodType, setPeriodType] = useState<PeriodType>('weekly');
  const [scope, setScope] = useState<Scope>('global');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [circleUids, setCircleUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Records which board the driver actually looks at. Scope and period are the
  // two things that decide whether the board is worth returning to, so the
  // retention question cannot be answered without them.
  useEffect(() => {
    track('leaderboard_viewed', { scope, period: periodType });
  }, [scope, periodType]);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = firestore()
      .collection('leaderboard')
      .doc(periodIdFor(periodType))
      .onSnapshot(
        // firestore is loosely typed in lib/firebase (it swaps a mock in Expo
        // Go), so the snapshot shape is annotated here rather than inferred.
        (snap: { data: () => { rankings?: Ranking[] } | undefined }) => {
          const data = snap.data();
          setRankings((data?.rankings as Ranking[]) ?? []);
          setLoading(false);
        },
        () => setLoading(false),
      );
    return unsubscribe;
  }, [periodType]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('friendships')
      .where('users', 'array-contains', user.id)
      .onSnapshot(
        (snap: { docs: Array<{ data: () => { users?: string[] } }> }) => {
          const uids = new Set<string>();
          snap.docs.forEach((d: { data: () => { users?: string[] } }) => {
            const users = d.data().users ?? [];
            users.filter((u) => u !== user.id).forEach((u) => uids.add(u));
          });
          setCircleUids(uids);
        },
        () => setCircleUids(new Set()),
      );
    return unsubscribe;
  }, [user?.id]);

  // The circle board is the full board filtered, so a person's rank here is
  // their real standing against everyone, not a rank invented within a group.
  const visible = useMemo(() => {
    if (scope === 'global') return rankings;
    return rankings.filter((r) => r.userId === user?.id || circleUids.has(r.userId));
  }, [scope, rankings, circleUids, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Leaderboard" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        <Segmented options={SCOPES} value={scope} onChange={setScope} />
        <Segmented options={PERIODS} value={periodType} onChange={setPeriodType} />

        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : scope === 'circle' && circleUids.size === 0 ? (
          <EmptyState
            icon="person-add-outline"
            title="Your circle is empty"
            subtitle="Share your code with someone and they appear here, on the same board as everyone else."
            action={{ label: 'Bring someone in', onPress: () => router.push('/invite') }}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="podium-outline"
            title={scope === 'circle' ? 'Nobody here this period' : 'No rankings yet'}
            subtitle={
              scope === 'circle'
                ? 'Your circle appears once they complete a scored trip in this period.'
                : 'The board fills as drivers complete scored trips. Yours appears once your first trip of the period lands.'
            }
          />
        ) : (
          <View style={styles.list}>
            {visible.map((entry) => {
              const isMe = entry.userId === user?.id;
              return (
                <View
                  key={`${entry.rank}-${entry.userId}`}
                  style={[styles.row, isMe && styles.rowMe]}
                >
                  <View style={[styles.rank, isMe && styles.rankMe]}>
                    <Text style={[styles.rankText, isMe && styles.rankTextMe]}>{entry.rank}</Text>
                  </View>

                  <View style={styles.who}>
                    <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
                      {isMe ? 'You' : anonymise(entry.displayName)}
                    </Text>
                    <Text style={styles.meta}>
                      {entry.totalTrips} trips · {Math.round(entry.totalMiles)} mi
                    </Text>
                  </View>

                  <Text style={styles.score}>{Math.round(entry.score)}</Text>
                  <Change change={entry.change ?? 0} />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: S.md, paddingBottom: S.xxl },
  centre: { paddingVertical: S.xxl, alignItems: 'center' },

  segmented: {
    flexDirection: 'row',
    backgroundColor: C.surface1,
    borderRadius: R.card,
    padding: 4,
    marginBottom: S.md,
  },
  segment: { flex: 1, paddingVertical: S.sm, borderRadius: R.badge, alignItems: 'center' },
  segmentActive: { backgroundColor: C.primary },
  segmentLabel: { ...T.label, color: C.text.sec },
  segmentLabelActive: { color: C.text.hero },

  list: { gap: S.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    gap: S.sm,
  },
  rowMe: { borderColor: C.primary, backgroundColor: C.surface2 },

  rank: {
    width: 32,
    height: 32,
    borderRadius: R.badge,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankMe: { backgroundColor: C.primary },
  rankText: { ...T.number, color: C.text.sec },
  rankTextMe: { color: C.text.hero },

  who: { flex: 1, minWidth: 0 },
  name: { ...T.h2, color: C.text.pri },
  nameMe: { color: C.primary },
  meta: { ...T.caption, color: C.text.sec },

  // T.stat is xl; dropping the size to lg has to bring lg's leading and
  // tracking with it, or the row keeps xl's 28px leading under 18px type.
  score: { ...T.stat, fontSize: FS.lg, lineHeight: LH.lg, letterSpacing: TR.lg, color: C.text.hero },
  change: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 44, justifyContent: 'flex-end' },
  changeText: { ...T.caption, fontVariant: ['tabular-nums'] },
});

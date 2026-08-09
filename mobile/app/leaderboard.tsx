/**
 * Leaderboard - Driiva Mobile
 *
 * Reads the real `leaderboard/{period}_{periodType}` document the scheduled
 * function recomputes every 15 minutes, and filters it against the viewer's
 * real friendships for the friends tab.
 *
 * The period ID must be derived exactly the way the function writes it: the
 * ISO week-YEAR, which is the year of the week's Thursday and NOT the calendar
 * year of the date. Around New Year those disagree, and the two sides then
 * read and write different documents, which empties the board with no error
 * anywhere. See tests/unit/week-period-convention.test.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R } from '@/components/ui/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';

type PeriodType = 'weekly' | 'monthly' | 'all_time';
type Scope = 'global' | 'friends';

interface Ranking {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  totalMiles: number;
  totalTrips: number;
  change: number;
}

/**
 * ISO week period, e.g. "2026-W06". Mirrors getIsoWeekPeriod in
 * functions/src/utils/helpers.ts and getCurrentWeekPeriod on web. Change all
 * three or none.
 */
function isoWeekPeriod(now: Date): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function periodIdFor(type: PeriodType): string {
  const now = new Date();
  if (type === 'weekly') return `${isoWeekPeriod(now)}_weekly`;
  if (type === 'monthly') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}_monthly`;
  }
  return 'all_time_all_time';
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

const SCOPES: ReadonlyArray<{ id: Scope; label: string }> = [
  { id: 'global', label: 'Global' },
  { id: 'friends', label: 'Friends' },
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
  const [periodType, setPeriodType] = useState<PeriodType>('weekly');
  const [scope, setScope] = useState<Scope>('global');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [friendUids, setFriendUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          setFriendUids(uids);
        },
        () => setFriendUids(new Set()),
      );
    return unsubscribe;
  }, [user?.id]);

  // The friends board is the global board filtered, so a friend's rank is
  // their real standing overall.
  const visible = useMemo(() => {
    if (scope === 'global') return rankings;
    return rankings.filter((r) => r.userId === user?.id || friendUids.has(r.userId));
  }, [scope, rankings, friendUids, user?.id]);

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
        ) : scope === 'friends' && friendUids.size === 0 ? (
          <EmptyState
            icon="person-add-outline"
            title="No friends yet"
            subtitle="Invite someone from the web app and they will appear here, on the same board as everyone else."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="podium-outline"
            title={scope === 'friends' ? 'No friends on this board yet' : 'No rankings yet'}
            subtitle={
              scope === 'friends'
                ? 'Your friends appear once they complete a scored trip in this period.'
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

  score: { ...T.stat, fontSize: 18, color: C.text.hero },
  change: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 44, justifyContent: 'flex-end' },
  changeText: { ...T.caption, fontVariant: ['tabular-nums'] },
});

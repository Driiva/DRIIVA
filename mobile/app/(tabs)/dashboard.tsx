/**
 * Dashboard — Driiva Mobile
 * The main screen users see after login.
 * Shows: safety score ring, recent trips, quick stats, community pool.
 */
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, F, FS, S, R, scoreColor } from '@/components/ui/theme';

const { width } = Dimensions.get('window');

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

interface DashboardData {
  overallScore: number;
  totalTrips: number;
  totalMiles: number;
  scoreBreakdown: {
    speedScore: number;
    brakingScore: number;
    accelerationScore: number;
    corneringScore: number;
    phoneUsageScore: number;
  };
  recentTrips: RecentTrip[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Real-time listener on user document
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .onSnapshot((doc) => {
        const userData = doc.data();
        if (!userData) return;

        const profile = userData.drivingProfile || {};
        setData({
          // Wave 0 (0e): this read `profile.overallSafetyScore`, a field no
          // writer has ever written, so the headline number of a telematics
          // app was pinned at 0 in the red tier forever. `currentScore` is the
          // canonical field in packages/contracts and the one every writer
          // (provisionUser, trip triggers, damoovSync) actually sets.
          overallScore: profile.currentScore ?? 0,
          totalTrips: profile.totalTrips ?? 0,
          totalMiles: profile.totalMiles ?? 0,
          scoreBreakdown: profile.scoreBreakdown ?? {
            speedScore: 0, brakingScore: 0, accelerationScore: 0,
            corneringScore: 0, phoneUsageScore: 100,
          },
          recentTrips: userData.recentTrips ?? [],
        });
      });

    return unsubscribe;
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Firestore listener auto-updates, just show the indicator briefly
    setTimeout(() => setRefreshing(false), 1000);
  };

  const score = data?.overallScore ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0] ?? 'Driver'}</Text>
          <Text style={styles.subtitle}>Your driving dashboard</Text>
        </View>

        {/* Score Ring */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreRing, { borderColor: scoreColor(score) }]}>
            <Text style={[styles.scoreNumber, { color: scoreColor(score) }]}>{score}</Text>
            <Text style={styles.scoreLabel}>Safety Score</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <StatCard label="Trips" value={String(data?.totalTrips ?? 0)} />
          <StatCard label="Miles" value={String(Math.round(data?.totalMiles ?? 0))} />
          <StatCard label="Rank" value="--" />
        </View>

        {/* Score Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Score Breakdown</Text>
          <ScoreBar label="Speed" value={data?.scoreBreakdown.speedScore ?? 0} weight="25%" />
          <ScoreBar label="Braking" value={data?.scoreBreakdown.brakingScore ?? 0} weight="25%" />
          <ScoreBar label="Acceleration" value={data?.scoreBreakdown.accelerationScore ?? 0} weight="20%" />
          <ScoreBar label="Cornering" value={data?.scoreBreakdown.corneringScore ?? 0} weight="20%" />
          <ScoreBar label="Phone" value={data?.scoreBreakdown.phoneUsageScore ?? 100} weight="10%" />
        </View>

        {/* Recent Trips */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Trips</Text>
          {(data?.recentTrips?.length ?? 0) === 0 ? (
            <Text style={styles.emptyText}>No trips yet. Start driving to see your score!</Text>
          ) : (
            data?.recentTrips.slice(0, 5).map((trip) => (
              <View key={trip.tripId} style={styles.tripRow}>
                <View>
                  <Text style={styles.tripRoute}>{trip.routeSummary || 'Trip'}</Text>
                  <Text style={styles.tripMeta}>
                    {(trip.distanceMeters / 1609.34).toFixed(1)} mi · {Math.round(trip.durationSeconds / 60)} min
                  </Text>
                </View>
                <Text style={[styles.tripScore, { color: scoreColor(trip.score) }]}>{trip.score}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <View style={styles.scoreBarRow}>
      <View style={styles.scoreBarLabel}>
        <Text style={styles.scoreBarText}>{label}</Text>
        <Text style={styles.scoreBarWeight}>{weight}</Text>
      </View>
      <View style={styles.scoreBarTrack}>
        <View style={[styles.scoreBarFill, { width: `${value}%`, backgroundColor: scoreColor(value) }]} />
      </View>
      <Text style={[styles.scoreBarValue, { color: scoreColor(value) }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: S.md, paddingBottom: 100 },
  header: { marginTop: S.md, marginBottom: S.lg },
  greeting: { fontSize: FS.xxl, fontFamily: F.bodyBold, color: C.text.pri },
  subtitle: { fontFamily: F.body, fontSize: FS.md, color: C.text.sec, marginTop: 2 },

  scoreCard: { alignItems: 'center', marginBottom: S.lg },
  scoreRing: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 6, justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.surface1,
  },
  scoreNumber: { fontSize: FS.display, fontFamily: F.bodyBold },
  scoreLabel: { fontFamily: F.body, fontSize: FS.xs, color: C.text.sec, marginTop: -4 },

  statsRow: { flexDirection: 'row', gap: S.sm, marginBottom: S.md },
  statCard: {
    flex: 1, backgroundColor: C.surface1, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border, padding: S.md, alignItems: 'center',
  },
  statValue: { fontSize: FS.xl, fontFamily: F.bodyBold, color: C.text.pri },
  statLabel: { fontFamily: F.body, fontSize: FS.xs, color: C.text.sec, marginTop: 2 },

  card: {
    backgroundColor: C.surface1, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border, padding: S.md, marginBottom: S.md,
  },
  cardTitle: { fontSize: FS.lg, fontFamily: F.bodyBold, color: C.text.pri, marginBottom: S.md },

  scoreBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: S.sm },
  scoreBarLabel: { width: 90, flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreBarText: { fontFamily: F.body, fontSize: FS.sm, color: C.text.sec },
  scoreBarWeight: { fontFamily: F.body, fontSize: FS.xs, color: C.text.mut },
  scoreBarTrack: { flex: 1, height: 6, backgroundColor: C.surface2, borderRadius: 3, marginHorizontal: S.sm },
  scoreBarFill: { height: 6, borderRadius: 3 },
  scoreBarValue: { width: 30, textAlign: 'right', fontSize: FS.sm, fontFamily: F.bodyBold },

  tripRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tripRoute: { fontSize: FS.md, fontFamily: F.bodySemiBold, color: C.text.pri },
  tripMeta: { fontFamily: F.body, fontSize: FS.xs, color: C.text.sec, marginTop: 2 },
  tripScore: { fontSize: FS.xl, fontFamily: F.bodyBold },

  emptyText: { fontFamily: F.body, fontSize: FS.sm, color: C.text.mut, textAlign: 'center', paddingVertical: S.lg },
});

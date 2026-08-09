/**
 * Trip Detail - Driiva Mobile
 * Reads the same trip doc the (tabs)/trips.tsx list reads. Instrument mode.
 * Wave C adds the map polyline; this screen stays lean until then.
 */
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R, scoreColor } from '@/components/ui/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScoreBreakdownBar } from '@/components/ui/ScoreBreakdownBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

interface ScoreBreakdown {
  speedScore: number;
  brakingScore: number;
  accelerationScore: number;
  corneringScore: number;
  phoneUsageScore: number;
}

interface TripEvents {
  hardBrakingCount: number;
  hardAccelerationCount: number;
  speedingSeconds: number;
  sharpTurnCount: number;
}

interface TripLocation {
  address: string | null;
}

interface Trip {
  tripId: string;
  userId: string;
  score: number;
  scoreBreakdown?: ScoreBreakdown;
  distanceMeters: number;
  durationSeconds: number;
  startedAt: { toDate?: () => Date } | string;
  startLocation?: TripLocation;
  endLocation?: TripLocation;
  routeSummary?: string;
  status: string;
  events?: TripEvents;
}

export default function TripDetail() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);

  useEffect(() => {
    if (!tripId) return;

    const unsubscribe = firestore()
      .collection('trips')
      .doc(tripId)
      .onSnapshot(
        (doc: { exists: boolean; id: string; data: () => Record<string, unknown> | undefined }) => {
          if (!doc.exists) {
            setTrip(null);
            return;
          }
          const data = { tripId: doc.id, ...doc.data() } as Trip;
          if (user?.id && data.userId !== user.id) {
            setTrip(null);
            return;
          }
          setTrip(data);
        },
        () => setTrip(null),
      );

    return unsubscribe;
  }, [tripId, user?.id]);

  const formatDate = (ts: Trip['startedAt']) => {
    const date = typeof ts === 'string' ? new Date(ts) : ts?.toDate?.();
    if (!date) return null;
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (trip === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.scroll}>
          <SkeletonLoader width="100%" height={140} borderRadius={R.card} style={{ marginBottom: S.md }} />
          <SkeletonLoader width="100%" height={220} borderRadius={R.card} />
        </View>
      </SafeAreaView>
    );
  }

  if (trip === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <EmptyState
          icon="alert-circle-outline"
          title="Trip not found"
          subtitle="This trip does not exist or is not yours."
          action={{ label: 'Back to trips', onPress: () => router.replace('/(tabs)/trips') }}
        />
      </SafeAreaView>
    );
  }

  const distanceMiles = (trip.distanceMeters / 1609.34).toFixed(1);
  const durationMinutes = Math.round(trip.durationSeconds / 60);
  const dateLabel = formatDate(trip.startedAt);
  const startLabel = trip.startLocation?.address?.split(',')[0] || null;
  const endLabel = trip.endLocation?.address?.split(',')[0] || null;
  const routeTitle = trip.routeSummary || (startLabel && endLabel ? `${startLabel} → ${endLabel}` : 'Trip');

  const factors: { label: string; value: number | undefined }[] = [
    { label: 'Speed', value: trip.scoreBreakdown?.speedScore },
    { label: 'Braking', value: trip.scoreBreakdown?.brakingScore },
    { label: 'Acceleration', value: trip.scoreBreakdown?.accelerationScore },
    { label: 'Cornering', value: trip.scoreBreakdown?.corneringScore },
    { label: 'Phone use', value: trip.scoreBreakdown?.phoneUsageScore },
  ];
  const hasBreakdown = factors.some((f) => typeof f.value === 'number');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GlassCard padding="lg" style={{ marginBottom: S.md }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.route}>{routeTitle}</Text>
              {dateLabel && <Text style={styles.date}>{dateLabel}</Text>}
            </View>
            <View style={[styles.scoreBadge, { borderColor: scoreColor(trip.score) }]}>
              <Text style={[styles.scoreText, { color: scoreColor(trip.score) }]}>{Math.round(trip.score)}</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <Stat label="Distance" value={`${distanceMiles} mi`} />
            <Stat label="Duration" value={`${durationMinutes} min`} />
            <Stat label="Status" value={trip.status} />
          </View>
        </GlassCard>

        <GlassCard padding="lg" style={{ marginBottom: S.md }}>
          <Text style={styles.sectionTitle}>Score breakdown</Text>
          {hasBreakdown ? (
            factors.map((f) => (
              <ScoreBreakdownBar key={f.label} label={f.label} value={Math.round(f.value ?? 0)} />
            ))
          ) : (
            <Text style={styles.emptyLine}>Breakdown not available for this trip yet.</Text>
          )}
        </GlassCard>

        <GlassCard padding="lg">
          <Text style={styles.sectionTitle}>Driving events</Text>
          {trip.events ? (
            <View style={styles.eventsGrid}>
              <EventStat label="Hard braking" value={trip.events.hardBrakingCount} />
              <EventStat label="Hard acceleration" value={trip.events.hardAccelerationCount} />
              <EventStat label="Speeding" value={`${trip.events.speedingSeconds}s`} />
              <EventStat label="Sharp turns" value={trip.events.sharpTurnCount} />
            </View>
          ) : (
            <Text style={styles.emptyLine}>Event data not available for this trip yet.</Text>
          )}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.headerBar}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color={C.text.pri} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Trip</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EventStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.eventStat}>
      <Text style={styles.eventValue}>{value}</Text>
      <Text style={styles.eventLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingBottom: S.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: R.badge,
    backgroundColor: C.surface1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...T.h2, color: C.text.pri },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  route: { ...T.h1, color: C.text.hero },
  date: { ...T.caption, color: C.text.sec, marginTop: S.xs },
  scoreBadge: {
    width: 56, height: 56, borderRadius: R.full, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center', backgroundColor: C.surface1,
  },
  scoreText: { ...T.stat },
  statRow: { flexDirection: 'row', marginTop: S.lg, gap: S.lg },
  stat: { flex: 1 },
  statValue: { ...T.number, color: C.text.pri, fontSize: 17 },
  statLabel: { ...T.caption, color: C.text.sec, marginTop: 2, textTransform: 'capitalize' },
  sectionTitle: { ...T.label, color: C.text.sec, marginBottom: S.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyLine: { ...T.body, color: C.text.mut },
  eventsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  eventStat: { width: '45%' },
  eventValue: { ...T.number, color: C.text.pri, fontSize: 18 },
  eventLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },
});

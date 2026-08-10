/**
 * Trip Detail - Driiva Mobile
 * Reads the same trip doc the (tabs)/trips.tsx list reads. Instrument mode.
 *
 * Wave C (C3) adds the two things that make this a trip detail rather than a
 * trip summary: the five-factor breakdown carrying each factor's real weight,
 * and the recorded route drawn as a polyline.
 *
 * The weights come from SCORE_WEIGHTS in @driiva/scoring, the same constant
 * computeDrivingScore multiplies by. They are never retyped here: the marketing
 * site shipped transposed weights once because someone copied the numbers
 * across by hand, and a displayed weighting that disagrees with the algorithm
 * is worse than showing none.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { SCORE_WEIGHTS } from '@driiva/scoring';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R, scoreColor } from '@/components/ui/theme';
import { maybeAskForReview } from '@/lib/review';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ScoreBreakdownBar } from '@/components/ui/ScoreBreakdownBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { getTripPoints, type StoredTripPoint } from '@/lib/trips';

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
  const [points, setPoints] = useState<StoredTripPoint[] | undefined>(undefined);
  // Read once, only so the review gate can tell an established driver from
  // someone on their first week. Not rendered.
  const [profileTrips, setProfileTrips] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    firestore()
      .collection('users')
      .doc(user.id)
      .get()
      .then((snap: { data: () => { drivingProfile?: { totalTrips?: number } } | undefined }) => {
        if (!cancelled) setProfileTrips(snap.data()?.drivingProfile?.totalTrips ?? 0);
      })
      .catch(() => {
        /* the gate simply will not fire */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  // Points are immutable once written, so they are fetched once rather than
  // subscribed to. Read through getTripPoints, which checks the parent document
  // AND the batches subcollection: reading only the parent is why the web map
  // was permanently empty before Wave 0.
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    getTripPoints(tripId)
      .then((result) => {
        if (!cancelled) setPoints(result);
      })
      .catch((err) => {
        console.error('[trip-detail] could not load route', err);
        if (!cancelled) setPoints([]);
      });

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  /*
   * The one genuinely positive moment in the app: a driver has opened a trip
   * that scored well. maybeAskForReview decides whether it qualifies (never on
   * launch, never twice, not before the driver has real history), so this only
   * has to hand it the facts.
   *
   * Deliberately here rather than on the dashboard: opening a trip detail is
   * an intentional act, whereas the dashboard appears whether or not anyone
   * wanted it to.
   */
  useEffect(() => {
    if (!trip || trip.score == null) return;
    maybeAskForReview({
      tripScore: trip.score,
      totalTrips: profileTrips,
    }).catch(() => {
      // A prompt that cannot be shown is not worth surfacing to the user.
    });
  }, [trip, profileTrips]);

  const route = useMemo(
    () => (points ?? []).map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [points],
  );

  const region = useMemo(() => {
    if (route.length === 0) return null;
    const lats = route.map((p) => p.latitude);
    const lngs = route.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      // A floor on the span so a short trip does not open zoomed to a car park.
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.01),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.01),
    };
  }, [route]);

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
  const routeTitle = trip.routeSummary || (startLabel && endLabel ? `${startLabel} to ${endLabel}` : 'Trip');

  // Weights read from the scoring package, paired with the factor each one
  // actually multiplies in computeDrivingScore. Adding a sixth factor there
  // without adding it here shows an incomplete breakdown, so the five keys are
  // spelled out rather than derived from Object.keys ordering.
  const factors: { label: string; value: number | undefined; weight: number }[] = [
    { label: 'Speed', value: trip.scoreBreakdown?.speedScore, weight: SCORE_WEIGHTS.speed },
    { label: 'Braking', value: trip.scoreBreakdown?.brakingScore, weight: SCORE_WEIGHTS.braking },
    {
      label: 'Acceleration',
      value: trip.scoreBreakdown?.accelerationScore,
      weight: SCORE_WEIGHTS.acceleration,
    },
    {
      label: 'Cornering',
      value: trip.scoreBreakdown?.corneringScore,
      weight: SCORE_WEIGHTS.cornering,
    },
    {
      label: 'Phone use',
      value: trip.scoreBreakdown?.phoneUsageScore,
      weight: SCORE_WEIGHTS.phoneUsage,
    },
  ];
  const hasBreakdown = factors.some((f) => typeof f.value === 'number');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SurfaceCard padding="lg" style={{ marginBottom: S.md }}>
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
        </SurfaceCard>

        <SurfaceCard padding="lg" style={{ marginBottom: S.md }}>
          <Text style={styles.sectionTitle}>Route</Text>
          {points === undefined ? (
            <SkeletonLoader width="100%" height={200} borderRadius={R.card} />
          ) : route.length >= 2 && region ? (
            <View style={styles.mapWrap}>
              <MapView
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={region}
                pointerEvents="none"
                showsUserLocation={false}
                showsPointsOfInterests={false}
                toolbarEnabled={false}
              >
                <Polyline coordinates={route} strokeColor={C.primary} strokeWidth={4} />
                <Marker coordinate={route[0]} title="Start" pinColor={C.success} />
                <Marker coordinate={route[route.length - 1]} title="End" pinColor={C.primary} />
              </MapView>
            </View>
          ) : (
            <Text style={styles.emptyLine}>
              No route was recorded for this trip.
            </Text>
          )}
        </SurfaceCard>

        <SurfaceCard padding="lg" style={{ marginBottom: S.md }}>
          <Text style={styles.sectionTitle}>Score breakdown</Text>
          {hasBreakdown ? (
            <>
              {factors.map((f) => (
                <ScoreBreakdownBar
                  key={f.label}
                  label={f.label}
                  value={Math.round(f.value ?? 0)}
                  weight={f.weight}
                />
              ))}
              <Text style={styles.breakdownFootnote}>
                Each factor is scored out of 100, then weighted into your trip score.
              </Text>
            </>
          ) : (
            <Text style={styles.emptyLine}>Breakdown not available for this trip yet.</Text>
          )}
        </SurfaceCard>

        <SurfaceCard padding="lg">
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
        </SurfaceCard>
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
  mapWrap: { height: 200, borderRadius: R.card, overflow: 'hidden' },
  map: { flex: 1 },
  breakdownFootnote: { ...T.caption, color: C.text.mut, marginTop: S.sm, lineHeight: 16 },
  eventsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  eventStat: { width: '45%' },
  eventValue: { ...T.number, color: C.text.pri, fontSize: 18 },
  eventLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },
});

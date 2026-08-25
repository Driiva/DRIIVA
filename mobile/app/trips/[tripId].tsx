/**
 * Trip Detail - Driiva Mobile
 *
 * The screen that answers "why did this trip score what it scored". Three
 * things do that: the recorded route, the five factors with the weights the
 * algorithm actually multiplies by, and the events those factors are computed
 * from, each shown as a RATE rather than a bare count.
 *
 * WHY RATES AND NOT COUNTS
 * Four hard braking events is meaningless on its own. Four over ninety miles
 * is a careful driver and four over two miles is not, and the scoring engine
 * only ever looks at the per-mile figure (see computeDrivingScore, which
 * divides every event count by distanceMiles before penalising it). Showing
 * the count alone shows the driver a number the algorithm never used.
 *
 * WHY A TRACE AND NOT A MAP
 * See components/ui/RouteTrace. Briefly: a basemap is another company's design
 * language in the middle of an instrument panel, the shape of the drive is the
 * information, and react-native-maps does not exist in Expo Go, so the map
 * panel was permanently a fallback string in every preview build.
 *
 * The weights come from SCORE_WEIGHTS in @driiva/scoring, the same constant
 * computeDrivingScore multiplies by. They are never retyped here: the
 * marketing site shipped transposed weights once because someone copied the
 * numbers across by hand, and a displayed weighting that disagrees with the
 * algorithm is worse than showing none.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SCORE_WEIGHTS, locateDrivingEvents, type DrivingEventType } from '@driiva/scoring';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R, scoreColor, FS, LH, TR } from '@/components/ui/theme';
import { maybeAskForReview } from '@/lib/review';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ScoreBreakdownBar } from '@/components/ui/ScoreBreakdownBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { RouteTrace, type MarkerShape, type TraceMarker } from '@/components/ui/RouteTrace';
import { Enter } from '@/components/ui/motion';
import { getTripPoints, type StoredTripPoint } from '@/lib/trips';

/**
 * Shape per event type, not colour per event type. Four hues on a
 * near-monochrome instrument is a rainbow; one earned colour and four shapes
 * says the same thing and survives being read by somebody who cannot separate
 * the hues. See RouteTrace.
 */
const MARKER_SHAPES: Record<DrivingEventType, MarkerShape> = {
  braking: 'circle',
  acceleration: 'triangle',
  cornering: 'diamond',
  speeding: 'bar',
};

const MARKER_LABELS: Record<DrivingEventType, string> = {
  braking: 'Hard braking',
  acceleration: 'Hard acceleration',
  cornering: 'Sharp turn',
  speeding: 'Over the limit',
};

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
  phonePickupCount: number;
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

  /**
   * Sorted by t BEFORE anything else reads it, and the same sorted array feeds
   * both the polyline and the event locator.
   *
   * locateDrivingEvents deliberately does not sort, because sorting inside it
   * would return indices into an array the caller does not hold. computeTripMetrics
   * sorts by t before scoring, so sorting here is what makes the markers line up
   * with the pass that produced the score.
   */
  const ordered = useMemo(() => [...(points ?? [])].sort((a, b) => a.t - b.t), [points]);

  const route = useMemo(() => ordered.map((p) => ({ lat: p.lat, lng: p.lng })), [ordered]);

  /**
   * Event marks, from the same detector and the same thresholds the score was
   * computed with. Never re-derived here: the marketing site shipped
   * transposed weights once because someone retyped five numbers, and a marker
   * placed by a second copy of the rules would disagree with the count beside
   * it for reasons nobody could see.
   *
   * Four types, not five. Phone handling is a client-reported count with no
   * position attached, so there is nowhere honest to put it on a map and it is
   * absent from the legend rather than guessed at.
   */
  const markers = useMemo<TraceMarker[]>(() => {
    if (ordered.length < 2) return [];
    return locateDrivingEvents(ordered).map((event) => ({
      index: event.index,
      shape: MARKER_SHAPES[event.type],
      label: MARKER_LABELS[event.type],
    }));
  }, [ordered]);

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

  const miles = trip.distanceMeters / 1609.34;
  const distanceMiles = miles.toFixed(1);
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
        <Enter index={0} count={4}>
          <SurfaceCard padding="lg" style={styles.section}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.route}>{routeTitle}</Text>
                {dateLabel && <Text style={styles.date}>{dateLabel}</Text>}
              </View>
              <View style={[styles.scoreBadge, { borderColor: scoreColor(trip.score) }]}>
                <Text style={[styles.scoreText, { color: scoreColor(trip.score) }]}>
                  {Math.round(trip.score)}
                </Text>
              </View>
            </View>

            <View style={styles.statRow}>
              <Stat label="Distance" value={`${distanceMiles} mi`} />
              <Stat label="Duration" value={`${durationMinutes} min`} />
              <Stat label="Status" value={trip.status} />
            </View>
          </SurfaceCard>
        </Enter>

        <Enter index={1} count={4}>
          <SurfaceCard padding="lg" style={styles.section}>
            <Text style={styles.sectionTitle}>Route</Text>
            {points === undefined ? (
              <SkeletonLoader width="100%" height={190} borderRadius={R.card} />
            ) : (
              <RouteTrace points={route} markers={markers} />
            )}
            {(startLabel || endLabel) && (
              <Text style={styles.routeEnds}>
                {startLabel ?? 'Unknown'} to {endLabel ?? 'Unknown'}
              </Text>
            )}
          </SurfaceCard>
        </Enter>

        <Enter index={2} count={4}>
          <SurfaceCard padding="lg" style={styles.section}>
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
                  Each factor is scored out of 100, then weighted into your trip score at the
                  percentage beside it.
                </Text>
              </>
            ) : (
              <Text style={styles.emptyLine}>Breakdown not available for this trip yet.</Text>
            )}
          </SurfaceCard>
        </Enter>

        <Enter index={3} count={4}>
          <SurfaceCard padding="lg">
            <Text style={styles.sectionTitle}>Driving events</Text>
            {trip.events ? (
              <>
                <View style={styles.eventsGrid}>
                  <EventStat
                    label="Hard braking"
                    value={trip.events.hardBrakingCount}
                    rate={perMile(trip.events.hardBrakingCount, miles)}
                  />
                  <EventStat
                    label="Hard acceleration"
                    value={trip.events.hardAccelerationCount}
                    rate={perMile(trip.events.hardAccelerationCount, miles)}
                  />
                  <EventStat
                    label="Sharp turns"
                    value={trip.events.sharpTurnCount}
                    rate={perMile(trip.events.sharpTurnCount, miles)}
                  />
                  <EventStat
                    label="Speeding"
                    value={`${trip.events.speedingSeconds}s`}
                    rate={shareOfDrive(trip.events.speedingSeconds, trip.durationSeconds)}
                  />
                  {typeof trip.events.phonePickupCount === 'number' ? (
                    <EventStat
                      label="Phone handling"
                      value={trip.events.phonePickupCount}
                      rate={perTenMinutes(trip.events.phonePickupCount, trip.durationSeconds)}
                    />
                  ) : (
                    <EventStat label="Phone handling" value="Not measured" rate="scored before phone handling was tracked" />
                  )}
                </View>
                <Text style={styles.breakdownFootnote}>
                  The rate is what the score is computed from, not the count. Four hard stops
                  over ninety miles is not the same drive as four over two.
                </Text>
              </>
            ) : (
              <Text style={styles.emptyLine}>Event data not available for this trip yet.</Text>
            )}
          </SurfaceCard>
        </Enter>
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

/**
 * The three rate shapes the scoring engine actually uses.
 *
 * Braking, acceleration and cornering are penalised per MILE; phone handling
 * is penalised per TEN MINUTES (see computePhoneUsageScore); speeding is a
 * share of the drive's duration. Showing all five as one unit would be tidier
 * and would misrepresent four of them.
 *
 * Each returns null rather than a zero or an Infinity when its denominator is
 * missing. A trip with no distance has no per-mile rate, and printing "0.0/mi"
 * for it is a fabricated reading.
 */
function perMile(count: number, miles: number): string | null {
  if (!Number.isFinite(miles) || miles < 0.1) return null;
  return `${(count / miles).toFixed(1)} per mile`;
}

function perTenMinutes(count: number, durationSeconds: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 60) return null;
  return `${((count / durationSeconds) * 600).toFixed(1)} per 10 min`;
}

function shareOfDrive(seconds: number, durationSeconds: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return `${((seconds / durationSeconds) * 100).toFixed(1)}% of the drive`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EventStat({
  label,
  value,
  rate,
}: {
  label: string;
  value: number | string;
  rate: string | null;
}) {
  return (
    <View style={styles.eventStat}>
      <Text style={styles.eventValue}>{value}</Text>
      <Text style={styles.eventLabel}>{label}</Text>
      {rate !== null && <Text style={styles.eventRate}>{rate}</Text>}
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
  statValue: { ...T.number, color: C.text.pri },
  statLabel: { ...T.caption, color: C.text.sec, marginTop: 2, textTransform: 'capitalize' },
  sectionTitle: { ...T.eyebrow, color: C.text.sec, marginBottom: S.sm },
  emptyLine: { ...T.body, color: C.text.mut },
  section: { marginBottom: S.md },
  routeEnds: { ...T.caption, color: C.text.sec, marginTop: S.sm },
  breakdownFootnote: { ...T.caption, color: C.text.mut, marginTop: S.sm },
  eventsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  eventStat: { width: '45%' },
  // Same: T.number is base, so lg needs lg's leading, not base's.
  eventValue: { ...T.number, color: C.text.pri, fontSize: FS.lg, lineHeight: LH.lg, letterSpacing: TR.lg },
  eventLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },
  eventRate: { ...T.numberSm, color: C.text.mut, marginTop: 2 },
});

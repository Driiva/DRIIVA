/**
 * Record - Driiva Mobile
 *
 * Real on-device trip capture (Wave C, C1 + C2). What was here before was a UI
 * shell over `setTimeout(() => setState('idle'), 3000)` with two TODOs where
 * the telematics should be: it showed "Recording Trip", then "Processing", then
 * returned to idle having captured, written and scored precisely nothing.
 *
 * What it does now:
 *   - watches real GPS through expo-location while the trip is running
 *   - streams those points to tripPoints/{tripId}/batches/{n}
 *   - flips the trip recording -> processing on stop, which is what the
 *     existing Cloud Function pipeline scores
 *   - asks "was this you driving?" before submitting, because GPS alone cannot
 *     tell a car from a bus, a train or a bike (Keith's Q2). A journey the
 *     driver did not drive is discarded, not scored
 *   - shows the refund moment when the scored trip lands
 *
 * MODE CONFIRMATION IS ASKED BEFORE SUBMISSION, DELIBERATELY. The rules only
 * allow a client to move a trip recording -> processing or recording -> failed,
 * so a correction collected after scoring could not undo the score it had
 * already contributed. Asking first means the answer is always honoured.
 *
 * FOREGROUND WATCH IS PRIMARY. Location.watchPositionAsync above is the
 * confirmed, on-device path and stays the first line of capture. Since (see
 * DRIIVA_CHANGELOG.md) a background task via expo-task-manager +
 * Location.startLocationUpdatesAsync is layered on top of it, additively:
 * when a trip starts, if "Always" location is already granted it starts
 * silently; otherwise the driver is shown an explicit card asking before the
 * OS "Always" prompt ever appears (see the backgroundOffer state below, and
 * lib/backgroundLocation.ts). Declining leaves capture exactly as before -
 * foreground only, driver told to keep the app open. Background capture is
 * NOT VERIFIED ON A PHYSICAL DEVICE; see DRIIVA_CHANGELOG.md.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, AppState, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { projectedRefundCents } from '@driiva/scoring';
import { C, T, S, R } from '@/components/ui/theme';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { DriivButton } from '@/components/ui/DriivButton';
import { RefundMoment } from '@/components/RefundMoment';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { firestore, isExpoGo } from '@/lib/firebase';
import {
  TripCaptureError,
  TripPointWriter,
  discardTrip,
  startTrip,
  submitTripForScoring,
  type SampledLocation,
} from '@/lib/trips';
import { PhonePickupDetector } from '@/lib/phonePickup';
import {
  hasBackgroundLocationPermission,
  setActiveWriter,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from '@/lib/backgroundLocation';

type Phase = 'idle' | 'starting' | 'recording' | 'confirming' | 'submitting' | 'waiting';

interface LandedTrip {
  tripScore: number;
  previousOverallScore: number | null;
  newOverallScore: number | null;
  previousProjectedPence: number | null;
  newProjectedPence: number | null;
}

/** One fix per second, or every 10 metres. Matches samplingRateHz: 1. */
const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 10,
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Record() {
  const { user } = useAuth();
  const { requestBackgroundLocation, markBackgroundLocationOffered } = usePermissions();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pointsCount, setPointsCount] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [landed, setLanded] = useState<LandedTrip | null>(null);
  /** Explicit ask card for "Always" location, shown once per trip when undecided. */
  const [backgroundOffer, setBackgroundOffer] = useState<'hidden' | 'offering' | 'requesting'>(
    'hidden',
  );
  /** Whether the background task is actually running for the trip in progress. */
  const [backgroundActive, setBackgroundActive] = useState(false);

  const tripIdRef = useRef<string | null>(null);
  const writerRef = useRef<TripPointWriter | null>(null);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMsRef = useRef(0);
  const finalFixRef = useRef<{ lat: number; lng: number } | null>(null);
  const scoreWatchRef = useRef<(() => void) | null>(null);
  const baselineRef = useRef<{ score: number | null; premiumCents: number | null }>({
    score: null,
    premiumCents: null,
  });
  // Phone-pickup detection (M2-DEC-1 Option A) - runs alongside the GPS watch
  // for the same lifetime. pickupCountRef holds the count captured at
  // stopRecording() so confirmDriving() can still read it after the detector
  // itself has been torn down. See lib/phonePickup.ts for what "pickup" means.
  const pickupDetectorRef = useRef<PhonePickupDetector | null>(null);
  const pickupCountRef = useRef(0);
  /** Set from the same user-doc read as baselineRef; true once the driver has
   * already seen the background-capture ask (accepted or "not now"), so it is
   * not shown again on every trip. */
  const backgroundOfferedRef = useRef(false);

  const teardown = useCallback(() => {
    watcherRef.current?.remove();
    watcherRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    // The trip-scored listener outlives the GPS watch by design (it is waiting
    // on the server), but it must not outlive the screen.
    scoreWatchRef.current?.();
    scoreWatchRef.current = null;
    // Stop the accelerometer listener too, so an abandoned recording
    // (unmount, cancel) does not leave a sensor subscription running against
    // a screen nobody is looking at. Idempotent if stopRecording already
    // called stop() to capture the final count.
    pickupDetectorRef.current?.stop();
    pickupDetectorRef.current = null;
    // Background capture is additive and follows the same lifecycle as the
    // foreground watch above: started when a trip begins, stopped here on
    // every exit path teardown() already covers (stop, cancel, unmount).
    setActiveWriter(null);
    stopBackgroundLocationUpdates().catch((err) =>
      console.error('[record] background stop failed', err),
    );
    setBackgroundOffer('hidden');
    setBackgroundActive(false);
  }, []);

  // A recording left running when the screen unmounts would keep a GPS watch,
  // an interval and a Firestore listener alive against a screen nobody is
  // looking at.
  useEffect(() => teardown, [teardown]);

  const handleSample = useCallback((fix: Location.LocationObject) => {
    const sample: SampledLocation = {
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      speed: fix.coords.speed,
      heading: fix.coords.heading,
      accuracy: fix.coords.accuracy,
      timestamp: fix.timestamp,
    };
    writerRef.current?.add(sample);
    finalFixRef.current = { lat: sample.latitude, lng: sample.longitude };
    setPointsCount(writerRef.current?.pointsCount ?? 0);
    setDistanceMeters(writerRef.current?.distance ?? 0);
  }, []);

  const beginTrip = useCallback(async () => {
    if (!user?.id) {
      setError('Sign in before recording a trip.');
      return;
    }

    setError(null);
    setPhase('starting');

    try {
      // Refuse in Expo Go rather than recording into a mock that resolves
      // without persisting. lib/trips.ts throws for this; check first so the
      // driver gets the reason before any permission prompt.
      if (isExpoGo) {
        throw new TripCaptureError(
          'preview_build',
          'Trip recording needs a full build of the app. This preview cannot save trips.',
        );
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new TripCaptureError(
          'permission_denied',
          'Driiva needs location access to record a trip. Turn it on in Settings.',
        );
      }

      const first = await Location.getCurrentPositionAsync(LOCATION_OPTIONS);

      // Read the baseline before the trip lands, so the refund moment can show
      // a real change rather than a number with nothing to compare against.
      try {
        const snap = await firestore().collection('users').doc(user.id).get();
        const data = snap.data() as
          | {
              drivingProfile?: { currentScore?: number };
              activePolicy?: { premiumCents?: number };
              permissions?: { backgroundLocationOfferedAt?: unknown };
            }
          | undefined;
        baselineRef.current = {
          score: typeof data?.drivingProfile?.currentScore === 'number'
            ? data.drivingProfile.currentScore
            : null,
          premiumCents: typeof data?.activePolicy?.premiumCents === 'number'
            ? data.activePolicy.premiumCents
            : null,
        };
        backgroundOfferedRef.current = data?.permissions?.backgroundLocationOfferedAt != null;
      } catch {
        baselineRef.current = { score: null, premiumCents: null };
        backgroundOfferedRef.current = false;
      }

      const tripId = await startTrip(user.id, {
        lat: first.coords.latitude,
        lng: first.coords.longitude,
      });

      tripIdRef.current = tripId;
      startMsRef.current = first.timestamp;
      finalFixRef.current = { lat: first.coords.latitude, lng: first.coords.longitude };

      const writer = new TripPointWriter(tripId, user.id, first.timestamp, (err) => {
        console.error('[record] point write failed', err);
      });
      writerRef.current = writer;
      writer.start();
      writer.add({
        latitude: first.coords.latitude,
        longitude: first.coords.longitude,
        speed: first.coords.speed,
        heading: first.coords.heading,
        accuracy: first.coords.accuracy,
        timestamp: first.timestamp,
      });

      setPointsCount(1);
      setDistanceMeters(0);
      setElapsed(0);
      pickupCountRef.current = 0;

      watcherRef.current = await Location.watchPositionAsync(LOCATION_OPTIONS, handleSample);
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startMsRef.current) / 1000));
      }, 1000);

      pickupDetectorRef.current = new PhonePickupDetector();
      pickupDetectorRef.current.start();

      setPhase('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

      // Background capture is additive: the foreground watch above is
      // already running and is the trip's primary GPS source. Anything below
      // failing must not undo it, so it gets its own try/catch rather than
      // sharing the one around trip start.
      try {
        setActiveWriter(writer);
        const alreadyGranted = await hasBackgroundLocationPermission();
        if (alreadyGranted) {
          await startBackgroundLocationUpdates();
          setBackgroundActive(true);
        } else if (!backgroundOfferedRef.current) {
          setBackgroundOffer('offering');
        }
      } catch (bgErr) {
        console.error('[record] background capture setup failed', bgErr);
      }
    } catch (err) {
      teardown();
      setPhase('idle');
      setError(
        err instanceof TripCaptureError ? err.message : 'Could not start recording. Try again.',
      );
    }
  }, [user?.id, handleSample, teardown]);

  /**
   * The driver said yes to the explicit background-capture card. Triggers the
   * OS "Always" prompt; if the OS denies it, the trip carries on exactly as
   * it would have without this feature - foreground only, nothing lost.
   */
  const enableBackgroundCapture = useCallback(async () => {
    setBackgroundOffer('requesting');
    try {
      const granted = await requestBackgroundLocation();
      if (granted) {
        await startBackgroundLocationUpdates();
        setBackgroundActive(true);
      } else {
        Alert.alert(
          'Background recording not enabled',
          "Driiva will keep recording only while this screen is open. You can turn this on later in Settings.",
        );
      }
    } catch (err) {
      console.error('[record] background enable failed', err);
    } finally {
      setBackgroundOffer('hidden');
    }
  }, [requestBackgroundLocation]);

  /** The driver said not now. Foreground-only capture continues unchanged. */
  const declineBackgroundCapture = useCallback(() => {
    setBackgroundOffer('hidden');
    markBackgroundLocationOffered().catch(() => {});
  }, [markBackgroundLocationOffered]);

  const stopRecording = useCallback(async () => {
    // Captured before teardown() stops-and-clears the detector, so the count
    // survives into confirmDriving() (which runs after the "was this you
    // driving?" question, once teardown has already run).
    pickupCountRef.current = pickupDetectorRef.current?.stop() ?? 0;
    teardown();
    const writer = writerRef.current;
    if (writer) {
      const totals = await writer.stop().catch(() => ({
        pointsCount: writer.pointsCount,
        distanceMeters: writer.distance,
      }));
      setPointsCount(totals.pointsCount);
      setDistanceMeters(totals.distanceMeters);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPhase('confirming');
  }, [teardown]);

  /**
   * Watches the trip until the pipeline finishes with it, then shows the refund
   * moment. A trip flagged for review stays in 'processing' with no automatic
   * path out, so the wait is bounded by the user dismissing it, not by a spinner
   * that promises a result which may never arrive.
   */
  const waitForScore = useCallback(
    (tripId: string) => {
      setPhase('waiting');
      const unsubscribe = firestore()
        .collection('trips')
        .doc(tripId)
        .onSnapshot(async (doc: { exists: boolean; data: () => Record<string, unknown> }) => {
          if (!doc.exists) return;
          const data = doc.data() as { status?: string; score?: number };
          if (data.status !== 'completed') return;

          scoreWatchRef.current?.();
          scoreWatchRef.current = null;

          const baseline = baselineRef.current;
          let newOverall: number | null = null;
          try {
            const snap = await firestore().collection('users').doc(user!.id).get();
            const profile = (snap.data() as { drivingProfile?: { currentScore?: number } } | undefined)
              ?.drivingProfile;
            newOverall = typeof profile?.currentScore === 'number' ? profile.currentScore : null;
          } catch {
            newOverall = null;
          }

          // Money only where a real premium exists to compute it from.
          const premium = baseline.premiumCents;
          const previousProjected =
            premium != null && baseline.score != null
              ? projectedRefundCents(baseline.score, premium)
              : null;
          const newProjected =
            premium != null && newOverall != null
              ? projectedRefundCents(newOverall, premium)
              : null;

          setLanded({
            tripScore: typeof data.score === 'number' ? data.score : 0,
            previousOverallScore: baseline.score,
            newOverallScore: newOverall,
            previousProjectedPence: previousProjected,
            newProjectedPence: newProjected,
          });
        });

      scoreWatchRef.current = unsubscribe;
    },
    [user],
  );

  const confirmDriving = useCallback(async () => {
    const tripId = tripIdRef.current;
    const end = finalFixRef.current;
    if (!tripId || !end) return;

    setPhase('submitting');
    setError(null);
    try {
      await submitTripForScoring(tripId, {
        end,
        distanceMeters,
        pointsCount,
        phonePickupCount: pickupCountRef.current,
      });
      waitForScore(tripId);
    } catch (err) {
      setPhase('confirming');
      setError(
        err instanceof TripCaptureError ? err.message : 'Could not save the trip. Try again.',
      );
      // A trip too short to score is already dead; take the driver back to idle
      // rather than leaving them on a confirmation they cannot complete.
      if (err instanceof TripCaptureError && err.reason === 'too_short') {
        await discardTrip(tripId, 'cancelled').catch(() => {});
        tripIdRef.current = null;
        setPhase('idle');
      }
    }
  }, [distanceMeters, pointsCount, waitForScore]);

  const rejectDriving = useCallback(async () => {
    const tripId = tripIdRef.current;
    if (!tripId) return;

    setPhase('submitting');
    setError(null);
    try {
      await discardTrip(tripId, 'not_driving');
      tripIdRef.current = null;
      setPhase('idle');
      setElapsed(0);
      setPointsCount(0);
      setDistanceMeters(0);
    } catch (err) {
      setPhase('confirming');
      setError(
        err instanceof TripCaptureError ? err.message : 'Could not discard the trip. Try again.',
      );
    }
  }, []);

  const dismissRefundMoment = useCallback(() => {
    setLanded(null);
    tripIdRef.current = null;
    setPhase('idle');
    setElapsed(0);
    setPointsCount(0);
    setDistanceMeters(0);
  }, []);

  // Losing the foreground stops the GPS watch on iOS without telling us, so the
  // trace would silently gap. Say so rather than recording a hole.
  const [wasBackgrounded, setWasBackgrounded] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && phase === 'recording') setWasBackgrounded(true);
    });
    return () => sub.remove();
  }, [phase]);

  const miles = distanceMeters / 1609.34;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {phase === 'recording'
            ? 'Recording your journey'
            : phase === 'confirming'
              ? 'One question'
              : phase === 'waiting'
                ? 'Scoring your trip'
                : 'Ready to drive'}
        </Text>

        <Text style={styles.subtitle}>
          {phase === 'recording'
            ? 'Keep Driiva open while you drive. Your route is being recorded on this device.'
            : phase === 'confirming'
              ? 'Your phone cannot tell driving from a bus or a bike, so we ask.'
              : phase === 'waiting'
                ? 'Your points are with the scoring pipeline. This usually takes a few seconds.'
                : 'Start a journey when you set off. Driiva records while the app is open.'}
        </Text>

        {phase === 'recording' && (
          <SurfaceCard padding="lg" style={styles.liveCard}>
            <View style={styles.liveRow}>
              <LiveStat label="Time" value={formatDuration(elapsed)} />
              <LiveStat label="Distance" value={`${miles.toFixed(1)} mi`} />
              <LiveStat label="Points" value={String(pointsCount)} />
            </View>
            {wasBackgrounded && (
              <Text style={backgroundActive ? styles.info : styles.warning}>
                {backgroundActive
                  ? 'Driiva kept recording in the background.'
                  : 'Driiva was in the background for part of this trip, so some of the route may be missing.'}
              </Text>
            )}
          </SurfaceCard>
        )}

        {phase === 'recording' && backgroundOffer !== 'hidden' && (
          <SurfaceCard padding="lg" style={styles.liveCard}>
            <Text style={styles.question}>Keep recording if you switch apps?</Text>
            <Text style={styles.questionMeta}>
              Right now Driiva only records this trip while this screen stays
              open. Turning this on lets your phone keep recording your
              location in the background for this trip, so a call or a locked
              screen does not cut it short. You can turn it off again in
              Settings at any time.
            </Text>
            <DriivButton
              title="Enable background recording"
              onPress={enableBackgroundCapture}
              loading={backgroundOffer === 'requesting'}
              style={{ marginTop: S.md }}
            />
            <DriivButton
              title="Not now"
              variant="secondary"
              onPress={declineBackgroundCapture}
              disabled={backgroundOffer === 'requesting'}
              style={{ marginTop: S.sm }}
            />
          </SurfaceCard>
        )}

        {phase === 'confirming' && (
          <SurfaceCard padding="lg" style={styles.liveCard}>
            <Text style={styles.question}>Was this you driving?</Text>
            <Text style={styles.questionMeta}>
              {miles.toFixed(1)} mi over {formatDuration(elapsed)}, {pointsCount} GPS points.
            </Text>
            <DriivButton
              title="Yes, I was driving"
              onPress={confirmDriving}
              style={{ marginTop: S.md }}
            />
            <DriivButton
              title="No, I was a passenger"
              variant="secondary"
              onPress={rejectDriving}
              style={{ marginTop: S.sm }}
            />
            <Text style={styles.questionFootnote}>
              A journey you did not drive is discarded and never scored.
            </Text>
          </SurfaceCard>
        )}

        {phase !== 'confirming' && (
          <TouchableOpacity
            style={[
              styles.recordButton,
              phase === 'recording' && styles.recordButtonActive,
              (phase === 'starting' || phase === 'submitting' || phase === 'waiting') &&
                styles.recordButtonBusy,
            ]}
            onPress={phase === 'recording' ? stopRecording : beginTrip}
            disabled={phase === 'starting' || phase === 'submitting' || phase === 'waiting'}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={phase === 'recording' ? 'End journey' : 'Start my journey'}
          >
            <Ionicons
              name={
                phase === 'recording'
                  ? 'stop'
                  : phase === 'starting' || phase === 'submitting' || phase === 'waiting'
                    ? 'hourglass-outline'
                    : 'play'
              }
              size={48}
              color={C.text.hero}
            />
          </TouchableOpacity>
        )}

        {phase === 'idle' && (
          <Text style={styles.hint}>Tap to start my journey</Text>
        )}
        {phase === 'recording' && <Text style={styles.hint}>Tap to end the journey</Text>}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <RefundMoment
        visible={landed !== null}
        tripScore={landed?.tripScore ?? 0}
        previousOverallScore={landed?.previousOverallScore ?? null}
        newOverallScore={landed?.newOverallScore ?? null}
        previousProjectedPence={landed?.previousProjectedPence ?? null}
        newProjectedPence={landed?.newProjectedPence ?? null}
        onDismiss={dismissRefundMoment}
      />
    </SafeAreaView>
  );
}

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.liveStat}>
      <Text style={styles.liveValue}>{value}</Text>
      <Text style={styles.liveLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.md,
    paddingBottom: 100,
  },
  title: { ...T.h1, color: C.text.hero, textAlign: 'center' },
  subtitle: {
    ...T.body,
    color: C.text.sec,
    textAlign: 'center',
    marginTop: S.sm,
    maxWidth: 320,
  },
  liveCard: { alignSelf: 'stretch', marginTop: S.lg },
  liveRow: { flexDirection: 'row', justifyContent: 'space-between' },
  liveStat: { flex: 1 },
  liveValue: { ...T.stat, color: C.text.hero },
  liveLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },
  warning: { ...T.caption, color: C.warning, marginTop: S.md, lineHeight: 16 },
  info: { ...T.caption, color: C.success, marginTop: S.md, lineHeight: 16 },
  question: { ...T.h2, color: C.text.pri },
  questionMeta: { ...T.caption, color: C.text.sec, marginTop: S.xs },
  questionFootnote: { ...T.caption, color: C.text.mut, marginTop: S.md, lineHeight: 16 },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: S.xxl,
  },
  recordButtonActive: { backgroundColor: C.error },
  recordButtonBusy: { backgroundColor: C.surface3 },
  hint: { ...T.caption, color: C.text.mut },
  error: {
    ...T.body,
    color: C.error,
    textAlign: 'center',
    marginTop: S.md,
    maxWidth: 320,
  },
});

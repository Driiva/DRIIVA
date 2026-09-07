/**
 * Drive - Driiva Mobile
 *
 * The instrument for a product whose headline claim is that it notices for you.
 * That claim is why this screen has no big button on it: a surface built around
 * a record control teaches the driver that Driiva only works if they remember
 * to press something, which is the opposite of what it does.
 *
 * Three states, one screen:
 *   ARMED    a live dot and a plain sentence saying detection is watching, plus
 *            the last drive so the screen is never empty for a returning driver.
 *            Starting by hand is a small text action, not the main event.
 *   DRIVING  speed is the anchor. A thin 270 degree arc breathes while fixes
 *            arrive, so "it is working" is legible from a phone in a mount at a
 *            glance, without reading anything. Ending is a press and hold.
 *   ENDED    hands off to RefundMoment.
 *
 * WHAT IS REAL AND WHAT IS NOT. Detection, capture, upload and scoring are
 * proved end to end against real Firebase on the iOS simulator. Background
 * capture on a PHYSICAL device, with the OS free to suspend the app in a real
 * car, is NOT VERIFIED. Nothing on this screen claims otherwise.
 *
 * Every number here is measured. There is no placeholder that could be mistaken
 * for a reading: before the first fix the speed sits at zero, dimmed, with
 * "waiting for GPS" under it, so a real stationary zero and "nothing yet" are
 * never the same pixels.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { projectedRefundCents } from '@driiva/scoring';
import { C, T, S, R, FS, LH, alpha, RGB, scoreColor } from '@/components/ui/theme';
import { RefundMoment } from '@/components/RefundMoment';
import { useAuth } from '@/contexts/AuthContext';
import { firestore, isExpoGo } from '@/lib/firebase';
import {
  getBackgroundCaptureHealth,
  subscribeBackgroundCaptureHealth,
  type BackgroundCaptureHealth,
} from '@/lib/backgroundLocation';
// The screen's readout rules, its arc, its hold-to-end control and its
// stylesheet live in mobile/components/drive/.
import {
  formatDay,
  formatDuration,
  fixQuality,
  METRES_PER_MILE,
  METRES_PER_SECOND_TO_MPH,
  QUALITY_LABEL,
  type LandedTrip,
  type LastDrive,
} from '@/components/drive/readout';
import { ARC_SIZE } from '@/components/drive/arcGeometry';
import { LiveArc } from '@/components/drive/LiveArc';
import { HoldToEnd } from '@/components/drive/HoldToEnd';
import { styles } from '@/components/drive/styles';
import { driveMonitor } from '@/lib/driveMonitorInstance';

export default function Drive() {
  const { user } = useAuth();
  const [armed, setArmed] = useState(false);
  const [driveState, setDriveState] = useState(driveMonitor.driveState);
  const [tripOpen, setTripOpen] = useState(false);
  const [speedMps, setSpeedMps] = useState<number | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [pickups, setPickups] = useState(0);
  const [health, setHealth] = useState<BackgroundCaptureHealth>(getBackgroundCaptureHealth());
  const [notice, setNotice] = useState<string | null>(null);
  const [landed, setLanded] = useState<LandedTrip | null>(null);
  const [lastDrive, setLastDrive] = useState<LastDrive | null>(null);

  const tripStartedAt = useRef<number | null>(null);
  const scoreWatch = useRef<(() => void) | null>(null);
  const baseline = useRef<{ score: number | null; premiumCents: number | null }>({
    score: null,
    premiumCents: null,
  });

  useEffect(() => {
    subscribeBackgroundCaptureHealth(setHealth);
    return () => subscribeBackgroundCaptureHealth(null);
  }, []);

  // Detection is armed app-wide by components/DriveDetectionHost, so it runs
  // whichever tab the driver is on. This screen only reports what it finds, and
  // says plainly when there is a reason recording could not start.
  useEffect(() => {
    if (isExpoGo) {
      setNotice('Drive detection needs a full build of the app. This preview cannot record.');
      return;
    }
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status !== 'granted') {
          setNotice('Driiva needs location access to notice your drives. Turn it on in Settings.');
        }
      })
      .catch(() => undefined);
  }, []);

  /**
   * The tick below calls two handlers that are declared after it, and calls
   * them when it FIRES rather than when it is created. Naming them as
   * dependencies would tear the interval down and rebuild it whenever either
   * identity changed; declaring them earlier would not help, because the tick
   * still needs whichever version is current a minute into a drive. A ref
   * refreshed after every render gives it exactly that, and lets the
   * dependency list say what it means instead of being switched off.
   */
  const tickHandlers = useRef<{
    captureBaseline: () => Promise<void>;
    onTripClosed: (tripId: string | null) => void;
  } | null>(null);

  // One tick drives the whole readout, from the monitor rather than from any
  // single sensor callback: once "Always" location is granted iOS delivers the
  // trip's fixes to the background task, which never touches React state.
  useEffect(() => {
    const id = setInterval(() => {
      const openId = driveMonitor.tripId;
      const open = openId !== null;
      setTripOpen(open);
      setDriveState(driveMonitor.driveState);
      setArmed(driveMonitor.isArmed);

      if (open && tripStartedAt.current === null) {
        // From the monitor, which knows when the DRIVE began. For an automatic
        // trip that is when the driver set off, not when detection became sure
        // and not when this screen happened to mount.
        tripStartedAt.current = driveMonitor.tripStartedAt ?? Date.now();
        void tickHandlers.current?.captureBaseline();
      }
      if (!open && tripStartedAt.current !== null) {
        tripStartedAt.current = null;
        setElapsed(0);
        setDistanceMeters(0);
        setPickups(0);
        tickHandlers.current?.onTripClosed(openId);
      }
      if (open) {
        setElapsed(Math.floor((Date.now() - (tripStartedAt.current ?? Date.now())) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const captureBaseline = useCallback(async () => {
    if (!user?.id) return;
    try {
      const snap = await firestore().collection('users').doc(user.id).get();
      const data = snap.data() as
        | { drivingProfile?: { currentScore?: number }; activePolicy?: { premiumCents?: number } }
        | undefined;
      baseline.current = {
        score: typeof data?.drivingProfile?.currentScore === 'number' ? data.drivingProfile.currentScore : null,
        premiumCents: typeof data?.activePolicy?.premiumCents === 'number' ? data.activePolicy.premiumCents : null,
      };
    } catch {
      baseline.current = { score: null, premiumCents: null };
    }
  }, [user?.id]);

  /** The monitor closed a trip. Say plainly what happened to it. */
  const onTripClosed = useCallback(
    (tripId: string | null) => {
      const outcome = driveMonitor.lastOutcome;
      if (outcome === 'not_a_drive') {
        setNotice('Not counted. That did not look like a drive.');
        return;
      }
      if (outcome === 'nothing_captured') {
        setNotice('That drive could not be recorded. No location fixes came through.');
        return;
      }
      if (outcome === 'submit_failed') {
        setNotice('Your route was saved but could not be sent for scoring yet.');
        return;
      }
      if (outcome === 'start_failed') {
        setNotice('A drive was noticed but could not be saved. The next one will try again.');
        return;
      }
      setNotice(null);
      if (tripId) scoreWatcher.current?.(tripId);
    },
    [],
  );

  /** waitForScore is declared below; onTripClosed reaches it through this ref. */
  const scoreWatcher = useRef<((tripId: string) => void) | null>(null);

  const waitForScore = useCallback(
    (tripId: string) => {
      scoreWatch.current?.();
      scoreWatch.current = firestore()
        .collection('trips')
        .doc(tripId)
        .onSnapshot(async (docSnap) => {
          if (!docSnap.exists) return;
          const data = docSnap.data() as { status?: string; score?: number; distanceMeters?: number };
          if (data.status !== 'completed') return;
          scoreWatch.current?.();
          scoreWatch.current = null;

          let newOverall: number | null = null;
          try {
            const snap = await firestore().collection('users').doc(user!.id).get();
            const profile = (snap.data() as { drivingProfile?: { currentScore?: number } } | undefined)
              ?.drivingProfile;
            newOverall = typeof profile?.currentScore === 'number' ? profile.currentScore : null;
          } catch {
            newOverall = null;
          }

          const premium = baseline.current.premiumCents;
          const tripScore = typeof data.score === 'number' ? data.score : 0;
          setLastDrive({
            miles: (data.distanceMeters ?? 0) / METRES_PER_MILE,
            score: tripScore,
            endedAt: new Date(),
          });
          setLanded({
            tripScore,
            previousOverallScore: baseline.current.score,
            newOverallScore: newOverall,
            previousProjectedPence:
              premium != null && baseline.current.score != null
                ? projectedRefundCents(baseline.current.score, premium)
                : null,
            newProjectedPence:
              premium != null && newOverall != null ? projectedRefundCents(newOverall, premium) : null,
          });
        });
    },
    [user],
  );

  // Refresh the handler refs after every render, so the mount-once tick above
  // and onTripClosed always reach the current closures.
  useEffect(() => {
    tickHandlers.current = { captureBaseline, onTripClosed };
    scoreWatcher.current = waitForScore;
  });

  useEffect(() => () => scoreWatch.current?.(), []);

  // Distance and speed come from the writer, whichever path delivered the fix.
  useEffect(() => {
    const id = setInterval(() => {
      const last = driveMonitor.lastSample;
      setSpeedMps(last ? last.speed : null);
      setAccuracyMeters(last ? last.accuracy : null);
      setDistanceMeters(driveMonitor.distanceMeters);
      // From the monitor, which owns the detector now. The screen used to own
      // it, which meant an automatic drive counted nothing at all.
      setPickups(driveMonitor.pickupCount);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const startByHand = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    try {
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      await driveMonitor.startManually({
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        speed: fix.coords.speed,
        heading: fix.coords.heading,
        accuracy: fix.coords.accuracy,
        timestamp: fix.timestamp,
      });
      setNotice(null);
    } catch {
      setNotice('Could not start a drive. Check location access and try again.');
    }
  }, []);

  const endByHand = useCallback(() => {
    void driveMonitor.stopManually();
  }, []);

  const dismissRefund = useCallback(() => setLanded(null), []);

  // Losing the foreground stops a plain foreground watch on iOS, and only the
  // background task keeps capture running. Say which is true rather than
  // guessing.
  const [wasBackgrounded, setWasBackgrounded] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && tripOpen) setWasBackgrounded(true);
    });
    return () => sub.remove();
  }, [tripOpen]);

  const miles = distanceMeters / METRES_PER_MILE;
  const quality = fixQuality(accuracyMeters);
  // Three different states, three different truths, and the screen must not
  // blur them. No fix at all is "waiting for GPS". A fix whose speed the
  // platform will not vouch for is "speed unavailable", which is what a parked
  // car reports and is NOT the same as the GPS being lost. A known speed,
  // including a real zero, is just the number.
  const hasSample = accuracyMeters !== null || speedMps !== null;
  const hasSpeed = speedMps !== null && Number.isFinite(speedMps) && speedMps >= 0;
  const speedNote = !hasSample ? 'waiting for GPS' : !hasSpeed ? 'speed unavailable' : null;
  const mph = hasSpeed ? Math.round((speedMps as number) * METRES_PER_SECOND_TO_MPH) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>Drive</Text>

      {tripOpen ? (
        <View style={styles.live}>
          <View style={styles.arcWrap}>
            <LiveArc active={driveState !== 'paused'} />
            <View style={styles.speedBlock}>
              <Text style={[styles.speed, !hasSpeed && styles.speedWaiting]}>{mph}</Text>
              <Text style={styles.speedUnit}>mph</Text>
              {speedNote && <Text style={styles.speedNote}>{speedNote}</Text>}
            </View>
          </View>

          <View style={styles.readout}>
            <Text style={styles.readoutItem}>{formatDuration(elapsed)}</Text>
            <Text style={styles.readoutDivider}>/</Text>
            <Text style={styles.readoutItem}>{miles.toFixed(1)} mi</Text>
            <Text style={styles.readoutDivider}>/</Text>
            <Text style={styles.readoutItem}>GPS {QUALITY_LABEL[quality]}</Text>
          </View>

          {pickups > 0 && (
            <Text style={styles.handling}>
              {pickups} phone {pickups === 1 ? 'pickup' : 'pickups'}
            </Text>
          )}

          {driveState === 'paused' && <Text style={styles.quiet}>Stopped. Still recording.</Text>}
          {wasBackgrounded && health === 'unavailable' && (
            <Text style={styles.quiet}>
              Background tracking unavailable, keep Driiva open.
            </Text>
          )}

          <HoldToEnd onEnd={endByHand} label="Hold to end drive" />
        </View>
      ) : (
        <View style={styles.armedView}>
          <View style={styles.watchRow}>
            <View style={[styles.dot, armed ? styles.dotLive : styles.dotOff]} />
            <Text style={styles.watchLabel}>
              {armed ? 'Watching for your next drive' : 'Not watching'}
            </Text>
          </View>

          <Text style={styles.watchBody}>
            {armed
              ? 'Driiva notices when you set off and records the drive on its own. You do not need to open the app.'
              : 'Drive detection is off, so drives will not be recorded unless you start one.'}
          </Text>

          {lastDrive && (
            <View style={styles.lastDrive}>
              <Text style={styles.lastDriveLabel}>Last drive</Text>
              <View style={styles.lastDriveRow}>
                <Text style={styles.lastDriveDate}>{formatDay(lastDrive.endedAt)}</Text>
                <Text style={styles.lastDriveMiles}>{lastDrive.miles.toFixed(1)} mi</Text>
                <Text style={[styles.lastDriveScore, { color: scoreColor(lastDrive.score) }]}>
                  {lastDrive.score}
                </Text>
              </View>
            </View>
          )}

          {notice && <Text style={styles.notice}>{notice}</Text>}

          <Pressable
            onPress={startByHand}
            accessibilityRole="button"
            accessibilityLabel="Start a drive now"
            style={styles.textAction}
          >
            <Text style={styles.textActionLabel}>Start a drive now</Text>
          </Pressable>
        </View>
      )}

      <RefundMoment
        visible={landed !== null}
        tripScore={landed?.tripScore ?? 0}
        previousOverallScore={landed?.previousOverallScore ?? null}
        newOverallScore={landed?.newOverallScore ?? null}
        previousProjectedPence={landed?.previousProjectedPence ?? null}
        newProjectedPence={landed?.newProjectedPence ?? null}
        onDismiss={dismissRefund}
      />
    </SafeAreaView>
  );
}


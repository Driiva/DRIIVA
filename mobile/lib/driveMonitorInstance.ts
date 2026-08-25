/**
 * THE LIVE DRIVE MONITOR
 * =======================
 * The one place the pure DriveMonitor is joined to real sensors and real
 * Firestore. Everything here is wiring; every decision lives in
 * lib/driveDetection.ts and lib/driveMonitor.ts, which is why those two are
 * unit-tested and this file is proved on a simulator instead.
 *
 * IT IS A MODULE SINGLETON ON PURPOSE. Detection has to keep running when the
 * Drive screen is not mounted, which is most of the time: the whole promise is
 * that a driver can leave the app on Home, or closed, and still have the drive
 * noticed. A monitor owned by a screen would only watch while someone was
 * looking at it, which is the opposite of the feature.
 *
 * NOT VERIFIED ON A PHYSICAL DEVICE. The detection path is proved against
 * simulated routes on the iOS simulator. Real background behaviour on a locked
 * phone in a real car, with the OS free to suspend the app, is NOT verified and
 * must not be described as if it were.
 */
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Accelerometer } from 'expo-sensors';
import { PhonePickupDetector } from './phonePickup';
import type { SampledLocation } from '@shared/trip-capture';

import { DriveMonitor, type TripPort } from './driveMonitor';
import {
  TripPointWriter,
  discardTrip,
  startTrip,
  submitTripForScoring,
} from './trips';
import {
  BACKGROUND_LOCATION_TASK,
  hasBackgroundLocationPermission,
  reportBackgroundCaptureUnavailable,
  resetBackgroundCaptureHealth,
  setActiveWriter,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from './backgroundLocation';

/** SecureStore keys allow only alphanumerics, dot, dash and underscore. */
const ARMED_KEY = 'driiva.drive-detection.armed';

/**
 * Accelerometer window used for the gait check. 5 Hz over five seconds is
 * enough to see the rhythm of walking without keeping the sensor busy; the
 * same rate lib/phonePickup.ts already uses, so the two can share a budget.
 */
const ACCEL_HZ = 5;
const ACCEL_WINDOW = ACCEL_HZ * 5;

/** Variance of accelerometer magnitude over the window, in g squared. */
function variance(values: readonly number[]): number | null {
  if (values.length < ACCEL_WINDOW) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
}

let userId: string | null = null;

/**
 * The real trip port. Deliberately thin: it maps the monitor's vocabulary onto
 * the trip functions that already existed and are already covered by the rules
 * tests and the capture integration test. No trip logic is introduced here.
 */
const port: TripPort = {
  async startTrip(start) {
    if (!userId) throw new Error('no signed-in driver');
    return startTrip(userId, start);
  },
  createWriter(tripId, tripStartMs) {
    if (!userId) throw new Error('no signed-in driver');
    return new TripPointWriter(tripId, userId, tripStartMs, (err) =>
      console.warn('[driveMonitor] point write failed', err),
    );
  },
  async submit(tripId, input) {
    await submitTripForScoring(tripId, {
      end: input.end,
      distanceMeters: input.distanceMeters,
      pointsCount: input.pointsCount,
      durationSeconds: input.durationSeconds,
      phonePickupCount: input.phonePickupCount,
      startedBy: input.startedBy,
    });
  },
  async discard(tripId, reason) {
    await discardTrip(tripId, reason);
  },
};

export const driveMonitor = new DriveMonitor(port);

/** The signed-in driver every trip is written under. Null when signed out. */
export function setMonitorUser(id: string | null): void {
  userId = id;
}

export async function isDetectionArmed(): Promise<boolean> {
  try {
    // Default ON. A driver who completed onboarding asked for a product that
    // notices drives; making them find a switch to get the headline feature
    // would be the wrong default.
    const stored = await SecureStore.getItemAsync(ARMED_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

export async function setDetectionArmed(armed: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(ARMED_KEY, armed ? 'true' : 'false');
  } catch {
    // A failed preference write must not stop the feature working for this
    // session; it just will not be remembered.
  }
}

let foregroundWatch: Location.LocationSubscription | null = null;
let accelSubscription: { remove: () => void } | null = null;
/**
 * Runs for as long as the MONITOR asks for it, NOT for as long as a screen is
 * mounted. The version before that was owned by the Drive screen, which for an
 * automatically detected drive is precisely the screen nobody is looking at,
 * so every trip submitted a pickup count of zero and phone usage scored a
 * perfect 100 on every trip Driiva has ever produced.
 */
let pickupDetector: PhonePickupDetector | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let magnitudes: number[] = [];

/**
 * THE ACCELEROMETER'S DUTY CYCLE.
 *
 * Both listeners go up and down together, on the monitor's instruction, rather
 * than running from arming to disarming. That was 5 Hz all day for two jobs
 * that only exist once a drive is in prospect: the gait check shortens the
 * start hold, and the pickup count is rebased when a trip opens, so anything
 * counted before that is thrown away. `driveMonitor.needsMotionSensing` is
 * where the decision lives and where it is tested.
 *
 * Idempotent in both directions: the sink is only called on a change, but a
 * second call must not leave two listeners on one sensor or throw on teardown.
 *
 * The gait window is COLD each time, so variance reads null for the first five
 * seconds of a candidate. That is honest rather than convenient - absent is
 * not agreement, so a drive that starts before the window fills waits the full
 * hold instead of the short one, and there is a test for the short hold still
 * being reached once the window arrives.
 */
function startMotionSensors(): void {
  if (!accelSubscription) {
    magnitudes = [];
    Accelerometer.setUpdateInterval(Math.round(1000 / ACCEL_HZ));
    accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
      magnitudes.push(Math.sqrt(x * x + y * y + z * z));
      if (magnitudes.length > ACCEL_WINDOW) magnitudes.shift();
      driveMonitor.onAccelVariance(variance(magnitudes));
    });
  }

  if (!pickupDetector) {
    pickupDetector = new PhonePickupDetector();
    pickupDetector.start();
    // A SOURCE the monitor pulls from, so it cannot be forgotten by a caller
    // the way the old pushed count was. The monitor rebases it per trip.
    driveMonitor.setPickupSource(() => pickupDetector?.count ?? 0);
  }
}

function stopMotionSensors(): void {
  accelSubscription?.remove();
  accelSubscription = null;
  magnitudes = [];
  // Null, not a stale last reading: an absent sensor must not go on
  // corroborating drive starts with a number nothing is measuring.
  driveMonitor.onAccelVariance(null);
  pickupDetector?.stop();
  pickupDetector = null;
  driveMonitor.setPickupSource(null);
}

/**
 * How often the monitor is asked to reconsider a drive with no new fix.
 *
 * Ten seconds is far finer than the one and three minute holds it serves, and
 * costs nothing: the tick does no IO unless a drive actually needs ending.
 */
const HEARTBEAT_MS = 10_000;

function toSample(fix: Location.LocationObject): SampledLocation {
  return {
    latitude: fix.coords.latitude,
    longitude: fix.coords.longitude,
    speed: fix.coords.speed,
    heading: fix.coords.heading,
    accuracy: fix.coords.accuracy,
    timestamp: fix.timestamp,
  };
}

/**
 * One fix per second, and NO distance filter.
 *
 * distanceInterval maps to CLLocationManager.distanceFilter on iOS, so a
 * non-zero value means "tell me only when the phone has moved that far". That
 * is fine for drawing a route and wrong for detecting one: a car that parks
 * stops moving, so it stops producing fixes, so the state machine never
 * receives the stationary samples it needs and the trip never ends by itself.
 * The drive would stay open until the driver noticed.
 *
 * Zero is kCLDistanceFilterNone: report every update the hardware produces.
 * The cost is more fixes while parked, which the writer's gate discards as
 * non-advancing anyway; the alternative was inventing stationary samples to
 * feed the machine, and no number in this app is allowed to be invented.
 */
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
  // NOTE: expo-location's LocationOptions has no activityType or
  // pausesUpdatesAutomatically; those exist only on LocationTaskOptions, which
  // the background task in lib/backgroundLocation.ts sets. So the foreground
  // watch cannot be told "this is vehicle navigation" and iOS may still pause
  // it on its own. The background task is what actually keeps a drive alive,
  // and it is started alongside this watch for exactly that reason.
};

/**
 * Starts watching for drives. Idempotent, so a screen mounting twice cannot
 * end up with two watches feeding the same monitor.
 */
export async function startWatchingForDrives(): Promise<void> {
  driveMonitor.arm();
  resetBackgroundCaptureHealth();
  // The monitor IS the sink: the background task hands fixes to whatever is
  // registered here, and the monitor decides whether they belong to a trip.
  setActiveWriter(driveMonitor);

  if (!foregroundWatch) {
    foregroundWatch = await Location.watchPositionAsync(WATCH_OPTIONS, (fix) => {
      driveMonitor.add(toSample(fix));
    });
  }

  // Background capture is what keeps a drive alive once the app is not in the
  // foreground. If it cannot run, the driver has to be told, because the
  // alternative is a screen saying "Watching for your next drive" over a phone
  // that will notice nothing the moment it locks. A console.warn told nobody.
  if (!(await hasBackgroundLocationPermission().catch(() => false))) {
    reportBackgroundCaptureUnavailable('Always location permission not granted');
  } else {
    await startBackgroundLocationUpdates().catch((err) => {
      console.warn('[driveMonitor] background updates unavailable', err);
      reportBackgroundCaptureUnavailable(String(err));
    });
  }

  if (!heartbeat) {
    // Without this a drive never ends once the fixes dry up, which is what a
    // parked car does. Proved on the simulator: the location stopped changing,
    // no further updates were delivered at all, and the trip stayed open at
    // speed indefinitely.
    heartbeat = setInterval(() => {
      void driveMonitor.tick(Date.now());
    }, HEARTBEAT_MS);
  }

  // The monitor decides when the accelerometer is worth its battery; this only
  // does as it is told. Registering the sink reports the current answer, so a
  // restart with a trip somehow still open brings the sensors straight back up.
  driveMonitor.setMotionSensingSink((needed) => {
    if (needed) startMotionSensors();
    else stopMotionSensors();
  });
}

/**
 * Stops watching for NEW drives.
 *
 * A trip already open is NOT abandoned. The heartbeat is what ends a drive when
 * the fixes dry up, so tearing it down while a trip was open left that trip in
 * 'recording' with nothing able to close it, which is the orphan shape that had
 * to be cleaned up by hand twice during the simulator proof. The sink, the
 * background updates and the heartbeat all stay until the trip is finished.
 */
export async function stopWatchingForDrives(): Promise<void> {
  driveMonitor.disarm();
  foregroundWatch?.remove();
  foregroundWatch = null;

  if (driveMonitor.tripId !== null) {
    // Leave the machinery that can still close this trip running. The monitor
    // is disarmed, so no NEW drive can open behind it.
    return;
  }

  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
  // disarm() has already told the sink to let the sensors go, but say it again
  // rather than trusting an ordering: this path also runs on sign-out.
  driveMonitor.setMotionSensingSink(null);
  stopMotionSensors();
  setActiveWriter(null);
  await stopBackgroundLocationUpdates().catch(() => undefined);
}

/**
 * Sign-out, or the app going away for good. An open trip cannot be left to a
 * monitor that is about to lose its user: end it first so it is submitted or
 * discarded honestly, rather than stranded in 'recording'.
 */
export async function finishAnyOpenDriveAndStop(): Promise<void> {
  if (driveMonitor.tripId !== null) {
    await driveMonitor.stopManually().catch(() => undefined);
  }
  driveMonitor.disarm();
  await stopWatchingForDrives();
}

export { BACKGROUND_LOCATION_TASK };

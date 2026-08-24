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
let magnitudes: number[] = [];

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

  await startBackgroundLocationUpdates().catch((err) =>
    console.warn('[driveMonitor] background updates unavailable', err),
  );

  if (!accelSubscription) {
    magnitudes = [];
    Accelerometer.setUpdateInterval(Math.round(1000 / ACCEL_HZ));
    accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
      magnitudes.push(Math.sqrt(x * x + y * y + z * z));
      if (magnitudes.length > ACCEL_WINDOW) magnitudes.shift();
      driveMonitor.onAccelVariance(variance(magnitudes));
    });
  }
}

/** Stops watching. A trip already open is left to finish on its own terms. */
export async function stopWatchingForDrives(): Promise<void> {
  driveMonitor.disarm();
  foregroundWatch?.remove();
  foregroundWatch = null;
  accelSubscription?.remove();
  accelSubscription = null;
  magnitudes = [];
  driveMonitor.onAccelVariance(null);
  if (driveMonitor.tripId === null) {
    setActiveWriter(null);
    await stopBackgroundLocationUpdates().catch(() => undefined);
  }
}

export { BACKGROUND_LOCATION_TASK };

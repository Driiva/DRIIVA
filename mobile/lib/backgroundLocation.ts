/**
 * Background GPS capture for Driiva Mobile (additive to record.tsx).
 *
 * record.tsx's foreground watch (Location.watchPositionAsync) stays exactly
 * as it was: real, confirmed on a physical device, and unchanged by anything
 * here. This file exists to close the gap that watch cannot: iOS and Android
 * both suspend a plain foreground location watch once the app leaves the
 * foreground, which is what record.tsx's "Driiva was in the background..."
 * warning has been reporting on rather than closing.
 *
 * TaskManager.defineTask has to run at module scope, not inside a component,
 * so the task is registered before the OS could ever try to deliver a
 * background location event to it. record.tsx imports this module once; the
 * task itself does nothing until a trip calls setActiveWriter with the same
 * TripPointWriter the foreground path is already using - see
 * backgroundLocationBuffer.ts for why that is one buffer, not two.
 *
 * The defineTask call is wrapped in a try/catch. A JS bundle pushed without a
 * matching native rebuild (this app ships OTA updates between EAS builds)
 * would otherwise hit a missing native module at import time, which fails at
 * the top of the whole bundle, not just this feature - the exact class of
 * crash this repo has already had once from an unguarded native-boundary
 * call. Failing this file soft means a stale binary loses background
 * capture, not the app.
 *
 * NOT VERIFIED ON A PHYSICAL DEVICE. Authored against Expo's documented
 * TaskManager + Location.startLocationUpdatesAsync pattern; see
 * DRIIVA_CHANGELOG.md for what has and has not been confirmed.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  getActiveWriter,
  handleBackgroundLocationData,
  setActiveWriter,
  type PointBuffer,
} from './backgroundLocationBuffer';

export { setActiveWriter };
export type { PointBuffer };

export const BACKGROUND_LOCATION_TASK = 'driiva-background-location';

/**
 * Whether background capture is currently able to run.
 *
 * A driver never sees an error object. The record screen subscribes to this
 * and renders at most one calm line. Held as a module-level value rather than
 * passed around because the OS can deliver into the task while no screen is
 * mounted at all.
 */
export type BackgroundCaptureHealth = 'ok' | 'unavailable';

let health: BackgroundCaptureHealth = 'ok';
let healthListener: ((next: BackgroundCaptureHealth) => void) | null = null;

export function getBackgroundCaptureHealth(): BackgroundCaptureHealth {
  return health;
}

export function subscribeBackgroundCaptureHealth(
  listener: ((next: BackgroundCaptureHealth) => void) | null,
): void {
  healthListener = listener;
}

/** Reset at the start of a trip, so one bad trip does not condemn the next. */
export function resetBackgroundCaptureHealth(): void {
  health = 'ok';
  healthListener?.('ok');
}

/**
 * Mark background capture as unavailable from OUTSIDE the task, for the cases
 * the task itself never sees: the "Always" permission was never granted, or
 * startLocationUpdatesAsync refused. Without this the app told a
 * WhenInUse-only driver it was "Watching for your next drive" while background
 * capture could not run at all.
 */
export function reportBackgroundCaptureUnavailable(reason: string): void {
  reportUnavailable(null, reason);
}

function reportUnavailable(code: number | null, message: string): void {
  // Deduped: a real fault repeats on every delivery, and the old code turned
  // that into a stream of identical red toasts.
  if (health === 'unavailable') return;
  health = 'unavailable';
  // console.warn, never console.error: this is a degraded capability the
  // driver is told about calmly on screen, not a crash. The code and message
  // are kept for diagnosis rather than shown to anyone.
  console.warn('[backgroundLocation] background capture unavailable', { code, message });
  healthListener?.('unavailable');
}

try {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    const outcome = handleBackgroundLocationData(
      {
        data: data as { locations?: Location.LocationObject[] } | null,
        error: error ?? undefined,
      },
      getActiveWriter(),
    );
    // 'transient_fault' is kCLErrorLocationUnknown, which is Core Location
    // still looking. It is deliberately silent: it was the entire content of
    // the red toast a driver saw over a trip that was recording perfectly.
    if (outcome.kind === 'capture_unavailable') {
      reportUnavailable(outcome.code, outcome.message);
    }
  });
} catch (err) {
  console.warn('[backgroundLocation] could not register task', err);
}

/**
 * One fix per second, and NO distance filter, matching the foreground watch in
 * lib/driveMonitorInstance.ts. distanceInterval is iOS's distanceFilter: with a
 * non-zero value a parked car stops producing fixes, so the drive-detection
 * state machine never sees it stop and the trip never ends by itself.
 */
const BACKGROUND_LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
  // WITHOUT THESE TWO, iOS STOPS SENDING FIXES MID-DRIVE. CLLocationManager
  // defaults pausesLocationUpdatesAutomatically to true, and with no activity
  // type it guesses badly: on a simulated 15 m/s run it suspended updates 37
  // seconds in, and the trip captured 32 points of a 133 second drive while
  // reporting no error at all. Telling it this is vehicle navigation, and that
  // it may not decide on the driver's behalf when the journey is over, is what
  // keeps the fixes coming.
  activityType: Location.ActivityType.AutomotiveNavigation,
  pausesUpdatesAutomatically: false,
  // iOS: keeps delivering fixes instead of pausing once backgrounded, at the
  // cost of the blue background-location status bar - the honest trade for
  // an app that says it is still recording.
  showsBackgroundLocationIndicator: true,
  // Android 10+ (and required from Android 14): a background location task
  // must run as a location-type foreground service, not raw background
  // location, or the OS kills it. This is what makes that persistent
  // notification appear while a trip is recording in the background.
  foregroundService: {
    notificationTitle: 'Driiva is recording your trip',
    notificationBody: 'Your route keeps recording while the app is in the background.',
  },
};

/**
 * Whether the OS has already granted "Always" location. The actual request
 * (which triggers the OS prompt) lives in hooks/usePermissions.ts alongside
 * every other permission write to the user doc, not here - one owner for
 * that Firestore field, not two functions doing the same OS call.
 */
export async function hasBackgroundLocationPermission(): Promise<boolean> {
  const { status } = await Location.getBackgroundPermissionsAsync();
  return status === 'granted';
}

export async function startBackgroundLocationUpdates(): Promise<void> {
  if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) return;
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(
    () => false,
  );
  if (started) return;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, BACKGROUND_LOCATION_OPTIONS);
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) return;
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(
    () => false,
  );
  if (!started) return;
  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

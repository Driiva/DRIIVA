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

try {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('[backgroundLocation] task error', error);
      return;
    }
    handleBackgroundLocationData(
      { data: data as { locations?: Location.LocationObject[] } | null },
      getActiveWriter(),
    );
  });
} catch (err) {
  console.error('[backgroundLocation] could not register task', err);
}

/** Mirrors record.tsx's LOCATION_OPTIONS: one fix per second, or every 10 metres. */
const BACKGROUND_LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 10,
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

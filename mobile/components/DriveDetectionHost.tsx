/**
 * DRIVE DETECTION HOST
 *
 * Renders nothing. It exists so automatic drive detection is armed for as long
 * as the driver is signed in and inside the app, rather than only while the
 * Drive screen happens to be mounted.
 *
 * That distinction is the whole feature. A driver who is promised that Driiva
 * notices when they set off will be sitting on Home, or on Trips, or have the
 * app in their pocket. Arming from the Drive screen would mean detection only
 * ran while somebody was looking at the thing that says it is running, which is
 * a demo, not a product.
 *
 * Mounted once from app/(tabs)/_layout.tsx, deliberately as one line, so it is
 * obvious where it lives and cheap to move.
 */
import { useEffect } from 'react';
import * as Location from 'expo-location';

import { useAuth } from '@/contexts/AuthContext';
import { isExpoGo } from '@/lib/firebase';
import {
  isDetectionArmed,
  setMonitorUser,
  startWatchingForDrives,
  stopWatchingForDrives,
} from '@/lib/driveMonitorInstance';

export function DriveDetectionHost() {
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    // Expo Go hands back a Firestore mock whose writes resolve without
    // persisting, so detection there would open trips into nothing.
    if (isExpoGo || !user?.id) {
      setMonitorUser(null);
      return;
    }

    setMonitorUser(user.id);
    (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') return;
      if (!(await isDetectionArmed())) return;
      if (cancelled) return;
      await startWatchingForDrives();
    })().catch((err) => console.warn('[driveDetection] could not arm', err));

    return () => {
      cancelled = true;
      void stopWatchingForDrives();
      setMonitorUser(null);
    };
  }, [user?.id]);

  return null;
}

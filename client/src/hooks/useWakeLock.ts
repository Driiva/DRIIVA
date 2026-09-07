/**
 * Screen wake lock for the trip-recording page: keep the screen on while a
 * trip is recording so the browser does not suspend GPS. Extracted verbatim
 * from client/src/pages/trip-recording.tsx, including the deliberately silent
 * catch - an unsupported or denied lock is non-fatal, and the page already
 * tells the driver to keep the screen on.
 */
import { useCallback, useRef } from 'react';

export interface WakeLockControls {
  acquireWakeLock: () => Promise<void>;
  releaseWakeLock: () => void;
}

export function useWakeLock(): WakeLockControls {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Unsupported or denied - non-fatal; user will see the guidance text
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);

  return { acquireWakeLock, releaseWakeLock };
}

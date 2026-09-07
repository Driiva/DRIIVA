/**
 * Ticks the live trip duration and distance once a second while a trip is
 * recording, and clears the interval the moment it is not. Extracted verbatim
 * from client/src/pages/trip-recording.tsx.
 *
 * The elapsed time is measured from the trip's own start ref rather than
 * counted up, so a tab that was backgrounded resumes at the right figure
 * instead of the one it was on when it went away.
 */
import { useEffect, useRef, type MutableRefObject } from 'react';

import type { RecordingState, TripStats } from '@/components/tripRecording/types';

export function useTripDurationTicker(
  recordingState: RecordingState,
  tripStartTimeRef: MutableRefObject<number>,
  totalDistance: number,
  setTripStats: (update: (prev: TripStats) => TripStats) => void,
): void {
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (recordingState === 'recording' && tripStartTimeRef.current > 0) {
      durationIntervalRef.current = setInterval(() => {
        setTripStats(prev => ({
          ...prev,
          durationMs: Date.now() - tripStartTimeRef.current,
          distanceMeters: totalDistance,
        }));
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
    // tripStartTimeRef is a ref object and setTripStats is a state setter, so
    // both have a stable identity: naming them here satisfies the rule without
    // changing when this effect reruns.
  }, [recordingState, totalDistance, tripStartTimeRef, setTripStats]);
}

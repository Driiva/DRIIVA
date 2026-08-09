/**
 * Trip Recording - full-screen entry point.
 * Registered in _layout.tsx as a modal-style stack screen (gestures locked
 * so a swipe cannot cancel an active recording by accident). The actual
 * recording UI lives on the Record tab; this route exists so deep links,
 * notifications, or a future "start driving" shortcut land somewhere real
 * instead of a 404, then hands off to the tab immediately.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function TripRecording() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/record');
  }, []);

  return null;
}

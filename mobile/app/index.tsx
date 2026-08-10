/**
 * The `/` route.
 *
 * Its absence is why every signed-in driver cold-launched into "This screen
 * does not exist": expo-router resolved `/`, found no file for it, and fell
 * through to +not-found. Nothing was persisting a stale route. The start route
 * simply had no screen behind it.
 *
 * This renders nothing and decides nothing on its own. AuthGate owns the
 * routing decision (see lib/routing.ts); this exists so `/` resolves to a real
 * screen while that decision is made, instead of resolving to the catch-all.
 */
import { View } from 'react-native';

import { C } from '@/components/ui/theme';

export default function Index() {
  // Painted in the app background rather than left transparent, so the
  // hand-off from the splash screen does not flash white.
  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}

/**
 * Tab Navigation - Driiva Mobile
 *
 * Home | Trips | Drive (centre) | Community | You
 *
 * WHY REWARDS IS NOT A TAB ANY MORE
 * A five tab bar has room for the five things a driver does, and collecting
 * badges is not one of them. Recognition belongs next to the standing it is
 * recognition of, so achievements live inside Community under "Earned" and the
 * full screen is one tap from there and from You.
 *
 * The ROUTE stays. An achievement_unlocked push notification routes to
 * '/(tabs)/rewards' (mobile/lib/notificationRoutes.ts), so deleting the screen
 * rather than hiding the tab would turn that notification into a tap that goes
 * nowhere. href: null is expo-router's own way of saying "in the group, off
 * the bar", which keeps the deep link and the tab bar both correct.
 *
 * Order is declaration order in this file and nothing else, which is why
 * tests/unit/mobile-community-surface.test.ts asserts it: reordering two JSX
 * children is a one line diff no type would reject.
 */
import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { C, F, S, FS, LH, TR } from '@/components/ui/theme';
// Wave C: arms automatic drive detection for the whole signed-in session, not
// just while the Drive screen is mounted. Renders nothing.
import { DriveDetectionHost } from '@/components/DriveDetectionHost';

/**
 * The Drive tab mark: a thin ring, with a filled centre only while the tab is
 * the one you are on.
 *
 * It was a filled purple puck with a record glyph in it, which read as a
 * console button rather than an instrument and was the first thing rejected in
 * review. An aperture is the right metaphor for a tab that opens the capture
 * screen, and drawn rather than picked from an icon set so the stroke weight
 * can match the hairline weight the rest of the bar is set in.
 *
 * It takes the same tint as every other tab, so the bar has one active colour
 * and no tab is shouting at the other four.
 */
function DriveMark({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  const d = size + 3;
  const c = d / 2;
  return (
    <Svg width={d} height={d} viewBox={`0 0 ${d} ${d}`}>
      <Circle cx={c} cy={c} r={c - 1.5} stroke={color} strokeWidth={1.5} fill="none" />
      {focused && <Circle cx={c} cy={c} r={c / 2.6} fill={color} />}
    </Svg>
  );
}

export default function TabLayout() {
  return (
    <>
    <DriveDetectionHost />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.text.mut,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Drive',
          tabBarIcon: ({ color, size, focused }) => (
            <DriveMark color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="rewards" options={{ href: null, title: 'Earned' }} />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.bg,
    borderTopColor: C.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: S.xs,
    paddingBottom: Platform.OS === 'ios' ? 28 : S.xs,
  },
  tabLabel: {
    fontSize: FS.xs,
    fontFamily: F.bodySemiBold,
    lineHeight: LH.xs,
    letterSpacing: TR.label,
  },
});

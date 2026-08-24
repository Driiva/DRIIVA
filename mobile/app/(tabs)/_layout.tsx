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
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, S, FS, LH, TR } from '@/components/ui/theme';

export default function TabLayout() {
  return (
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
          // The centre action is the only FILLED icon in the bar, which is what
          // marks it as the primary one. It is deliberately not much larger:
          // a 46px puck at this bar height sat on top of its own label, and a
          // control whose label is covered by the control is worse than a
          // control that is merely the same size as its neighbours.
          tabBarIcon: ({ focused }) => (
            <View style={[styles.recordButton, focused && styles.recordButtonActive]}>
              <Ionicons name="radio-button-on" size={20} color={C.text.hero} />
            </View>
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
  recordButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: C.primaryLight,
  },
});

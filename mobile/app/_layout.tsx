/**
 * Root Layout - Driiva Mobile
 * Wraps the entire app with auth, query client, and theme providers.
 * Auth-gates the main tabs behind login.
 */
import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { C } from '@/components/ui/theme';
import { isExpoGo } from '@/lib/firebase';
import { resolveStartRoute } from '@/lib/routing';
import { routeForNotification } from '@/lib/notificationRoutes';
import { watchTokenRefresh } from '@/lib/push';
import { track } from '@/lib/analytics';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // The whole decision lives in lib/routing.ts so it can be tested without a
    // navigator. It returns null whenever the session is already somewhere
    // valid, which keeps this effect from fighting the driver's own
    // navigation on every segment change.
    const destination = resolveStartRoute({
      isExpoGo,
      loading,
      user,
      segments: segments as unknown as string[],
    });

    if (destination) router.replace(destination as never);
  }, [user, loading, segments]);

  return <>{children}</>;
}

/**
 * Sends a tapped notification to the screen it promised.
 *
 * Two arrivals to handle, and they are genuinely different. A tap while the
 * app is running comes through the response listener. A tap that LAUNCHED the
 * app has already happened before any listener exists, and is recovered from
 * useLastNotificationResponse instead. Handling only the first is the common
 * mistake and it breaks the case that matters most, since a scheduled push is
 * usually opened cold.
 *
 * The cold-start response does not clear itself: it keeps being returned on
 * every render for the life of the process. Without the seen-set it would drag
 * the user back to the same screen every time anything re-rendered, including
 * after they had navigated away deliberately.
 *
 * Routing waits for a signed-in user who has finished onboarding. Otherwise it
 * races AuthGate, and a half-onboarded driver gets thrown into a screen the
 * gate then bounces them out of.
 */
function NotificationGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const handled = useRef<Set<string>>(new Set());
  const lastResponse = Notifications.useLastNotificationResponse();

  const ready = !loading && Boolean(user?.onboardingComplete);

  /**
   * FCM rotates tokens. watchTokenRefresh was written for exactly this and
   * then never called from anywhere, which is the worst version of the bug it
   * exists to prevent: the stored token goes stale, delivery stops, and
   * nothing errors. The weekly summary would simply stop arriving for that
   * driver and no log would say so.
   *
   * Bound to the signed-in user rather than to push permission: a token can
   * refresh whether or not the app is currently asking about notifications,
   * and storing it is harmless if they have not opted in.
   */
  useEffect(() => {
    if (!user?.id) return;
    return watchTokenRefresh(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!ready || !lastResponse) return;

    const id = lastResponse.notification.request.identifier;
    if (handled.current.has(id)) return;
    handled.current.add(id);

    const data = lastResponse.notification.request.content.data as Record<string, unknown>;
    const route = routeForNotification(data);
    track('notification_opened', {
      type: typeof data?.type === 'string' ? data.type : 'unknown',
      cold: true,
    });
    router.push(route as never);
  }, [ready, lastResponse, router]);

  useEffect(() => {
    if (!ready) return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.identifier;
      if (handled.current.has(id)) return;
      handled.current.add(id);

      const data = response.notification.request.content.data as Record<string, unknown>;
      const route = routeForNotification(data);
      track('notification_opened', {
        type: typeof data?.type === 'string' ? data.type : 'unknown',
        cold: false,
      });
      router.push(route as never);
    });

    return () => sub.remove();
  }, [ready, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'InstrumentSans-Regular': require('../assets/fonts/InstrumentSans-Regular.ttf'),
    'InstrumentSans-SemiBold': require('../assets/fonts/InstrumentSans-SemiBold.ttf'),
    'InstrumentSans-Bold': require('../assets/fonts/InstrumentSans-Bold.ttf'),
    'InterTight-SemiBold': require('../assets/fonts/InterTight-SemiBold.ttf'),
    'InterTight-Bold': require('../assets/fonts/InterTight-Bold.ttf'),
    'JetBrainsMono-Regular': require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-SemiBold': require('../assets/fonts/JetBrainsMono-SemiBold.ttf'),
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Session denominator. Without it there is no way to tell a drop-off from a
  // launch that never happened, and every funnel rate below is unanchored.
  useEffect(() => {
    track('app_opened');
  }, []);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <NotificationGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: C.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="trip-recording" options={{ gestureEnabled: false }} />
            <Stack.Screen name="trips/[tripId]" options={{ presentation: 'modal' }} />
          </Stack>
          <StatusBar style="light" />
          </NotificationGate>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}

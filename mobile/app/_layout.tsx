/**
 * Root Layout - Driiva Mobile
 * Wraps the entire app with auth, query client, and theme providers.
 * Auth-gates the main tabs behind login.
 */
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { C } from '@/components/ui/theme';
import { isExpoGo } from '@/lib/firebase';
import { resolveStartRoute } from '@/lib/routing';

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

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
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
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}

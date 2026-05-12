/**
 * Root Layout — Driiva Mobile
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
import { Colors } from '@/constants/theme';
import { isExpoGo } from '@/lib/firebase';

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
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    // Expo Go preview: skip auth, drop the mock user straight into onboarding.
    if (isExpoGo) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/signin');
    } else if (user && inAuthGroup) {
      if (user.onboardingComplete) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/onboarding');
      }
    }
  }, [user, loading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
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
              contentStyle: { backgroundColor: Colors.bg },
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

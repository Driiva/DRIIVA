/**
 * Auth Context — mirrors client/src/contexts/AuthContext.tsx
 * Uses @react-native-firebase/auth instead of the web Firebase SDK.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAnalyticsUser, track } from '@/lib/analytics';
import { auth, firestore, FirebaseUser } from '@/lib/firebase';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  name: string;
  email: string;
  onboardingComplete?: boolean;
  emailVerified?: boolean;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_CACHE_KEY = 'driiva-auth-cache';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load cached user for instant render
  useEffect(() => {
    SecureStore.getItemAsync(AUTH_CACHE_KEY).then((cached) => {
      if (cached) {
        try { setUser(JSON.parse(cached)); } catch {}
      }
    });
  }, []);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Point the analytics trail at this user before resolving the profile.
        // Anything emitted earlier in the session, which is most of onboarding,
        // is held unattributed and back-filled the moment this runs.
        setAnalyticsUser(firebaseUser.uid);
        const userData = await resolveUser(firebaseUser);
        setUser(userData);
        SecureStore.setItemAsync(AUTH_CACHE_KEY, JSON.stringify(userData));
      } else {
        // Clears the pending queue too, so one person's actions can never be
        // written against whoever signs in next on the same handset.
        setAnalyticsUser(null);
        setUser(null);
        SecureStore.deleteItemAsync(AUTH_CACHE_KEY);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await auth().signInWithEmailAndPassword(email, password);
    track('signed_in');
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const { user: fbUser } = await auth().createUserWithEmailAndPassword(email, password);
    await fbUser.updateProfile({ displayName: name });
    // The user doc is provisioned server-side by the provisionUserOnSignup
    // Auth trigger, same as the web app; the doc's displayName may be null
    // when the trigger races this updateProfile, and resolveUser falls back
    // to the Auth profile name for exactly that case. Writing the doc from
    // the client here too was what broke account creation on TestFlight: the
    // payload carried no `uid` and moved `createdAt`/`createdBy`, so
    // firestore.rules denied it whether the trigger's doc had landed yet or
    // not, and signup threw after the Auth user already existed.
    // tests/rules/users.test.ts pins the denial.
    track('account_created');
  }, []);

  const logout = useCallback(async () => {
    await auth().signOut();
    await SecureStore.deleteItemAsync(AUTH_CACHE_KEY);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await auth().sendPasswordResetEmail(email);
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    const fbUser = auth().currentUser;
    if (!fbUser) return;
    // Merge-set rather than update: update() throws NOT_FOUND if the
    // provisioning trigger ever failed to land the doc, which would strand
    // the driver on the last onboarding screen with no way forward. The web
    // client made the same call for the same reason.
    await firestore().collection('users').doc(fbUser.uid).set(
      {
        onboardingComplete: true,
        onboarding: { completedAt: firestore.FieldValue.serverTimestamp() },
      },
      { merge: true },
    );
    // Emitted after the write lands, never before: an onboarding_completed
    // event recorded ahead of the gate flipping would report a funnel the
    // product did not actually deliver.
    track('onboarding_completed');
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, onboardingComplete: true };
      SecureStore.setItemAsync(AUTH_CACHE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, resetPassword, markOnboardingComplete }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Resolve Firebase user to Driiva user shape
async function resolveUser(fbUser: FirebaseUser): Promise<User> {
  const doc = await firestore().collection('users').doc(fbUser.uid).get();
  const data = doc.data();

  return {
    id: fbUser.uid,
    name: data?.displayName || data?.fullName || fbUser.displayName || 'Driver',
    email: fbUser.email || '',
    onboardingComplete: data?.onboardingComplete ?? false,
    emailVerified: fbUser.emailVerified,
    isAdmin: data?.isAdmin ?? false,
  };
}

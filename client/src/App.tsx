import React, { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Router, Route, Switch, Redirect, useLocation } from 'wouter';
import gradientBackground from './assets/gradient-background.png';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import { HomeRedirect } from './components/HomeRedirect';
import { Toaster } from './components/ui/toaster';

// ─── Eagerly loaded: critical user journey pages ─────────────────────────
// These are loaded in the initial bundle so navigation is instant.
import Welcome from './pages/welcome';
import Signup from './pages/signup';
import SignIn from './pages/signin';
import Demo from './pages/demo';
import QuickOnboarding from './pages/quick-onboarding';
import Dashboard from './pages/dashboard';
import Trips from './pages/trips';
import Profile from './pages/profile';
import Settings from './pages/settings';

// ─── Lazy-loaded: secondary pages (split into separate chunks) ───────────
const Permissions = lazy(() => import('./pages/permissions'));
const CheckoutPage = lazy(() => import('./pages/checkout'));
const Rewards = lazy(() => import('./pages/rewards'));
const Support = lazy(() => import('./pages/support'));
const TripRecording = lazy(() => import('./pages/trip-recording'));
const LeaderboardPage = lazy(() => import('./pages/leaderboard'));
const InvitePage = lazy(() => import('./pages/invite'));
const PolicyPage = lazy(() => import('./pages/policy'));
const Terms = lazy(() => import('./pages/terms'));
const Privacy = lazy(() => import('./pages/privacy'));
const TrustPage = lazy(() => import('./pages/trust'));
const Achievements = lazy(() => import('./pages/achievements'));
const TripDetail = lazy(() => import('./pages/trip-detail'));
const ForgotPassword = lazy(() => import('./pages/forgot-password'));
const VerifyEmail = lazy(() => import('./pages/verify-email'));
const AdminFeedback = lazy(() => import('./pages/admin/feedback'));
const AdminOverview = lazy(() => import('./pages/admin/index'));
const AdminUsers = lazy(() => import('./pages/admin/users'));
const AdminTrips = lazy(() => import('./pages/admin/trips'));
const AdminSystem = lazy(() => import('./pages/admin/system'));
const AdminMonitoring = lazy(() => import('./pages/admin/monitoring'));

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OnlineStatusProvider, useOnlineStatusContext } from './contexts/OnlineStatusContext';
import OfflineBanner from './components/OfflineBanner';
import InstallPrompt from './components/InstallPrompt';
import SplashScreen from './components/SplashScreen';
import BrandedLoader from './components/BrandedLoader';
import PageTransition from './components/PageTransition';
import { ErrorBoundary } from './components/ErrorBoundary';
import { usePendingInvite } from './hooks/usePendingInvite';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [timedOut, setTimedOut] = React.useState(false);

  // Wait for the admin flag to resolve. With the new fast-path AuthContext,
  // loading=false happens quickly but isAdmin may arrive via background enrichment.
  // Give it up to 8 seconds (covers Firestore cold-cache + network latency).
  React.useEffect(() => {
    if (loading || user?.isAdmin) return;
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [loading, user?.isAdmin]);

  // Reset timeout if user changes (e.g. admin flag arrives from enrichment)
  React.useEffect(() => {
    if (user?.isAdmin) {
      setTimedOut(false);
    }
  }, [user?.isAdmin]);

  // Still waiting for auth or admin flag
  if (loading || (!user?.isAdmin && !timedOut)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/60 text-xs">Verifying admin access…</p>
      </div>
    );
  }
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <p className="text-white/60 text-lg mb-2">Access denied</p>
          <p className="text-white/60 text-sm mb-1">Your account does not have admin privileges.</p>
          <p className="text-white/55 text-xs">Signed in as: {user?.email ?? 'unknown'}</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Branded loader shown while lazy pages load — matches gradient from SplashScreen */
function PageFallback() {
  return <BrandedLoader />;
}

export default function App() {
  return (
    <ErrorBoundary level="root" name="Driiva">
      <QueryClientProvider client={queryClient}>
        <SplashScreen>
          <Router>
            <AuthProvider>
              <OnlineStatusProvider>
                <AppContent />
              </OnlineStatusProvider>
            </AuthProvider>
          </Router>
        </SplashScreen>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { isOnline } = useOnlineStatusContext();
  const { loading, user } = useAuth();
  const [location] = useLocation();

  // Redeems an invite stashed before sign-up, once there is a user to attach
  // the friendship to. Without this the code dies at the sign-up redirect and
  // the friendship silently never forms.
  usePendingInvite(user?.id ?? null);

  // Block all route rendering until auth state is resolved — prevents white
  // flash and false redirects to /verify-email for already-authenticated users.
  if (loading) return <BrandedLoader />;

  return (
    <div className={`App ${!isOnline ? 'pt-[52px]' : ''}`}>
      <OfflineBanner />
      <InstallPrompt />
      <div
        className="driiva-gradient-bg"
        style={{
          backgroundImage: `url(${gradientBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      <Suspense fallback={<PageFallback />}>
        <PageTransition>
        {/* Keyed on location so navigating away from a crashed route clears
            the boundary. Without the key a caught error would persist and the
            next page would render the fallback instead of itself. */}
        <ErrorBoundary key={location} level="route" name="This page">
        <Switch>
          {/* Public routes */}
          <Route path="/" component={Welcome} />
          <Route path="/welcome" component={Welcome} />
          <Route path="/terms" component={Terms} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/trust" component={TrustPage} />
          {/* Invite deep link. Public: an invited person may not have an
              account yet, and the page carries the code through sign-up. */}
          <Route path="/invite/:code" component={InvitePage} />

          {/* Auth routes - redirect to dashboard if already logged in */}
          <Route path="/signin">
            <PublicOnlyRoute redirectTo="/dashboard">
              <SignIn />
            </PublicOnlyRoute>
          </Route>
          <Route path="/login">
            <PublicOnlyRoute redirectTo="/dashboard">
              <SignIn />
            </PublicOnlyRoute>
          </Route>
          <Route path="/signup">
            <PublicOnlyRoute redirectTo="/dashboard">
              <Signup />
            </PublicOnlyRoute>
          </Route>
          <Route path="/forgot-password">
            <PublicOnlyRoute redirectTo="/dashboard">
              <ForgotPassword />
            </PublicOnlyRoute>
          </Route>

          {/* Semi-protected routes (onboarding flow) */}
          <Route path="/permissions" component={Permissions} />
          {/* quick-onboarding.tsx is the single canonical onboarding flow (DEC-5) */}
          <Route path="/onboarding" component={QuickOnboarding} />

          {/* Redirect legacy /home: dashboard if auth/demo, else welcome */}
          <Route path="/home" component={HomeRedirect} />

          {/* Protected routes - require authentication */}
          <Route path="/dashboard">
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          </Route>
          <Route path="/trips/:tripId">
            <ProtectedRoute><TripDetail /></ProtectedRoute>
          </Route>
          <Route path="/trips">
            <ProtectedRoute><Trips /></ProtectedRoute>
          </Route>
          <Route path="/rewards">
            <ProtectedRoute><Rewards /></ProtectedRoute>
          </Route>
          <Route path="/profile">
            <ProtectedRoute><Profile /></ProtectedRoute>
          </Route>
          <Route path="/support" component={Support} />
          <Route path="/trip-recording">
            <ProtectedRoute><TripRecording /></ProtectedRoute>
          </Route>
          <Route path="/leaderboard">
            <ProtectedRoute><LeaderboardPage /></ProtectedRoute>
          </Route>
          <Route path="/policy">
            <ProtectedRoute><PolicyPage /></ProtectedRoute>
          </Route>
          <Route path="/checkout">
            <ProtectedRoute><CheckoutPage /></ProtectedRoute>
          </Route>
          <Route path="/demo" component={Demo} />
          <Route path="/quick-onboarding">
            {/* Skip both checks: new users verify email after onboarding, not before */}
            <ProtectedRoute skipOnboardingCheck skipEmailVerificationCheck><QuickOnboarding /></ProtectedRoute>
          </Route>
          <Route path="/verify-email">
            {/* Accessible to authenticated but unverified users */}
            <ProtectedRoute skipOnboardingCheck skipEmailVerificationCheck><VerifyEmail /></ProtectedRoute>
          </Route>
          <Route path="/settings">
            <ProtectedRoute><Settings /></ProtectedRoute>
          </Route>
          <Route path="/achievements">
            <ProtectedRoute><Achievements /></ProtectedRoute>
          </Route>

          {/* Admin routes */}
          <Route path="/admin/monitoring">
            <ProtectedRoute>
              <AdminRoute><AdminMonitoring /></AdminRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/admin/users">
            <ProtectedRoute>
              <AdminRoute><AdminUsers /></AdminRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/admin/trips">
            <ProtectedRoute>
              <AdminRoute><AdminTrips /></AdminRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/admin/feedback">
            <ProtectedRoute>
              <AdminRoute><AdminFeedback /></AdminRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/admin/system">
            <ProtectedRoute>
              <AdminRoute><AdminSystem /></AdminRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/admin">
            <ProtectedRoute>
              <AdminRoute><AdminOverview /></AdminRoute>
            </ProtectedRoute>
          </Route>

          {/* Dev-only: proves the route boundary renders its fallback. */}
          {import.meta.env.DEV && (
            <Route path="/__boundary-check">
              {() => {
                throw new Error('Deliberate throw: route ErrorBoundary check.');
              }}
            </Route>
          )}

          <Route>{() => <Redirect to="/" />}</Route>
        </Switch>
        </ErrorBoundary>
        </PageTransition>
      </Suspense>
      {/*
        Mounted once for the whole app. Without this every toast() call in the
        codebase writes to the use-toast memory store and renders nothing.
      */}
      <Toaster />
    </div>
  );
}

/**
 * DASHBOARD PAGE
 * ==============
 * Main dashboard with real-time Firestore data.
 * 
 * Features:
 *   - Real-time driving score and stats
 *   - Recent trips list
 *   - Community pool status
 *   - Policy information
 *   - Demo mode support for testing
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { getTripPoints } from '@/lib/firestore';
import {
  Bell, FileText, AlertCircle, Shield, ExternalLink,
} from 'lucide-react';
import { PageWrapper } from '../components/PageWrapper';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from '@/hooks/useDashboardData';
import { useCommunityData } from '@/hooks/useCommunityData';
import { useBetaEstimate } from '@/hooks/useBetaEstimate';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';
import { BetaEstimateCard } from '@/components/BetaEstimateCard';
import { PullToRefreshIndicator } from '@/components/PullToRefresh';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useHaptics } from '@/hooks/useHaptics';
import { container, item } from '@/lib/animations';

// The types, skeletons, helpers and cards this page is built from live in
// client/src/components/dashboard/, one module per concern.
import type { DemoUser } from '@/components/dashboard/types';
import {
  ScoreCardSkeleton,
  TripsSkeleton,
  PoolSkeleton,
} from '@/components/dashboard/DashboardSkeletons';
import { getGreeting, calculateSurplus } from '@/components/dashboard/helpers';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DrivingScoreCard } from '@/components/dashboard/DrivingScoreCard';
import { AiDriivaCard } from '@/components/dashboard/AiDriivaCard';
import { GpsMapCard } from '@/components/dashboard/GpsMapCard';
import { TripsCard } from '@/components/dashboard/TripsCard';
import { CommunityPoolCard } from '@/components/dashboard/CommunityPoolCard';
import { RefundGoalsCard } from '@/components/dashboard/RefundGoalsCard';
import { AchievementsCard } from '@/components/dashboard/AchievementsCard';
// ============================================================================
// COMPONENT
// ============================================================================

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  // Demo mode — read once on mount
  const [demoUser, setDemoUser] = useState<DemoUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const demoModeActive = sessionStorage.getItem('driiva-demo-mode') === 'true';
    if (!demoModeActive) return null;
    try {
      const raw = sessionStorage.getItem('driiva-demo-user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const isDemoMode = demoUser !== null;

  // UI state
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  // Resolve userId from AuthContext (no redundant onAuthStateChanged)
  const firebaseUserId = isDemoMode ? null : (user?.id ?? null);

  // Real-time Firestore data
  const { data: dashboardData, loading: dataLoading, error: dataError, refresh } = useDashboardData(
    firebaseUserId
  );

  // Community pool and leaderboard data
  const {
    pool: communityPool,
    poolLoading,
    userShare,
    leaderboard,
  } = useCommunityData(firebaseUserId);

  // Beta estimate (premium + refund)
  const { estimate: betaEstimate, loading: betaEstimateLoading, error: betaEstimateError, refresh: refreshBetaEstimate } = useBetaEstimate(firebaseUserId);

  // Push notifications — opt-in prompt and foreground message handling
  const { toast } = useToast();
  const { permission: notificationPermission, requestPermission: requestNotificationPermission, loading: notificationLoading } = usePushNotifications({
    userId: firebaseUserId,
    onForegroundMessage: (payload: { title: string; body: string }) => {
      toast({ title: payload.title, description: payload.body });
    },
  });

  // Haptics
  const haptics = useHaptics();

  // Pull-to-refresh
  const handlePullRefresh = useCallback(async () => {
    refresh();
    refreshBetaEstimate();
    // Small delay so the spinner is visible
    await new Promise(r => setTimeout(r, 800));
  }, [refresh, refreshBetaEstimate]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: handlePullRefresh,
    disabled: isDemoMode,
  });

  // Handle logout — navigate FIRST to prevent ProtectedRoute from intercepting
  const handleLogout = () => {
    setShowDropdown(false);
    setLocation("/");
    logout();
  };

  // Derive display values
  const displayName = isDemoMode 
    ? (demoUser?.first_name && demoUser?.last_name 
        ? `${demoUser.first_name} ${demoUser.last_name}` 
        : demoUser?.name || 'Driver')
    : (dashboardData?.displayName || user?.name || 'Driver');

  // Use demo data or real Firestore data
  const drivingScore = isDemoMode
    ? (demoUser?.drivingScore || demoUser?.overall_score || 82)
    : (dashboardData?.drivingScore ?? 0);
  
  const premiumAmount = isDemoMode 
    ? (demoUser?.premiumAmount || demoUser?.premium_amount || 1500) 
    : (dashboardData?.premiumAmount || 0);
  
  const totalMiles = isDemoMode 
    ? (demoUser?.totalMiles || 0) 
    : (dashboardData?.totalMiles || 0);
  
  const trips = isDemoMode 
    ? (demoUser?.trips || []) 
    : (dashboardData?.trips || []);
  
  // Pool data from useCommunityData (or fallback to useDashboardData)
  const poolTotal = isDemoMode 
    ? (demoUser?.poolTotal || 105000) 
    : (communityPool?.totalPoolPounds || dashboardData?.poolTotal || 0);
  
  const poolShare = isDemoMode 
    ? (demoUser?.poolShare || 0) 
    : (userShare?.projectedRefundPounds || dashboardData?.poolShare || 0);
  
  // No pool document means no safety factor. The `|| 1.0` on the end of this
  // chain used to turn that absence into a rendered "Safety Factor 100%".
  const safetyFactor = isDemoMode
    ? (demoUser?.safetyFactor ?? 0.85)
    : (communityPool?.safetyFactor ?? dashboardData?.safetyFactor ?? null);
  
  const activeParticipants = isDemoMode 
    ? 1247 
    : (communityPool?.activeParticipants || dashboardData?.activeParticipants || 0);
  
  const poolDaysRemaining = communityPool?.daysRemaining || 0;
  
  const userSharePercentage = isDemoMode 
    ? 2.5 
    : (userShare?.sharePercentage || 0);
  
  const userRank = isDemoMode 
    ? 14 
    : (leaderboard?.userRank || null);

  // Only show a real policy number — never expose a hardcoded placeholder
  const policyNumber = dashboardData?.policyNumber || null;
  const isNewUser = !isDemoMode && dashboardData?.totalTrips === 0;

  // Calculate surplus projection
  const surplusProjection = isDemoMode && demoUser?.projectedRefund 
    ? demoUser.projectedRefund 
    : (dashboardData?.projectedRefund || calculateSurplus(drivingScore, premiumAmount));

  // Fetch last trip's GPS points for the map polyline
  const [lastTripRoutePoints, setLastTripRoutePoints] = useState<Array<{ lat: number; lng: number }>>([]);
  useEffect(() => {
    if (isDemoMode || !firebaseUserId || !isFirebaseConfigured || !db) return;
    const lastTrip = dashboardData?.trips?.[0];
    if (!lastTrip?.id) return;

    let cancelled = false;
    (async () => {
      try {
        // Wave 0 (0g): reads through getTripPoints so the batches
        // subcollection the recorder actually writes to is included. Reading
        // the parent doc's points array alone left this empty for every real
        // trip, so the dashboard polyline never appeared.
        const points = await getTripPoints(lastTrip.id);
        if (cancelled) return;
        if (points.length >= 2) {
          const sorted = [...points].sort((a, b) => a.t - b.t);
          setLastTripRoutePoints(sorted.map((p) => ({ lat: p.lat, lng: p.lng })));
        }
      } catch (err) {
        console.warn('[Dashboard] Failed to fetch last trip points for map:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isDemoMode, firebaseUserId, dashboardData?.trips]);

  // Loading state — rely on AuthContext loading, not a separate check
  const isLoading = (!isDemoMode && !user) || (!isDemoMode && dataLoading && !dashboardData);

  return (
    <>
      {isLoading ? (
        <PageWrapper>
          <div className="pb-24 text-white">
            {/* Header skeleton */}
            <div className="flex items-start justify-between mb-6 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/10" />
                <div>
                  <div className="h-6 w-20 bg-white/10 rounded mb-2" />
                  <div className="h-4 w-32 bg-white/10 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <div className="w-10 h-10 rounded-full bg-white/10" />
              </div>
            </div>
            
            <div className="h-8 w-32 bg-white/10 rounded mb-4 animate-pulse" />
            
            <ScoreCardSkeleton />
            <TripsSkeleton />
            <PoolSkeleton />
          </div>
        </PageWrapper>
      ) : (
    <PageWrapper>
      <div className="pb-24 text-white" {...pullToRefresh.handlers}>
        {/* Pull-to-refresh indicator */}
        <PullToRefreshIndicator
          pullDistance={pullToRefresh.pullDistance}
          progress={pullToRefresh.progress}
          refreshing={pullToRefresh.refreshing}
        />

        {/* Push notification opt-in — only when permission not yet asked/granted */}
        {!isDemoMode && firebaseUserId && notificationPermission === 'default' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-white/80 text-sm">Get notified when trips are scored and refunds are ready</span>
            </div>
            <button
              onClick={() => requestNotificationPermission()}
              disabled={notificationLoading}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {notificationLoading ? '…' : 'Enable'}
            </button>
          </motion.div>
        )}

        {/* Email verification banner — soft prompt, not a hard block */}
        {user && user.emailVerified === false && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)' }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-yellow-200 text-sm">Verify your email to secure your account</span>
            </div>
            <button
              onClick={() => setLocation('/verify-email')}
              className="text-xs font-medium text-yellow-300 hover:text-yellow-100 whitespace-nowrap"
            >
              Verify →
            </button>
          </motion.div>
        )}

        {/* Header */}
        <DashboardHeader
          isDemoMode={isDemoMode}
          displayName={displayName}
          policyNumber={policyNumber}
          dataLoading={dataLoading}
          refresh={refresh}
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          showNotifications={showNotifications}
          setShowNotifications={setShowNotifications}
          handleLogout={handleLogout}
        />

        {/* Personalised greeting — time-of-day + full registered name */}
        <h2 className="text-2xl font-bold text-white mb-4">
          {getGreeting()}, {displayName}
        </h2>

        {/* Error banner */}
        {dataError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Failed to load some data. Pull to refresh.</span>
          </motion.div>
        )}

        {/* Staggered card container */}
        <motion.div variants={container} initial="hidden" animate="show">

        {/* Driving Score Card */}
        <DrivingScoreCard
          isNewUser={isNewUser}
          isDemoMode={isDemoMode}
          drivingScore={drivingScore}
          dashboardData={dashboardData}
        />

        {/* AI Driiva Card — always visible, zero-latency static insight */}
        <AiDriivaCard drivingScore={drivingScore} />

        {/* Beta Estimate Card (non-binding premium + refund) */}
        {!isDemoMode && (
          <motion.div variants={item}>
            <BetaEstimateCard
              estimate={betaEstimate}
              loading={betaEstimateLoading}
              error={betaEstimateError}
              onRefresh={refreshBetaEstimate}
            />
          </motion.div>
        )}

        {/* GPS Map Card — collapsible */}
        <GpsMapCard
          mapExpanded={mapExpanded}
          setMapExpanded={setMapExpanded}
          lastTripRoutePoints={lastTripRoutePoints}
        />

        {/* Your Trips Card */}
        <TripsCard
          trips={trips}
          totalMiles={totalMiles}
          haptics={haptics}
          setLocation={setLocation}
        />

        {/* Community Pool Card */}
        <CommunityPoolCard
          isDemoMode={isDemoMode}
          poolLoading={poolLoading}
          poolTotal={poolTotal}
          poolShare={poolShare}
          poolDaysRemaining={poolDaysRemaining}
          userSharePercentage={userSharePercentage}
          safetyFactor={safetyFactor}
          activeParticipants={activeParticipants}
          userRank={userRank}
          setLocation={setLocation}
        />

        {/* Refund Goals Card */}
        <RefundGoalsCard
          surplusProjection={surplusProjection}
          drivingScore={drivingScore}
          premiumAmount={premiumAmount}
          isNewUser={isNewUser}
        />

        {/* Achievements Card */}
        <AchievementsCard
          isDemoMode={isDemoMode}
          dashboardData={dashboardData}
          setLocation={setLocation}
        />

        {/* Bottom Action Buttons */}
        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setLocation('/profile')}
            className="instrument-card flex items-center justify-center gap-2 py-4 hover:bg-white/15 transition-colors"
          >
            <FileText className="w-5 h-5 text-white" />
            <span className="font-medium text-white">Profile</span>
          </button>
          
          <button
            onClick={() => setLocation('/settings')}
            className="instrument-card flex items-center justify-center gap-2 py-4 hover:bg-white/15 transition-colors"
          >
            <AlertCircle className="w-5 h-5 text-white" />
            <span className="font-medium text-white">Settings</span>
          </button>
        </motion.div>

        </motion.div>{/* close staggered container */}

        {/* Trust Centre footer row */}
        <div className="flex items-center justify-center gap-4 pt-2 pb-2">
          <button
            onClick={() => setLocation('/trust')}
            className="flex items-center gap-1 text-white/55 text-[13px] hover:text-white/60 transition-colors"
          >
            <Shield className="w-3 h-3" />
            Trust Centre
          </button>
          <span className="text-white/20 text-[13px]">·</span>
          <button
            onClick={() => setLocation('/terms')}
            className="text-white/55 text-[13px] hover:text-white/60 transition-colors"
          >
            Terms
          </button>
          <span className="text-white/20 text-[13px]">·</span>
          <button
            onClick={() => setLocation('/privacy')}
            className="flex items-center gap-1 text-white/55 text-[13px] hover:text-white/60 transition-colors"
          >
            Privacy
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </PageWrapper>
      )}
      <BottomNav />
    </>
  );
}

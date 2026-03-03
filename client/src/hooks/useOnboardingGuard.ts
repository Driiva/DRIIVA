/**
 * ONBOARDING GUARD HOOK
 * =====================
 * Hook to check if user has completed onboarding.
 * Redirects to /onboarding if not completed.
 * 
 * Usage:
 *   const { isReady, needsOnboarding } = useOnboardingGuard();
 *   if (!isReady) return <Loading />;
 *   // Component renders only when ready
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

export interface OnboardingGuardResult {
  /** True when the check is complete and component can render */
  isReady: boolean;
  /** True if user needs to complete onboarding */
  needsOnboarding: boolean;
  /** True if user is authenticated */
  isAuthenticated: boolean;
  /** Current user's onboarding status */
  onboardingCompleted: boolean;
  /** Loading state */
  loading: boolean;
}

export function useOnboardingGuard(
  options: {
    /** If true, automatically redirect to /onboarding when needed */
    autoRedirect?: boolean;
    /** Routes to skip onboarding check (e.g., ['/onboarding', '/quick-onboarding']) */
    skipRoutes?: string[];
  } = {}
): OnboardingGuardResult {
  const { autoRedirect = true, skipRoutes = ['/onboarding', '/quick-onboarding'] } = options;
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  
  const [isReady, setIsReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (skipRoutes.includes(location)) {
      setIsReady(true);
      setLoading(false);
      return;
    }

    const isDemoMode = localStorage.getItem('driiva-demo-mode') === 'true';
    if (isDemoMode) {
      setIsAuthenticated(true);
      setOnboardingCompleted(true);
      setNeedsOnboarding(false);
      setIsReady(true);
      setLoading(false);
      return;
    }

    if (user) {
      setIsAuthenticated(true);
      const completed = user.onboardingComplete === true;
      setOnboardingCompleted(completed);
      setNeedsOnboarding(!completed);

      if (!completed && autoRedirect) {
        setLocation('/quick-onboarding');
      }

      setIsReady(completed || !autoRedirect);
      setLoading(false);
      return;
    }

    // No user from context yet — either still loading or not authenticated
    setIsAuthenticated(false);
    setOnboardingCompleted(false);
    setNeedsOnboarding(false);
    setIsReady(true);
    setLoading(false);
  }, [user, location, autoRedirect, skipRoutes, setLocation]);

  return {
    isReady,
    needsOnboarding,
    isAuthenticated,
    onboardingCompleted,
    loading,
  };
}

export default useOnboardingGuard;

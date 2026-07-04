/**
 * QUICK ONBOARDING PAGE
 * =====================
 * A multi-step onboarding flow that must be completed before accessing the dashboard.
 *
 * Steps:
 *   1.  Welcome — Explain what Driiva does
 *   2.  Data Consent — GDPR-compliant explicit opt-in for telematics data
 *   3.  Location — Request GPS permission and test a single read
 *   4.  Annual Mileage
 *   5.  Age + Postcode
 *   6.  Vehicle Details (make, model, year)
 *   7.  No-Claims Bonus
 *   8.  Referral Source
 *   9.  Current Insurer
 *   10. Current Premium
 *   11. Confirm — User acknowledges "drive to earn rewards" concept
 *   12. Celebration
 *
 * On completion, writes onboardingComplete via a single owner-gated Firestore
 * write (Firestore is the sole source of truth, per DEC-4 - no PostgreSQL
 * round-trip in this path). Partial progress is drafted to localStorage so
 * the flow can resume after a closed tab.
 */

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { GpsTestResult } from './onboarding/types';

// Step components
import { StepWelcome } from './onboarding/steps/StepWelcome';
import { StepDataConsent } from './onboarding/steps/StepDataConsent';
import { StepGpsPermission } from './onboarding/steps/StepGpsPermission';
import { StepAnnualMileage } from './onboarding/steps/StepAnnualMileage';
import { StepAgePostcode } from './onboarding/steps/StepAgePostcode';
import { StepVehicleDetails } from './onboarding/steps/StepVehicleDetails';
import { StepNoClaimsBonus } from './onboarding/steps/StepNoClaimsBonus';
import { StepReferralSource } from './onboarding/steps/StepReferralSource';
import { StepCurrentInsurer } from './onboarding/steps/StepCurrentInsurer';
import { StepCurrentPremium } from './onboarding/steps/StepCurrentPremium';
import { StepConfirm } from './onboarding/steps/StepConfirm';
import { StepCelebration } from './onboarding/steps/StepCelebration';

const TOTAL_STEPS = 12;

export default function QuickOnboarding() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, setUser } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  // Tracks whether the saved draft (if any) has been restored, so the persist
  // effect below does not overwrite a stored draft before it is hydrated.
  const [draftHydrated, setDraftHydrated] = useState(false);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [gpsResult, setGpsResult] = useState<GpsTestResult | null>(null);

  // Data consent (GDPR explicit opt-in — step 2)
  const [dataConsentGiven, setDataConsentGiven] = useState(false);

  // Soft onboarding data
  const [annualMileage, setAnnualMileage] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [postcode, setPostcode] = useState<string>('');
  const [vehicleMake, setVehicleMake] = useState<string>('');
  const [vehicleModel, setVehicleModel] = useState<string>('');
  const [vehicleYear, setVehicleYear] = useState<string>('');
  const [noClaimsYears, setNoClaimsYears] = useState<number | null>(null);
  const [referralSource, setReferralSource] = useState<string>('');
  const [currentInsurer, setCurrentInsurer] = useState<string>('');
  const [currentPremiumPounds, setCurrentPremiumPounds] = useState<string>('');

  // Use AuthContext instead of a separate onAuthStateChanged listener.
  // AuthContext already tracks the user and their onboarding status,
  // so we avoid a redundant Firebase + Firestore round-trip.
  useEffect(() => {
    if (authLoading) return; // Wait for AuthContext to resolve

    // Check demo mode
    const isDemoMode = sessionStorage.getItem('driiva-demo-mode') === 'true';
    if (isDemoMode) {
      setLocation('/dashboard');
      return;
    }

    if (!user) {
      // Not logged in, redirect to signin
      setLocation('/signin');
      return;
    }

    // If user already completed onboarding, skip to dashboard
    if (user.onboardingComplete) {
      setLocation('/dashboard');
      return;
    }
    // Otherwise, user needs onboarding — let them through
  }, [user, authLoading, setLocation]);

  // Draft is scoped per user so a shared device never leaks one person's
  // partial answers into another account's onboarding.
  const draftKey = user ? `driiva-onboarding-draft-${user.id}` : null;

  // Hydrate any saved draft once the user resolves, so closing the tab mid-flow
  // does not lose entered answers. Restores field values and the saved step
  // (never the celebration step, which only follows a successful save).
  useEffect(() => {
    if (draftHydrated || !draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (typeof draft.dataConsentGiven === 'boolean') setDataConsentGiven(draft.dataConsentGiven);
        if (typeof draft.annualMileage === 'string') setAnnualMileage(draft.annualMileage);
        if (typeof draft.age === 'string') setAge(draft.age);
        if (typeof draft.postcode === 'string') setPostcode(draft.postcode);
        if (typeof draft.vehicleMake === 'string') setVehicleMake(draft.vehicleMake);
        if (typeof draft.vehicleModel === 'string') setVehicleModel(draft.vehicleModel);
        if (typeof draft.vehicleYear === 'string') setVehicleYear(draft.vehicleYear);
        if (typeof draft.noClaimsYears === 'number') setNoClaimsYears(draft.noClaimsYears);
        if (typeof draft.referralSource === 'string') setReferralSource(draft.referralSource);
        if (typeof draft.currentInsurer === 'string') setCurrentInsurer(draft.currentInsurer);
        if (typeof draft.currentPremiumPounds === 'string') setCurrentPremiumPounds(draft.currentPremiumPounds);
        if (typeof draft.currentStep === 'number' && draft.currentStep >= 1 && draft.currentStep < TOTAL_STEPS) {
          setCurrentStep(draft.currentStep);
        }
      }
    } catch (err) {
      console.warn('[QuickOnboarding] Failed to restore onboarding draft:', err);
    }
    setDraftHydrated(true);
  }, [draftKey, draftHydrated]);

  // Persist the draft on every change once hydrated. The celebration step is
  // excluded so a completed flow does not re-save a stale draft.
  useEffect(() => {
    if (!draftHydrated || !draftKey || currentStep >= TOTAL_STEPS) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        currentStep,
        dataConsentGiven,
        annualMileage,
        age,
        postcode,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        noClaimsYears,
        referralSource,
        currentInsurer,
        currentPremiumPounds,
      }));
    } catch (err) {
      // Quota or private-mode errors are non-critical — the terminal write still persists everything.
      console.warn('[QuickOnboarding] Failed to save onboarding draft:', err);
    }
  }, [
    draftHydrated, draftKey, currentStep, dataConsentGiven, annualMileage, age, postcode,
    vehicleMake, vehicleModel, vehicleYear, noClaimsYears, referralSource, currentInsurer,
    currentPremiumPounds,
  ]);

  /**
   * Persist GDPR data consent to Firestore when user grants it. Returns true
   * when the consent (and its step-2 timestamp) is safely stored, or when there
   * is no Firestore to write to. Returns false on a write failure so the caller
   * can keep the user on the consent step rather than advancing silently.
   */
  const persistDataConsent = async (): Promise<boolean> => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser || !isFirebaseConfigured || !db) {
      // Nothing to persist to (e.g. Firebase not configured) — let the user continue.
      return true;
    }
    try {
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        dataConsentGiven: true,
        dataConsentTimestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('[QuickOnboarding] Failed to persist data consent:', err);
      return false;
    }
  };

  /**
   * Test GPS by requesting a single position read
   */
  const testGpsPermission = async () => {
    setGpsStatus('testing');
    setGpsResult(null);

    try {
      // First check if geolocation is available
      if (!navigator.geolocation) {
        setGpsStatus('error');
        setGpsResult({ success: false, error: 'GPS not available on this device' });
        return;
      }

      // Request a single position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }
        );
      });

      setGpsStatus('success');
      setGpsResult({
        success: true,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
      });
    } catch (error: unknown) {
      setGpsStatus('error');

      let errorMessage = 'Could not get your location';
      const geoError = error as GeolocationPositionError;
      if (geoError.code === 1) {
        errorMessage = 'Location permission denied. Please enable it in your browser settings.';
      } else if (geoError.code === 2) {
        errorMessage = 'Location unavailable. Please check your device settings.';
      } else if (geoError.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      }

      setGpsResult({ success: false, error: errorMessage });
    }
  };

  /**
   * Persist onboarding completion as a single owner-gated Firestore write, then
   * advance to celebration. Firestore is the sole source of truth (per DEC-4) -
   * there is no PostgreSQL round-trip in this path, so a brand-new user whose
   * Neon row hasn't landed yet is never blocked here. If the write fails we
   * keep the user on the confirm step (no data lost) and surface a toast.
   */
  const handleComplete = async () => {
    if (!confirmed) return;

    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) {
      toast({
        title: "Couldn't finish setup",
        description: 'You appear to be signed out. Please sign in again and retry.',
        variant: 'destructive',
      });
      return;
    }

    if (!isFirebaseConfigured || !db) {
      toast({
        title: "Couldn't save your details",
        description: 'Something went wrong saving your onboarding. Check your connection and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    // The one authoritative write. onboardingComplete is the live gate field
    // AuthContext reads - do NOT write the dead '-ed' onboardingCompleted
    // vestige. Note: dataConsentTimestamp is intentionally NOT re-stamped here -
    // the real consent moment is recorded at step 2 by persistDataConsent.
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userDocRef, {
        onboardingComplete: true,
        gpsPermissionGranted: gpsStatus === 'success',
        dataConsentGiven: dataConsentGiven,
        annualMileage: annualMileage || null,
        age: age ? Number(age) : null,
        postcode: postcode ? postcode.trim().toUpperCase() : null,
        vehicle: (vehicleMake || vehicleModel || vehicleYear) ? {
          make: vehicleMake || null,
          model: vehicleModel || null,
          year: vehicleYear ? Number(vehicleYear) : null,
        } : null,
        noClaimsYears: noClaimsYears !== null ? noClaimsYears : null,
        referralSource: referralSource || null,
        currentInsurer: currentInsurer || null,
        currentPremiumPounds: currentPremiumPounds ? Number(currentPremiumPounds) : null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.error('[QuickOnboarding] Failed to save onboarding to Firestore:', err);
      setIsLoading(false);
      toast({
        title: "Couldn't save your details",
        description: 'Something went wrong saving your onboarding. Check your connection and try again.',
        variant: 'destructive',
      });
      return; // Stay on the confirm step — nothing entered is lost.
    }

    // Onboarding is persisted — clear the resume draft and advance to celebration.
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // Non-critical.
      }
    }

    setIsLoading(false);
    nextStep();
  };

  const goToDashboard = useCallback(() => {
    if (user) setUser({ ...user, onboardingComplete: true });
    setLocation('/dashboard');
  }, [setLocation, setUser]);

  /**
   * Handle navigation between steps
   */
  const nextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Show loading only while AuthContext is resolving (typically instant after signup)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050509] via-[#0a0a14] to-[#0a0a14] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-safe bg-gradient-to-br from-[#050509] via-[#0a0a14] to-[#0a0a14] flex flex-col relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#d4850a]/12 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#6366f1]/16 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-6 max-w-lg mx-auto w-full">
        {/* Progress indicator (hidden on celebration step) */}
        {currentStep < 12 && (
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i + 1 <= currentStep
                      ? 'bg-[#5b4dc9] w-5'
                      : 'bg-white/20 w-3.5'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-white/50 flex-shrink-0 ml-3">Step {currentStep} of 11</span>
          </div>
        )}

        {/* Step content */}
        <div className="flex-1 flex flex-col justify-start pt-1">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <StepWelcome nextStep={nextStep} />
            )}
            {currentStep === 2 && (
              <StepDataConsent
                nextStep={nextStep}
                prevStep={prevStep}
                dataConsentGiven={dataConsentGiven}
                setDataConsentGiven={setDataConsentGiven}
                persistDataConsent={persistDataConsent}
              />
            )}
            {currentStep === 3 && (
              <StepGpsPermission
                nextStep={nextStep}
                prevStep={prevStep}
                gpsStatus={gpsStatus}
                gpsResult={gpsResult}
                testGpsPermission={testGpsPermission}
              />
            )}
            {currentStep === 4 && (
              <StepAnnualMileage
                nextStep={nextStep}
                prevStep={prevStep}
                annualMileage={annualMileage}
                setAnnualMileage={setAnnualMileage}
              />
            )}
            {currentStep === 5 && (
              <StepAgePostcode
                nextStep={nextStep}
                prevStep={prevStep}
                age={age}
                setAge={setAge}
                postcode={postcode}
                setPostcode={setPostcode}
              />
            )}
            {currentStep === 6 && (
              <StepVehicleDetails
                nextStep={nextStep}
                prevStep={prevStep}
                vehicleMake={vehicleMake}
                setVehicleMake={setVehicleMake}
                vehicleModel={vehicleModel}
                setVehicleModel={setVehicleModel}
                vehicleYear={vehicleYear}
                setVehicleYear={setVehicleYear}
              />
            )}
            {currentStep === 7 && (
              <StepNoClaimsBonus
                nextStep={nextStep}
                prevStep={prevStep}
                noClaimsYears={noClaimsYears}
                setNoClaimsYears={setNoClaimsYears}
              />
            )}
            {currentStep === 8 && (
              <StepReferralSource
                nextStep={nextStep}
                prevStep={prevStep}
                referralSource={referralSource}
                setReferralSource={setReferralSource}
              />
            )}
            {currentStep === 9 && (
              <StepCurrentInsurer
                nextStep={nextStep}
                prevStep={prevStep}
                currentInsurer={currentInsurer}
                setCurrentInsurer={setCurrentInsurer}
              />
            )}
            {currentStep === 10 && (
              <StepCurrentPremium
                nextStep={nextStep}
                prevStep={prevStep}
                currentPremiumPounds={currentPremiumPounds}
                setCurrentPremiumPounds={setCurrentPremiumPounds}
              />
            )}
            {currentStep === 11 && (
              <StepConfirm
                nextStep={nextStep}
                prevStep={prevStep}
                confirmed={confirmed}
                setConfirmed={setConfirmed}
                isLoading={isLoading}
                handleComplete={handleComplete}
              />
            )}
            {currentStep === 12 && (
              <StepCelebration
                onContinue={goToDashboard}
                userName={user?.name}
                userEmail={user?.email}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/**
 * TESTS: Quick Onboarding Page (client/src/pages/quick-onboarding.tsx)
 * ======================================================================
 * Pins the progress-dot count against the "Step X of N" label so a future
 * change to TOTAL_STEPS can never desync the two again - both now derive
 * from the single PROGRESS_STEPS constant.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Router, Route, Switch } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import React from 'react';

globalThis.React = React;

// ---------------------------------------------------------------------------
// Mocks -- must be declared before component imports
// ---------------------------------------------------------------------------

const mockSetLocation = vi.fn();

vi.mock('wouter', async () => {
  const actual = await vi.importActual<typeof import('wouter')>('wouter');
  return {
    ...actual,
    useLocation: () => ['/quick-onboarding', mockSetLocation] as const,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  isFirebaseConfigured: true,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'uid-123', email: 'test@example.com', onboardingComplete: false },
    loading: false,
    setUser: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// The real step screens carry their own dependencies (webauthn, images,
// disclaimers). Stub them out so this test stays scoped to the progress
// indicator logic that lives directly in quick-onboarding.tsx.
vi.mock('../pages/onboarding/steps/StepWelcome', () => ({ StepWelcome: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepDataConsent', () => ({ StepDataConsent: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepGpsPermission', () => ({ StepGpsPermission: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepAnnualMileage', () => ({ StepAnnualMileage: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepAgePostcode', () => ({ StepAgePostcode: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepVehicleDetails', () => ({ StepVehicleDetails: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepNoClaimsBonus', () => ({ StepNoClaimsBonus: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepReferralSource', () => ({ StepReferralSource: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepCurrentInsurer', () => ({ StepCurrentInsurer: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepCurrentPremium', () => ({ StepCurrentPremium: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepConfirm', () => ({ StepConfirm: () => <div data-testid="step" /> }));
vi.mock('../pages/onboarding/steps/StepCelebration', () => ({ StepCelebration: () => <div data-testid="step" /> }));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------

import QuickOnboarding from '../pages/quick-onboarding';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderOnboarding() {
  const { hook } = memoryLocation({ path: '/quick-onboarding' });
  return render(
    <Router hook={hook}>
      <Switch>
        <Route path="/quick-onboarding"><QuickOnboarding /></Route>
      </Switch>
    </Router>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Onboarding progress indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders exactly as many dots as the "Step X of N" label claims (single source of truth)', () => {
    renderOnboarding();

    const label = screen.getByText(/^Step \d+ of \d+$/);
    const labelTotal = Number(label.textContent!.match(/of (\d+)/)![1]);
    const dots = screen.getAllByTestId('progress-dot');

    // The two numbers must always agree - this is the invariant the
    // 11-dots-for-12-steps bug broke. Both now derive from PROGRESS_STEPS,
    // so this can't drift even if TOTAL_STEPS changes in future.
    expect(dots.length).toBe(labelTotal);
  });

  it('pins the current known-good value: 11 dots for the 11 pre-celebration steps', () => {
    renderOnboarding();

    expect(screen.getAllByTestId('progress-dot')).toHaveLength(11);
    expect(screen.getByText('Step 1 of 11')).toBeInTheDocument();
  });
});

/**
 * Lives in the root test tree for the same reason as the other mobile unit
 * tests: mobile/ has its own Expo tsconfig the root vitest run cannot resolve
 * through, so the pure modules are imported directly.
 *
 * WHY THIS FILE EXISTS
 * Every onboarding screen used to hardcode its own `step` and `total` into
 * ProgressBar. That is fifteen independent places to get one sequence right,
 * and it was already wrong: location-priming and motion-priming both passed
 * step 9, so the bar did not move across that transition and the declared
 * total was never reached in distinct increments. Nothing failed, because
 * nothing was checking.
 *
 * The order now has one owner. These tests are what stop it drifting again.
 */
import { describe, it, expect } from 'vitest';

import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL,
  stepNumber,
  nextStep,
} from '../../mobile/lib/onboardingFlow';

describe('onboarding flow order', () => {
  it('has no duplicate steps', () => {
    expect(new Set(ONBOARDING_STEPS).size).toBe(ONBOARDING_STEPS.length);
  });

  it('reports a total that matches the number of steps', () => {
    expect(ONBOARDING_TOTAL).toBe(ONBOARDING_STEPS.length);
  });

  it('numbers steps from 1 with no gaps', () => {
    const numbers = ONBOARDING_STEPS.map((s) => stepNumber(s));
    expect(numbers).toEqual(ONBOARDING_STEPS.map((_, i) => i + 1));
  });

  it('starts at the landing screen and ends on the community handoff', () => {
    expect(ONBOARDING_STEPS[0]).toBe('index');
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe('community');
  });

  /**
   * The brief bans anything that requires the insurance product to exist.
   * quote.tsx is kept on disk so the Root and Stripe paths stay dormant rather
   * than deleted, but it must not sit in the path a beta user walks.
   */
  it('does not route through the insurance quote screen', () => {
    expect(ONBOARDING_STEPS).not.toContain('quote');
  });

  it('gives every step a successor except the last', () => {
    for (let i = 0; i < ONBOARDING_STEPS.length - 1; i++) {
      expect(nextStep(ONBOARDING_STEPS[i])).toBe(ONBOARDING_STEPS[i + 1]);
    }
    expect(nextStep(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1])).toBeNull();
  });

  it('refuses to number a screen that is not in the flow', () => {
    // @ts-expect-error deliberately outside the union
    expect(() => stepNumber('not-a-screen')).toThrow();
  });
});

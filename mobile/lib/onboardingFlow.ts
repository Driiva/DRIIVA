/**
 * ONBOARDING FLOW ORDER
 * =====================
 * One owner for the sequence of onboarding screens, the count, and each
 * screen's position in it.
 *
 * WHY
 * Every screen used to hardcode `step` and `total` into its own ProgressBar.
 * That is one sequence spread across fifteen files, and it had already drifted:
 * location-priming and motion-priming both declared step 9, so the bar sat
 * still across that transition and the declared total of 14 was never reached
 * in distinct increments. No test could catch it because the sequence existed
 * only as a scattering of literals.
 *
 * Screens now ask this module where they are. Adding, removing or reordering a
 * screen is a single edit here, and tests/unit/mobile-onboarding-flow.test.ts
 * fails if the result has a duplicate, a gap, or the wrong total.
 *
 * WHAT IS DELIBERATELY ABSENT
 * `quote`. The beta ships the community play, and the brief bans anything that
 * requires the insurance product to exist. quote.tsx stays on disk so the Root
 * and Stripe paths remain dormant rather than deleted, but it is not a step a
 * driver walks through. It is also why the flow now ends on `community`: the
 * old terminal screen offered "Get notified when quotes go live" as its
 * primary action, which only raised an alert, while the single call that
 * actually completed onboarding was the muted skip link underneath it.
 */

/**
 * The screens a driver walks, in order. File names under mobile/app/onboarding,
 * except `index` which is the landing screen.
 */
export const ONBOARDING_STEPS = [
  'index',
  'goal',
  'pain-points',
  'social-proof',
  'tinder',
  'solution',
  'comparison',
  'preferences',
  'location-priming',
  'motion-priming',
  'processing',
  'trip-demo',
  'viral-moment',
  'account',
  'community',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** How many steps the progress bar is measuring against. */
export const ONBOARDING_TOTAL = ONBOARDING_STEPS.length;

/**
 * This screen's position, counting from 1.
 *
 * Throws on an unknown screen rather than returning 0 or -1. A progress bar
 * silently rendering the wrong fraction is the failure this module exists to
 * prevent, so an unknown step is a programming error worth surfacing loudly
 * at the point it is introduced.
 */
export function stepNumber(step: OnboardingStep): number {
  const index = ONBOARDING_STEPS.indexOf(step);
  if (index === -1) throw new Error(`Unknown onboarding step: ${step}`);
  return index + 1;
}

/** The screen after this one, or null at the end of the flow. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  if (index === -1) throw new Error(`Unknown onboarding step: ${step}`);
  return ONBOARDING_STEPS[index + 1] ?? null;
}

/** The router path for a step. `index` is the bare onboarding route. */
export function stepPath(step: OnboardingStep): string {
  return step === 'index' ? '/onboarding' : `/onboarding/${step}`;
}

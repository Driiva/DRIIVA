import type { DrivingProfile } from '@/contexts/OnboardingContext';
import { projectedRefundCents } from '@driiva/scoring';

export function seedScore(profile: DrivingProfile): number {
  let base = 82;
  if (profile.frequency === 'Occasionally') base += 4;
  if (profile.frequency === 'Weekends only') base += 2;
  if (profile.time === 'Morning commute') base += 3;
  if (profile.time === 'Daytime') base += 2;
  if (profile.time === 'Evening') base -= 3;
  if (profile.routes === 'Rural') base += 4;
  if (profile.routes === 'Suburban') base += 1;
  if (profile.routes === 'City centre') base -= 2;
  return Math.min(96, Math.max(74, base));
}

/**
 * The premium the onboarding estimate is derived from, in pounds.
 *
 * Named rather than left as a default argument, because a pound figure shown
 * to a driver has to be traceable to the premium it came from. The onboarding
 * copy states it on the page for the same reason.
 */
export const DEMO_PREMIUM_POUNDS = 1200;

/**
 * The disclosure that must accompany every demo pound figure.
 *
 * Three things have to be on the page every single time, and the compliance
 * rule is not satisfied by two of them: the figure is PROJECTED, it is capped
 * at 15% of premium, and the premium it was projected from is named. viral
 * -moment.tsx stated the basis and quote.tsx showed the same range with none,
 * which is the version that reads as a promise.
 *
 * It is one exported string rather than two hand-typed paragraphs because the
 * premium is interpolated from DEMO_PREMIUM_POUNDS. Retuning the demo premium
 * without this would leave a sentence naming a premium the numbers above it no
 * longer came from, and nothing would notice.
 *
 * tests/unit/mobile-refund-disclosure.test.ts fails if either screen drops it.
 */
export const DEMO_REFUND_DISCLOSURE =
  `Projected, not guaranteed, and capped at 15% of premium. Based on a typical premium of ` +
  `£${DEMO_PREMIUM_POUNDS.toLocaleString('en-GB')} a year. What comes back depends on your ` +
  `policy, your claims and how the pool performs.`;

/** How far either side of the estimate the displayed range reaches. */
const RANGE_SPREAD = 0.2;

/**
 * The projected refund for a seeded score, in whole pounds.
 *
 * This used to be its own formula: `(score / 100) * 0.15 * premium`. It was a
 * second refund calculation living alongside @driiva/scoring and disagreeing
 * with it, which is the shape that drifts. It ignored the eligibility floor,
 * so a driver scoring 1 out of 100 was quoted a refund, and it ignored the
 * community blend that the real calculation applies. The web app retired its
 * own hand-rolled copy of the same thing for the same reason, see the WEB-17
 * note in client/src/pages/profile.tsx.
 *
 * It now delegates. The number a driver sees during onboarding is the number
 * the real calculator produces for that score, and the hard cap comes with it.
 */
export function refundEstimate(score: number, premiumPounds = DEMO_PREMIUM_POUNDS): number {
  const cents = projectedRefundCents(score, Math.round(premiumPounds * 100));
  return cents === null ? 0 : Math.round(cents / 100);
}

/**
 * The estimate as a displayed range, capped.
 *
 * The screens widened the estimate by hand with `refund * 0.8` and
 * `refund * 1.2`. Widening a figure that is already scaled to the 15% ceiling
 * puts the top of the range above it, so the cap has to be applied AFTER the
 * spread rather than before it. A cap applied first is not a cap.
 */
export function refundEstimateRange(
  score: number,
  premiumPounds = DEMO_PREMIUM_POUNDS,
): { min: number; max: number } {
  const mid = refundEstimate(score, premiumPounds);
  const cap = Math.floor(premiumPounds * 0.15);
  return {
    min: Math.max(0, Math.round(mid * (1 - RANGE_SPREAD))),
    max: Math.max(0, Math.min(cap, Math.round(mid * (1 + RANGE_SPREAD)))),
  };
}

export function scorePercentile(score: number): number {
  if (score >= 90) return 8;
  if (score >= 85) return 15;
  if (score >= 78) return 22;
  return 35;
}

export function ecoGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 82) return 'B+';
  if (score >= 74) return 'B';
  return 'C+';
}

/**
 * THE ONBOARDING TRIP DEMO, IN ONE PLACE
 * ======================================
 * The simulated first trip awards four score deltas. They used to be written
 * out by hand twice: once as the animated event rows in
 * mobile/components/onboarding/TripReplay.tsx, once as the summary breakdown
 * in mobile/app/onboarding/trip-demo.tsx. Same four numbers, different labels,
 * no connection between them, so retuning the demo in one file left the replay
 * and the summary disagreeing about what the same trip scored.
 *
 * These are demo figures. They describe a scripted drive shown before the
 * driver has taken a real one, and both screens say so on the page. Nothing
 * here reaches @driiva/scoring or any real trip.
 *
 * tests/unit/mobile-trip-demo-deltas.test.ts fails if either screen's numbers
 * stop matching this list.
 */
export interface DemoScoreDelta {
  /** Stable key for the factor the demo attributes the points to. */
  id: 'braking' | 'speed' | 'acceleration' | 'nightOwl';
  /**
   * What the driver reads. Here rather than in each screen because the replay
   * and the summary card described the same four events in different words,
   * so the animation and the card it animates into disagreed about what had
   * just happened.
   */
  label: string;
  /** Points the simulated trip awards. Whole points, always positive. */
  delta: number;
  /** Milliseconds after the replay starts before this row appears. */
  delay: number;
}

export const DEMO_SCORE_DELTAS: readonly DemoScoreDelta[] = [
  { id: 'braking', label: 'Smooth braking', delta: 8, delay: 1200 },
  { id: 'speed', label: 'Speed limit observed', delta: 5, delay: 2000 },
  { id: 'acceleration', label: 'Efficient acceleration', delta: 4, delay: 2800 },
  { id: 'nightOwl', label: 'Late drive detected', delta: 2, delay: 3600 },
];

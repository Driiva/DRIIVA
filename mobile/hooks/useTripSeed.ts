import type { DrivingProfile } from '@/contexts/OnboardingContext';

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

export function refundEstimate(score: number, premium = 1200): number {
  return Math.round((score / 100) * 0.15 * premium);
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
  /** Points the simulated trip awards. Whole points, always positive. */
  delta: number;
  /** Milliseconds after the replay starts before this row appears. */
  delay: number;
}

export const DEMO_SCORE_DELTAS: readonly DemoScoreDelta[] = [
  { id: 'braking', delta: 8, delay: 1200 },
  { id: 'speed', delta: 5, delay: 2000 },
  { id: 'acceleration', delta: 4, delay: 2800 },
  { id: 'nightOwl', delta: 2, delay: 3600 },
];

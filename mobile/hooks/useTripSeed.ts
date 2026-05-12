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

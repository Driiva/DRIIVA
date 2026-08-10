/**
 * The store-review gate.
 *
 * Lives in tests/unit rather than beside its subject because the root vitest
 * config does not include mobile/, same reason as mobile-waitlist.test.ts.
 *
 * It imports review-gate.ts, not review.ts. The gate is pure and dependency
 * -free precisely so these rules can be exercised in plain node; review.ts
 * pulls expo-store-review and expo-secure-store, and react-native behind them,
 * which no amount of mocking makes worth the trouble for logic this simple.
 *
 * What these pin is the promise the module makes: never on launch, only after
 * a genuinely good trip, only once ever.
 */
import { describe, it, expect } from 'vitest';

import {
  shouldAskForReview,
  REVIEW_SCORE_THRESHOLD,
  REVIEW_MIN_TRIPS,
} from '../../mobile/lib/review-gate';

describe('shouldAskForReview', () => {
  const good = { tripScore: 92, totalTrips: 12 };

  it('asks after a high-scoring trip from an established driver', () => {
    expect(shouldAskForReview(good, false)).toBe(true);
  });

  it('never asks twice', () => {
    expect(shouldAskForReview(good, true)).toBe(false);
  });

  // The prompt has to land while somebody is pleased, not while they are
  // looking at a bad score.
  it('does not ask on a mediocre or bad trip', () => {
    expect(shouldAskForReview({ ...good, tripScore: REVIEW_SCORE_THRESHOLD - 1 }, false)).toBe(false);
    expect(shouldAskForReview({ ...good, tripScore: 40 }, false)).toBe(false);
  });

  it('asks exactly at the threshold, not one below it', () => {
    expect(shouldAskForReview({ ...good, tripScore: REVIEW_SCORE_THRESHOLD }, false)).toBe(true);
  });

  // One good trip is not evidence anyone likes the app yet, and a prompt on a
  // brand-new install is the classic way to collect one-star reviews.
  it('does not ask a driver with almost no history', () => {
    expect(shouldAskForReview({ tripScore: 99, totalTrips: 1 }, false)).toBe(false);
    expect(shouldAskForReview({ tripScore: 99, totalTrips: REVIEW_MIN_TRIPS - 1 }, false)).toBe(false);
    expect(shouldAskForReview({ tripScore: 99, totalTrips: REVIEW_MIN_TRIPS }, false)).toBe(true);
  });

  it('never asks on a zero-trip launch, whatever else is true', () => {
    expect(shouldAskForReview({ tripScore: 100, totalTrips: 0 }, false)).toBe(false);
  });
});

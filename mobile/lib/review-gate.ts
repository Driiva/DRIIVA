/**
 * THE REVIEW GATE
 * ===============
 * Pure decision logic for the store-review prompt, deliberately in its own
 * module with no imports at all.
 *
 * review.ts, which owns the prompt, has to import expo-store-review and
 * expo-secure-store, and those pull react-native in behind them. Keeping the
 * rules here means they can be tested in plain node without mocking a device.
 * The rules are the part worth testing; the SDK calls are not.
 */

/** A trip has to be this good to count as a positive moment. */
export const REVIEW_SCORE_THRESHOLD = 85;

/** And the driver has to have this much history behind them. */
export const REVIEW_MIN_TRIPS = 5;

export interface ReviewMoment {
  tripScore: number;
  totalTrips: number;
}

/**
 * Whether this moment earns the one prompt we get.
 *
 * - Never if we have already asked. iOS caps the real dialogue and silently
 *   no-ops past it, so a second ask is invisible and merely burns the quota.
 * - Never below the score threshold: the prompt should land while somebody is
 *   pleased with the product, not while they are looking at a bad score.
 * - Never before the driver has real history. One good trip is not evidence
 *   that anyone likes this yet, and a prompt on a fresh install is the classic
 *   way to collect one-star reviews.
 */
export function shouldAskForReview(moment: ReviewMoment, alreadyAsked: boolean): boolean {
  if (alreadyAsked) return false;
  if (moment.tripScore < REVIEW_SCORE_THRESHOLD) return false;
  if (moment.totalTrips < REVIEW_MIN_TRIPS) return false;
  return true;
}

/**
 * STORE REVIEW PROMPT
 * ===================
 * Asks for a rating after a genuinely good moment, and only then.
 *
 * The rules encoded here, all of which exist because the alternative is worse:
 *
 * - NEVER on launch. A prompt before the person has got anything out of the
 *   app is how you collect one-star reviews.
 * - Only after a HIGH-SCORING trip. The prompt should land while somebody is
 *   pleased with the product, not while they are looking at a bad score.
 * - Only once, ever, per install. iOS caps the real dialogue at three times a
 *   year and silently no-ops after that, so a second ask is usually invisible
 *   to the user and merely burns the quota. Recording our own attempt means we
 *   never spend it twice.
 * - Not until the app has been used properly. A single good trip is not
 *   evidence anyone likes this yet.
 *
 * The score threshold and trip minimum are deliberately conservative. It is
 * better to ask fewer people at a better moment.
 *
 * Persisted with expo-secure-store, which the app already depends on, rather
 * than adding AsyncStorage for one boolean.
 */
import * as SecureStore from 'expo-secure-store';
import * as StoreReview from 'expo-store-review';

// SecureStore keys allow only alphanumerics, dot, dash and underscore.
const ASKED_KEY = 'driiva_review_asked_at';

/** A trip has to be this good to count as a positive moment. */
export const REVIEW_SCORE_THRESHOLD = 85;

/** And the driver has to have this much history behind them. */
export const REVIEW_MIN_TRIPS = 5;

export interface ReviewMoment {
  tripScore: number;
  totalTrips: number;
}

/** Pure, so the gate can be tested without a store or a device. */
export function shouldAskForReview(
  moment: ReviewMoment,
  alreadyAsked: boolean,
): boolean {
  if (alreadyAsked) return false;
  if (moment.tripScore < REVIEW_SCORE_THRESHOLD) return false;
  if (moment.totalTrips < REVIEW_MIN_TRIPS) return false;
  return true;
}

export async function hasAskedBefore(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ASKED_KEY)) !== null;
  } catch {
    // If we cannot tell, assume we have asked. Never risk nagging.
    return true;
  }
}

/**
 * Requests the review dialogue if this moment qualifies. Returns whether the
 * ask actually happened, which is what a caller should log rather than
 * assuming.
 */
export async function maybeAskForReview(moment: ReviewMoment): Promise<boolean> {
  try {
    if (!shouldAskForReview(moment, await hasAskedBefore())) return false;

    // isAvailableAsync is false on a simulator and on a device with no store.
    if (!(await StoreReview.isAvailableAsync())) return false;
    if (!(await StoreReview.hasAction())) return false;

    // Recorded BEFORE requesting. If the request throws halfway we still do
    // not come back and ask again.
    await SecureStore.setItemAsync(ASKED_KEY, new Date().toISOString());
    await StoreReview.requestReview();
    return true;
  } catch (err) {
    console.warn('[review] prompt failed:', err);
    return false;
  }
}

/** Test and support hook. Not wired to any user-facing control. */
export async function resetReviewPrompt(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ASKED_KEY);
  } catch {
    /* nothing to reset */
  }
}

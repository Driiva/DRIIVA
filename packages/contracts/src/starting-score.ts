/**
 * THE STARTING SCORE
 * ==================
 * The score a driver's profile is created with, before any trip has been
 * scored.
 *
 * This lives in contracts because three places need to agree about it: the
 * provisioning function that WRITES it, the onboarding screen that EXPLAINS
 * it, and the dashboard first-run state that shows it. A number retyped in
 * three places is a number that will disagree in three places, and the version
 * users read would be the one nobody checked.
 *
 * WHY 70 AND NOT 100. A profile created at 100 can only ever move down: the
 * driver is handed a perfect score they did not earn, and their first honest
 * trip takes it away. For a product that sells rebuilding your record, that is
 * backwards. 70 is a middle starting position, so a good first trip moves the
 * score up and a poor one moves it down.
 *
 * HOW IT BEHAVES, because the explainer copy has to be true. The starting
 * score carries the weight of SEED_TRIPS notional trips, so the first real
 * trip is averaged WITH it rather than replacing it. A first trip of 90 lands
 * at 80, a first trip of 50 lands at 60. The seed's influence fades as real
 * trips accumulate, which is what makes it a starting position rather than a
 * score the driver has to defend.
 */

/** What functions/src/utils/provisionUser.ts writes into drivingProfile. */
export const STARTING_SCORE = 70;

/**
 * How many notional trips the starting score is worth when the first real trip
 * is averaged in. One keeps the starting position honest without letting it
 * outweigh real driving: after a single trip the score is halfway between.
 */
export const SEED_TRIPS = 1;

/**
 * The weight the current score carries when averaging in the next trip.
 * Callers must use this rather than totalTrips directly, or the starting score
 * is silently discarded on the first trip.
 */
export function scoreWeight(totalTrips: number): number {
  return totalTrips + SEED_TRIPS;
}

/**
 * True while the starting score is still showing, i.e. no trip has been
 * scored yet. Callers use this to decide whether to show the explainer rather
 * than presenting the number as if it were earned.
 */
export function isProvisionalScore(totalTrips: number): boolean {
  return totalTrips === 0;
}

/**
 * The honest one-liner, and the longer form. Kept next to the constant so the
 * copy cannot drift away from the behaviour it describes.
 */
export const STARTING_SCORE_COPY = {
  short: `New profiles start at ${STARTING_SCORE}. It is a starting position, not a rating.`,
  long:
    `Every new Driiva profile starts at ${STARTING_SCORE}. It is a starting position rather than ` +
    'a rating you have earned: your first scored trip is averaged with it, so a good first drive ' +
    'moves it up and a poor one moves it down. As you drive more, your real trips carry the score ' +
    'and the starting position fades out of it.',
} as const;

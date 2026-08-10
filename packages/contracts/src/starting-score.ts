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
 * WHAT ACTUALLY HAPPENS, because the explainer copy has to be true:
 *
 * A new profile is written with every factor at 100. That value is NOT a
 * weighted starting position that real trips gradually pull down. On the first
 * scored trip the trip-completion trigger takes this branch:
 *
 *     const oldWeight = user.drivingProfile.totalTrips;   // 0
 *     const newScore = oldWeight === 0 ? trip.score : weightedAverage(...);
 *
 * so the 100 is REPLACED OUTRIGHT by the first trip's score, and only from the
 * second trip onwards is the score an average. Any copy implying a new driver
 * must "protect" or "maintain" their 100 would be false: they cannot lose it,
 * because it was never theirs to lose.
 */

/** What functions/src/utils/provisionUser.ts writes into drivingProfile. */
export const STARTING_SCORE = 100;

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
  short: `New profiles start at ${STARTING_SCORE}. It is provisional until you drive.`,
  long:
    `Every new Driiva profile starts at ${STARTING_SCORE}. That is a placeholder, not a rating: ` +
    'your first scored trip replaces it outright, and from your second trip onwards your ' +
    'score is the average across every trip you have driven.',
} as const;

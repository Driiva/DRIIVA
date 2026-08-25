/**
 * PUSH NOTIFICATIONS
 * ==================
 * Firebase Cloud Messaging helpers for sending push notifications to users.
 * Each function fetches the user's FCM tokens from their Firestore document.
 */
/**
 * Notify a user that their trip has been scored.
 */
export declare function notifyTripComplete(userId: string, tripId: string, score: number): Promise<void>;
/**
 * Notify a user about newly unlocked achievements.
 */
export declare function notifyAchievementsUnlocked(userId: string, achievementNames: string[]): Promise<void>;
/**
 * Cover is confirmed. Only send this when the insurer actually said so.
 *
 * The policy number is included only if the insurer returned one. It used to
 * be filled with a timestamp-derived string when they did not, which put an
 * invented reference on a lock screen for a policy whose real reference we did
 * not have.
 */
export declare function notifyPolicyConfirmed(userId: string, policyId: string, policyNumber: string | null): Promise<void>;
/**
 * We took the money and we do NOT have cover in place.
 *
 * This is the case the whole payment path exists to make impossible to hide.
 * Previously the binding failure was written to a Firestore document and
 * logged, and the driver, who had just been charged and shown "Your policy is
 * now active", was told nothing at all. Silence after a payment is the worst
 * available option: it is the state where somebody drives uninsured believing
 * the opposite.
 */
export declare function notifyPolicyNotConfirmed(userId: string, reason: 'failed' | 'pending'): Promise<void>;
/**
 * Send a weekly driving summary to a user (called by scheduled function).
 */
export declare function sendWeeklySummaryToUser(userId: string, score: number, trips: number, miles: number): Promise<void>;
//# sourceMappingURL=notifications.d.ts.map
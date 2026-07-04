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
 * Send a weekly driving summary to a user (called by scheduled function).
 */
export declare function sendWeeklySummaryToUser(userId: string, score: number, trips: number, miles: number): Promise<void>;
//# sourceMappingURL=notifications.d.ts.map
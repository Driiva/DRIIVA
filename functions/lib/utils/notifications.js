"use strict";
/**
 * PUSH NOTIFICATIONS
 * ==================
 * Firebase Cloud Messaging helpers for sending push notifications to users.
 * Each function fetches the user's FCM tokens from their Firestore document.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyTripComplete = notifyTripComplete;
exports.notifyAchievementsUnlocked = notifyAchievementsUnlocked;
exports.sendWeeklySummaryToUser = sendWeeklySummaryToUser;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("../types");
const db = admin.firestore();
async function getUserTokens(userId) {
    const userSnap = await db.collection(types_1.COLLECTION_NAMES.USERS).doc(userId).get();
    if (!userSnap.exists)
        return [];
    const user = userSnap.data();
    return (user.fcmTokens ?? []).filter(Boolean);
}
async function sendToTokens(tokens, notification, data) {
    if (tokens.length === 0)
        return;
    const message = {
        tokens,
        notification,
        data,
        webpush: {
            fcmOptions: { link: '/dashboard' },
        },
    };
    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        if (response.failureCount > 0) {
            functions.logger.warn(`[Push] ${response.failureCount}/${tokens.length} deliveries failed`);
        }
    }
    catch (err) {
        functions.logger.warn('[Push] sendEachForMulticast error:', err);
    }
}
/**
 * Notify a user that their trip has been scored.
 */
async function notifyTripComplete(userId, tripId, score) {
    const tokens = await getUserTokens(userId);
    await sendToTokens(tokens, {
        title: 'Trip Scored',
        body: `Your trip scored ${Math.round(score)}/100. ${score >= 80 ? 'Great driving!' : 'Keep improving!'}`,
    }, { type: 'trip_complete', tripId });
}
/**
 * Notify a user about newly unlocked achievements.
 */
async function notifyAchievementsUnlocked(userId, achievementNames) {
    if (achievementNames.length === 0)
        return;
    const tokens = await getUserTokens(userId);
    const nameList = achievementNames.join(', ');
    await sendToTokens(tokens, {
        title: 'Achievement Unlocked!',
        body: `You earned: ${nameList}`,
    }, { type: 'achievement_unlocked' });
}
/**
 * Send a weekly driving summary to a user (called by scheduled function).
 */
async function sendWeeklySummaryToUser(userId, score, trips, miles) {
    const tokens = await getUserTokens(userId);
    await sendToTokens(tokens, {
        title: 'Your Weekly Summary',
        body: `This week: ${trips} trips, ${miles} miles, avg score ${score}. Keep it up!`,
    }, { type: 'weekly_summary' });
}
//# sourceMappingURL=notifications.js.map
/**
 * PUSH NOTIFICATIONS
 * ==================
 * Firebase Cloud Messaging helpers for sending push notifications to users.
 * Each function fetches the user's FCM tokens from their Firestore document.
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { COLLECTION_NAMES, UserDocument } from '../types';

const db = admin.firestore();

async function getUserTokens(userId: string): Promise<string[]> {
  const userSnap = await db.collection(COLLECTION_NAMES.USERS).doc(userId).get();
  if (!userSnap.exists) return [];
  const user = userSnap.data() as UserDocument;
  return (user.fcmTokens ?? []).filter(Boolean);
}

/**
 * Sends the push AND records it.
 *
 * Wave D: these sends were fire-and-forget, so a notification existed only as
 * a banner on a locked phone. Miss it and it was gone; there was nothing for
 * an in-app notification centre to read, and no way to answer "what did you
 * tell me last week". Every send is now persisted to
 * users/{uid}/notifications, which is what the centre reads.
 *
 * The record is written even when the user has no tokens registered. Somebody
 * who has not enabled push has still had the thing happen to them, and should
 * see it next time they open the app.
 */
async function sendToTokens(
  userId: string,
  tokens: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<void> {
  try {
    await db
      .collection(COLLECTION_NAMES.USERS)
      .doc(userId)
      .collection('notifications')
      .add({
        title: notification.title,
        body: notification.body,
        type: data?.type ?? 'general',
        data: data ?? {},
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (err) {
    // A failed record must not stop the push going out.
    functions.logger.warn('[Push] could not record notification:', err);
  }

  if (tokens.length === 0) return;

  const message: admin.messaging.MulticastMessage = {
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
      functions.logger.warn(
        `[Push] ${response.failureCount}/${tokens.length} deliveries failed`,
      );
    }
  } catch (err) {
    functions.logger.warn('[Push] sendEachForMulticast error:', err);
  }
}

/**
 * Notify a user that their trip has been scored.
 */
export async function notifyTripComplete(
  userId: string,
  tripId: string,
  score: number,
): Promise<void> {
  const tokens = await getUserTokens(userId);
  await sendToTokens(
    userId,
    tokens,
    {
      title: 'Trip scored',
      body: `Your trip scored ${Math.round(score)}/100. ${score >= 80 ? 'Strong drive.' : 'Room to improve.'}`,
    },
    { type: 'trip_complete', tripId },
  );
}

/**
 * Notify a user about newly unlocked achievements.
 */
export async function notifyAchievementsUnlocked(
  userId: string,
  achievementNames: string[],
): Promise<void> {
  if (achievementNames.length === 0) return;
  const tokens = await getUserTokens(userId);
  const nameList = achievementNames.join(', ');
  await sendToTokens(
    userId,
    tokens,
    {
      title: 'Achievement unlocked',
      body: `You earned: ${nameList}`,
    },
    { type: 'achievement_unlocked' },
  );
}

/**
 * Send a weekly driving summary to a user (called by scheduled function).
 */
export async function sendWeeklySummaryToUser(
  userId: string,
  score: number,
  trips: number,
  miles: number,
): Promise<void> {
  const tokens = await getUserTokens(userId);
  await sendToTokens(
    userId,
    tokens,
    {
      title: 'Your weekly summary',
      body: `This week: ${trips} trips, ${miles} miles, average score ${score}.`,
    },
    { type: 'weekly_summary' },
  );
}

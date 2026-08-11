/**
 * SYNC USER ON SIGNUP
 * ===================
 * Firebase Auth trigger: when a new user is created, mirror them to Neon PostgreSQL.
 * This keeps users + onboarding_complete as single source of truth in PostgreSQL.
 */

import * as functions from 'firebase-functions';
import { insertUserFromFirebase } from '../lib/neon';

export const syncUserOnSignup = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName } = user;
  const emailStr = email ?? '';
  if (!emailStr) {
    functions.logger.warn('User created without email', { uid });
    return;
  }
  try {
    const pgId = await insertUserFromFirebase(uid, emailStr, displayName ?? null);
    functions.logger.info('Synced Firebase user to PostgreSQL', { uid, email: emailStr, pgUserId: pgId });
  } catch (error) {
    functions.logger.error('Failed to sync user to PostgreSQL', { uid, error });
    throw error;
  }
});

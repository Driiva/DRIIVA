/**
 * Firebase Admin SDK for server-side token verification.
 * Used to verify Firebase ID tokens and get uid for /api/profile/me.
 * Optional: server starts without it if GOOGLE_APPLICATION_CREDENTIALS or
 * FIREBASE_SERVICE_ACCOUNT_KEY is not set (legacy auth still works).
 */

import * as admin from "firebase-admin";

let app: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App | null {
  if (app) return app;
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = admin.initializeApp({ credential: admin.credential.applicationDefault() });
      return app;
    }
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (key) {
      const parsed = JSON.parse(key) as admin.ServiceAccount;
      app = admin.initializeApp({ credential: admin.credential.cert(parsed) });
      return app;
    }
  } catch (e) {
    console.warn("[firebase-admin] Not initialized:", (e as Error).message);
  }
  return null;
}

export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email?: string } | null> {
  const firebase = getFirebaseAdmin();
  if (!firebase) return null;
  try {
    const decoded = await firebase.auth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

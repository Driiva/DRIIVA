/**
 * Optional Firebase ID token verification.
 * Attaches req.firebaseUid and req.firebaseEmail when Authorization: Bearer <idToken> is valid.
 */

import type { Request, Response, NextFunction } from "express";
import { verifyFirebaseToken } from "../lib/firebase-admin";

export interface FirebaseAuthRequest extends Request {
  firebaseUid?: string;
  firebaseEmail?: string;
}

export async function firebaseAuth(
  req: FirebaseAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = auth.slice(7);
  const decoded = await verifyFirebaseToken(token);
  if (decoded) {
    req.firebaseUid = decoded.uid;
    req.firebaseEmail = decoded.email ?? undefined;
  }
  next();
}

/** Require Firebase auth; respond 401 if token missing or invalid. */
export function requireFirebaseAuth(
  req: FirebaseAuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.firebaseUid) {
    res.status(401).json({ message: "Unauthorized", code: "FIREBASE_TOKEN_REQUIRED" });
    return;
  }
  next();
}

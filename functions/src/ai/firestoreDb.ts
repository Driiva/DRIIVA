/**
 * The Firestore handle the AI pipeline writes through. Kept in its own module
 * so tripAnalysis.ts and apiUsage.ts share one `admin.firestore()` call made at
 * import time, exactly as the single-file version did.
 */
import * as admin from 'firebase-admin';

export const db = admin.firestore();

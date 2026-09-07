/**
 * The Firestore handle the trip pipeline writes through, in its own module so
 * the modules that were split out of triggers/trips.ts and ai/tripAnalysis.ts
 * share the single admin.firestore() call each of those files used to make at
 * import time.
 */
import * as admin from 'firebase-admin';

export const db = admin.firestore();

/**
 * Guard shared by every Firestore service module: refuse to touch the SDK when
 * Firebase was never configured, rather than dereferencing a null `db`.
 * Extracted from client/src/lib/firestore.ts.
 */

import { db, isFirebaseConfigured } from './firebase';

// ============================================================================
// FIRESTORE INSTANCE CHECK
// ============================================================================

export function assertFirestore(): void {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore is not configured. Check Firebase environment variables.');
  }
}

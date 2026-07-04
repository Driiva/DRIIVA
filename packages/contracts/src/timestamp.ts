import { z } from 'zod';

/**
 * FIRESTORE TIMESTAMP (duck-typed)
 * ================================
 * The Firestore client SDK (`firebase/firestore`) and the Admin SDK
 * (`firebase-admin/firestore`) each ship their own `Timestamp` class. Both are
 * structurally identical: numeric `seconds` / `nanoseconds` plus a `toDate()`
 * method, but neither is an `instanceof` match for the other.
 *
 * @driiva/contracts is imported from the web client, the Express server and
 * Cloud Functions alike, so it cannot hard-depend on either SDK. This schema
 * validates the duck-type instead, which is enough to catch the real failure
 * mode (a plain string, a number, or a missing field where a Timestamp was
 * expected).
 *
 * This pins the READ-back shape of a resolved document. On write, `createdAt`
 * style fields are frequently an `admin.firestore.FieldValue.serverTimestamp()`
 * sentinel - write payloads are not validated through this schema, only
 * documents as read back after the sentinel has resolved.
 */
export interface FirestoreTimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

export const FirestoreTimestampSchema = z.custom<FirestoreTimestampLike>(
  (val) =>
    typeof val === 'object' &&
    val !== null &&
    typeof (val as { seconds?: unknown }).seconds === 'number' &&
    typeof (val as { nanoseconds?: unknown }).nanoseconds === 'number',
  { message: 'Expected a Firestore Timestamp ({ seconds, nanoseconds })' },
);

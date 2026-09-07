/**
 * The Firestore scalar aliases every document interface in functions/src/schema
 * uses. Extracted verbatim from functions/src/types.ts.
 */
import * as admin from 'firebase-admin';

export type Timestamp = admin.firestore.Timestamp;
export type FieldValue = admin.firestore.FieldValue;

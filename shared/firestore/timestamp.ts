/**
 * The Firestore Timestamp alias every document type in shared/firestore uses.
 * Extracted verbatim from shared/firestore-types.ts.
 */
import { Timestamp as FirebaseTimestamp } from 'firebase/firestore';

// Re-export Timestamp for convenience
export type Timestamp = FirebaseTimestamp;

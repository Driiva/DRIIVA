import type { FirestoreTimestampLike } from '../timestamp';

/** A minimal fixture satisfying FirestoreTimestampSchema's duck-type check. */
export function fakeTimestamp(seconds = 1_772_000_000): FirestoreTimestampLike {
  return { seconds, nanoseconds: 0 };
}

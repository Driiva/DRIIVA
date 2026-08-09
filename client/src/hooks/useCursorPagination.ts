/**
 * CURSOR PAGINATION HOOK (web)
 * ============================
 * Wires the SDK-agnostic core in shared/pagination.ts to the modular Firestore
 * web SDK. Fetches one document more than the page holds so `hasMore` is known
 * without a second count query, and cursors on a document path so pages do not
 * skip trips that share a startedAt timestamp.
 *
 * This deliberately does NOT own page one. The trips list keeps its realtime
 * onSnapshot head so a trip that completes while the page is open still updates
 * live; this hook appends the older, immutable pages behind it. Callers that
 * have no realtime head (admin) simply call loadMore() with no head cursor.
 */
import { useCallback, useRef, useState } from 'react';
import {
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  query,
  startAfter,
  type Query,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_PAGE_SIZE, decodeCursor, pageLimit, splitPage } from '../../../shared/pagination';

export interface UseCursorPaginationResult<T> {
  /** Older pages, in order, flattened. Page one is the caller's concern. */
  items: T[];
  loadingMore: boolean;
  /** False once a page comes back short, so the sentinel can stop asking. */
  hasMore: boolean;
  error: Error | null;
  /**
   * Fetch the next page. `headCursor` is used only for the very first call,
   * to continue after the realtime head page the caller is rendering.
   */
  loadMore: (headCursor?: string | null) => Promise<void>;
  reset: () => void;
}

export function useCursorPagination<T>(
  base: Query<DocumentData> | null,
  transform: (snapshot: QueryDocumentSnapshot<DocumentData>) => T,
  pageSize: number = DEFAULT_PAGE_SIZE,
): UseCursorPaginationResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs, not state: an in-flight guard read from state would let a fast
  // scroll fire two identical page requests before the first re-render, and
  // the same page would be appended twice.
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const loadMore = useCallback(
    async (headCursor?: string | null) => {
      if (!base || !db || inFlightRef.current || !hasMore) return;
      const startCursor = cursorRef.current ?? headCursor ?? null;

      inFlightRef.current = true;
      setLoadingMore(true);
      setError(null);

      try {
        let pageQuery = query(base, limitTo(pageLimit(pageSize)));

        const startPath = decodeCursor(startCursor);
        if (startPath) {
          const cursorSnap = await getDoc(doc(db, startPath));
          // A cursor pointing at a deleted document is not an error: fall back
          // to the first page rather than stranding the reader on a spinner.
          if (cursorSnap.exists()) {
            pageQuery = query(base, startAfter(cursorSnap), limitTo(pageLimit(pageSize)));
          }
        }

        const snapshot = await getDocs(pageQuery);
        const page = splitPage(snapshot.docs, pageSize, (d) => d.ref.path);

        setItems((prev) => [...prev, ...page.items.map(transform)]);
        cursorRef.current = page.nextCursor;
        setHasMore(page.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load more'));
      } finally {
        inFlightRef.current = false;
        setLoadingMore(false);
      }
    },
    [base, hasMore, pageSize, transform],
  );

  const reset = useCallback(() => {
    cursorRef.current = null;
    inFlightRef.current = false;
    setItems([]);
    setHasMore(true);
    setError(null);
  }, []);

  return { items, loadingMore, hasMore, error, loadMore, reset };
}

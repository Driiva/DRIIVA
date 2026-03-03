/**
 * GENERIC FIRESTORE DOCUMENT HOOK
 * ================================
 * Single-document real-time subscription with:
 *   - Deep equality check before setState (avoids spurious re-renders)
 *   - fromCache metadata awareness
 *   - permission-denied error classification → auth recheck
 *   - Auto-retry on transient errors with exponential backoff
 *   - Proper cleanup on unmount and path changes
 *
 * Every Firestore doc listener in the app should compose from this primitive.
 */

import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import {
  doc,
  onSnapshot,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '@/lib/firebase';
import { OnlineStatusContext } from '@/contexts/OnlineStatusContext';

export interface UseFirestoreDocOptions<T> {
  transform?: (data: Record<string, unknown>) => T;
}

export interface UseFirestoreDocResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isFromCache: boolean;
  refresh: () => void;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}

async function forceAuthRecheck(): Promise<void> {
  if (!auth?.currentUser) return;
  try {
    await auth.currentUser.getIdToken(true);
  } catch {
    await auth.signOut();
  }
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export function useFirestoreDoc<T = Record<string, unknown>>(
  path: string | null,
  options?: UseFirestoreDocOptions<T>,
): UseFirestoreDocResult<T> {
  const onlineStatus = useContext(OnlineStatusContext);
  const reportFirestoreError = onlineStatus?.reportFirestoreError ?? (() => {});

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const lastDataRef = useRef<unknown>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transformRef = useRef(options?.transform);
  transformRef.current = options?.transform;

  const refresh = useCallback(() => {
    retryCountRef.current = 0;
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!path || !isFirebaseConfigured || !db) {
      setData(null);
      setLoading(false);
      setError(null);
      setIsFromCache(false);
      lastDataRef.current = null;
      return;
    }

    setLoading(true);
    setError(null);
    retryCountRef.current = 0;

    function subscribe(): (() => void) | undefined {
      if (!db || !path) return undefined;

      const docRef = doc(db, path);

      const unsubscribe = onSnapshot(
        docRef,
        { includeMetadataChanges: true },
        (snapshot: DocumentSnapshot) => {
          retryCountRef.current = 0;
          setIsFromCache(snapshot.metadata.fromCache);

          if (snapshot.exists()) {
            const raw = snapshot.data() as Record<string, unknown>;
            const transformed = transformRef.current ? transformRef.current(raw) : raw as unknown as T;

            if (!deepEqual(transformed, lastDataRef.current)) {
              lastDataRef.current = transformed;
              setData(transformed);
            }
          } else {
            if (lastDataRef.current !== null) {
              lastDataRef.current = null;
              setData(null);
            }
          }

          setLoading(false);
          setError(null);
        },
        (err: FirestoreError) => {
          console.error(`[useFirestoreDoc] Error on ${path}:`, err.code, err.message);

          if (err.code === 'permission-denied') {
            setError(err);
            setLoading(false);
            forceAuthRecheck();
            return;
          }

          if (err.code === 'unavailable' || err.code === 'resource-exhausted') {
            reportFirestoreError();

            if (retryCountRef.current < MAX_RETRIES) {
              const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
              retryCountRef.current += 1;
              retryTimeoutRef.current = setTimeout(() => {
                setRefreshKey(k => k + 1);
              }, delay);
              return;
            }
          }

          setError(err);
          setLoading(false);
          reportFirestoreError();
        },
      );

      return unsubscribe;
    }

    const unsubscribe = subscribe();

    return () => {
      unsubscribe?.();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [path, refreshKey, reportFirestoreError]);

  return { data, loading, error, isFromCache, refresh };
}

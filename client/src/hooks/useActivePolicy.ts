/**
 * ACTIVE POLICY HOOK
 * ==================
 * Real-time subscription to the user's active insurance policy.
 * Uses useFirestoreQuery with a memoized query.
 */

import { useMemo } from 'react';
import {
  collection,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { useFirestoreQuery } from './useFirestoreQuery';
import { COLLECTION_NAMES } from '../../../shared/firestore-types';
import type { PolicyDocument } from '../../../shared/firestore-types';

export interface UseActivePolicyResult {
  policy: PolicyDocument | null;
  loading: boolean;
  error: Error | null;
  isFromCache: boolean;
  refresh: () => void;
}

export function useActivePolicy(userId: string | null): UseActivePolicyResult {
  const firestoreQuery = useMemo(() => {
    if (!userId || !isFirebaseConfigured || !db) return null;
    return query(
      collection(db, COLLECTION_NAMES.POLICIES),
      where('userId', '==', userId),
      where('status', '==', 'active'),
      limit(1),
    );
  }, [userId]);

  const { data, loading, error, isFromCache, refresh } = useFirestoreQuery<PolicyDocument | null>(
    firestoreQuery,
    {
      transform: (snapshot) =>
        snapshot.empty ? null : (snapshot.docs[0].data() as PolicyDocument),
    },
  );

  return {
    policy: data ?? null,
    loading,
    error,
    isFromCache,
    refresh,
  };
}

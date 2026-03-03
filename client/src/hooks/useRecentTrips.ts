/**
 * RECENT TRIPS HOOK
 * =================
 * Real-time subscription to the user's last N completed trips.
 * Uses useFirestoreQuery with a memoized query.
 */

import { useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { useFirestoreQuery } from './useFirestoreQuery';
import { COLLECTION_NAMES } from '../../../shared/firestore-types';
import type { TripDocument } from '../../../shared/firestore-types';

export interface UseRecentTripsResult {
  trips: TripDocument[];
  loading: boolean;
  error: Error | null;
  isFromCache: boolean;
  refresh: () => void;
}

export function useRecentTrips(userId: string | null, count = 3): UseRecentTripsResult {
  const firestoreQuery = useMemo(() => {
    if (!userId || !isFirebaseConfigured || !db) return null;
    return query(
      collection(db, COLLECTION_NAMES.TRIPS),
      where('userId', '==', userId),
      where('status', '==', 'completed'),
      orderBy('endedAt', 'desc'),
      limit(count),
    );
  }, [userId, count]);

  const { data, loading, error, isFromCache, refresh } = useFirestoreQuery<TripDocument[]>(
    firestoreQuery,
    {
      transform: (snapshot) => snapshot.docs.map(d => d.data() as TripDocument),
    },
  );

  return {
    trips: data ?? [],
    loading,
    error,
    isFromCache,
    refresh,
  };
}

/**
 * POOL STATE HOOK
 * ===============
 * Real-time subscription to communityPool/current via useFirestoreDoc.
 * Single shared listener for the community pool singleton.
 */

import { useFirestoreDoc } from './useFirestoreDoc';
import { COLLECTION_NAMES } from '../../../shared/firestore-types';
import type { CommunityPoolDocument } from '../../../shared/firestore-types';

export interface UsePoolStateResult {
  pool: CommunityPoolDocument | null;
  loading: boolean;
  error: Error | null;
  isFromCache: boolean;
  refresh: () => void;
}

const POOL_PATH = `${COLLECTION_NAMES.COMMUNITY_POOL}/current`;

export function usePoolState(): UsePoolStateResult {
  const { data, loading, error, isFromCache, refresh } = useFirestoreDoc<CommunityPoolDocument>(POOL_PATH);

  return {
    pool: data,
    loading,
    error,
    isFromCache,
    refresh,
  };
}

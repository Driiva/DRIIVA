/**
 * USER PROFILE HOOK
 * =================
 * Real-time subscription to users/{userId} via useFirestoreDoc.
 * Returns the full UserDocument for the authenticated user.
 */

import { useFirestoreDoc } from './useFirestoreDoc';
import type { UserDocument } from '../../../shared/firestore-types';

export interface UseUserProfileResult {
  userDoc: UserDocument | null;
  loading: boolean;
  error: Error | null;
  isFromCache: boolean;
  refresh: () => void;
}

export function useUserProfile(userId: string | null): UseUserProfileResult {
  const path = userId ? `users/${userId}` : null;
  const { data, loading, error, isFromCache, refresh } = useFirestoreDoc<UserDocument>(path);

  return {
    userDoc: data,
    loading,
    error,
    isFromCache,
    refresh,
  };
}

/**
 * useBetaEstimate
 * ---------------
 * Subscribes to users/{userId}/betaPricing/currentEstimate via useFirestoreDoc.
 * If the document is missing, calls the callable once to generate it.
 */

import { useEffect, useRef, useCallback } from 'react';
import { calculateBetaEstimateForUser } from '@/lib/firestore';
import { useFirestoreDoc } from './useFirestoreDoc';
import type { BetaEstimateDocument } from '../../../shared/firestore-types';

export interface UseBetaEstimateResult {
  estimate: BetaEstimateDocument | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useBetaEstimate(userId: string | null): UseBetaEstimateResult {
  const path = userId ? `users/${userId}/betaPricing/currentEstimate` : null;
  const { data: estimate, loading, error: docError, refresh: refreshDoc } = useFirestoreDoc<BetaEstimateDocument>(path);

  const hasRequestedGenerate = useRef(false);
  const generateErrorRef = useRef<Error | null>(null);

  // Auto-generate estimate when document is missing
  useEffect(() => {
    if (!userId || loading || estimate !== null || hasRequestedGenerate.current) return;
    hasRequestedGenerate.current = true;

    calculateBetaEstimateForUser(userId)
      .then((result) => {
        if (!result.success && result.message) {
          generateErrorRef.current = new Error(result.message);
        }
      })
      .catch((err) => {
        generateErrorRef.current = err instanceof Error ? err : new Error(String(err));
      });
  }, [userId, loading, estimate]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    hasRequestedGenerate.current = false;
    generateErrorRef.current = null;
    refreshDoc();
    try {
      const result = await calculateBetaEstimateForUser(userId);
      if (!result.success && result.message) {
        generateErrorRef.current = new Error(result.message);
      }
    } catch (err) {
      generateErrorRef.current = err instanceof Error ? err : new Error(String(err));
    }
  }, [userId, refreshDoc]);

  return {
    estimate,
    loading,
    error: docError || generateErrorRef.current,
    refresh,
  };
}

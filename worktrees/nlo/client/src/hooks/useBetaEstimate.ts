/**
 * useBetaEstimate
 * ---------------
 * Subscribes to users/{userId}/betaPricing/currentEstimate.
 * If the document is missing, calls the callable once to generate it.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  subscribeBetaEstimate,
  calculateBetaEstimateForUser,
} from '@/lib/firestore';
import type { BetaEstimateDocument } from '../../../shared/firestore-types';

export interface UseBetaEstimateResult {
  estimate: BetaEstimateDocument | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Subscribe to the user's beta estimate. When the document is missing,
 * calls the callable once to generate it (backend may return success: false
 * if age/postcode are missing).
 */
export function useBetaEstimate(userId: string | null): UseBetaEstimateResult {
  const [estimate, setEstimate] = useState<BetaEstimateDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasRequestedGenerate = useRef(false);

  const requestGenerate = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await calculateBetaEstimateForUser(userId);
      if (!result.success && result.message) {
        setError(new Error(result.message));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setEstimate(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeBetaEstimate(
      userId,
      (data) => {
        setEstimate(data);
        setLoading(false);

        if (data == null && !hasRequestedGenerate.current) {
          hasRequestedGenerate.current = true;
          calculateBetaEstimateForUser(userId).then((result) => {
            if (!result.success && result.message) {
              setError(new Error(result.message));
            }
          }).catch((err) => {
            setError(err instanceof Error ? err : new Error(String(err)));
          });
        }
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    hasRequestedGenerate.current = false;
    await requestGenerate();
    setLoading(false);
  }, [userId, requestGenerate]);

  return { estimate, loading, error, refresh };
}

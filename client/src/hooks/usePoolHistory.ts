/**
 * POOL HISTORY HOOK
 * =================
 * Reads closed pool periods from `communityPool/current/history`, newest
 * first, then hands them back oldest-first because that is the direction a
 * chart reads.
 *
 * This collection only exists going forward: finalizePoolPeriod started
 * archiving each period in Wave B. Before that the pool was a single mutable
 * document, so finalising a period destroyed it. That means the chart is
 * genuinely empty until the first period closes, and it says so rather than
 * drawing a plausible curve.
 */
import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

export interface PoolHistoryPoint {
  period: string;
  totalPoolCents: number;
  activeParticipants: number;
  averagePoolScore: number;
  safetyFactor: number;
}

export function usePoolHistory(maxPeriods = 12) {
  const [history, setHistory] = useState<PoolHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'communityPool', 'current', 'history'),
      orderBy('period', 'desc'),
      limit(maxPeriods),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const points = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            period: String(data.period ?? d.id),
            totalPoolCents: Number(data.totalPoolCents ?? 0),
            activeParticipants: Number(data.activeParticipants ?? 0),
            averagePoolScore: Number(data.averagePoolScore ?? 0),
            safetyFactor: Number(data.safetyFactor ?? 0),
          };
        });
        // Newest-first from Firestore, oldest-first for the chart.
        setHistory(points.reverse());
        setLoading(false);
      },
      (err) => {
        console.error('[usePoolHistory] subscription error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [maxPeriods]);

  return { history, loading, error };
}

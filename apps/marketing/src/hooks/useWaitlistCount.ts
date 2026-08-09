import { useEffect, useState } from 'react';
import { fetchWaitlistCount } from '@/lib/api';

/**
 * Real waitlist size, or null when it cannot be read.
 * Null means the caller must omit the claim entirely: a made-up number on a
 * financial-services page is worse than no number.
 */
export function useWaitlistCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchWaitlistCount().then((value) => {
      if (!cancelled) setCount(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { fullTitle, metaForPath } from '@/lib/route-meta';

/**
 * Keeps document.title and the meta description in step with the current route
 * after a client-side navigation.
 *
 * On first paint these already hold the correct prerendered values, so this
 * only matters once wouter starts swapping routes without a page load. It reads
 * the same table scripts/prerender.mjs writes from, so the two cannot diverge.
 */
export function useRouteMeta(): void {
  const [location] = useLocation();

  useEffect(() => {
    const meta = metaForPath(location);
    if (!meta) return;

    document.title = fullTitle(meta);

    const tag = document.querySelector('meta[name="description"]');
    if (tag) tag.setAttribute('content', meta.desc);
  }, [location]);
}

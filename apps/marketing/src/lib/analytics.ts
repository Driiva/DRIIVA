/**
 * Privacy-first analytics shim. The Plausible script is mounted in
 * index.html with a `defer` and `data-domain="driiva.co.uk"`; no cookies,
 * no IPs stored, no cross-site identifiers. This module exposes a thin
 * helper for custom event tracking (e.g. waitlist submits, CTA clicks).
 */

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
  }
}

export function trackEvent(
  event: string,
  props?: Record<string, string | number | boolean>,
): void {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.plausible !== 'function') return;
    window.plausible(event, props ? { props } : undefined);
  } catch {
    /* analytics never throws to the host page */
  }
}

export function trackPageView(): void {
  trackEvent('pageview');
}

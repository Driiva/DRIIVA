/**
 * Privacy-first analytics shim backed by Vercel Web Analytics.
 *
 * `<Analytics />` is mounted at the app root in App.tsx and handles
 * pageviews automatically. This module exposes a thin helper for
 * custom event tracking (waitlist submits, CTA clicks). It never
 * throws to the host page.
 */
import { track } from '@vercel/analytics';

type Props = Record<string, string | number | boolean | null>;

export function trackEvent(event: string, props?: Props): void {
  try {
    if (typeof window === 'undefined') return;
    track(event, props);
  } catch {
    /* analytics never throws to the host page */
  }
}

export function trackPageView(): void {
  // No-op: Vercel Analytics auto-tracks pageviews via the <Analytics />
  // component. Kept as a public symbol so callers do not need to change.
}

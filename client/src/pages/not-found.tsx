/**
 * The 404.
 *
 * This was the Vite starter's page, shipped: light mode inside a dark
 * instrument app, gray-50 and gray-900 hardcoded, and a body line reading
 * "Did you forget to add the page to the router?" A message written to the
 * developer was being shown to drivers.
 *
 * Rebuilt against checklist.design/website/404, which asks for five things: a
 * logo or mark, a title making it clear this is a 404, a description of why
 * they are here, links onward, and some brand presence. The one item taken
 * loosely is the last: brand personality on this product is restraint, so the
 * flair is the wordmark and the ground, not an illustration.
 */
import { Link } from 'wouter';
import { ArrowLeft, LifeBuoy } from 'lucide-react';

import { FadeUp } from '@/components/motion/Reveal';
import wordmark from '@/assets/logo-wordmark-white-v3.png';

export default function NotFound() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-6"
      style={{ background: 'var(--app-bg)' }}
    >
      <FadeUp className="w-full max-w-sm text-center">
        <img
          src={wordmark}
          alt="Driiva"
          className="h-5 w-auto mx-auto mb-10 opacity-90"
        />

        <p
          className="font-mono text-xs uppercase mb-3"
          style={{ color: 'var(--app-text-mut)', letterSpacing: '0.08em' }}
        >
          Error 404
        </p>

        <h1 className="font-display text-2xl mb-3" style={{ color: 'var(--app-text-hero)' }}>
          This page is not here.
        </h1>

        <p className="text-sm measure-tight mx-auto" style={{ color: 'var(--app-text-sec)' }}>
          The link may be out of date, or the page may have moved. Nothing on your account has
          changed.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 h-11 text-sm font-semibold"
            style={{
              borderRadius: 'var(--radius-button)',
              background: 'var(--app-primary)',
              color: 'var(--app-text-hero)',
            }}
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            Back to your dashboard
          </Link>

          <Link
            href="/support"
            className="inline-flex items-center justify-center gap-2 h-11 text-sm"
            style={{
              borderRadius: 'var(--radius-button)',
              background: 'var(--app-surface-1)',
              border: '1px solid var(--app-border)',
              color: 'var(--app-text-pri)',
            }}
          >
            <LifeBuoy className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            Contact support
          </Link>
        </div>
      </FadeUp>
    </div>
  );
}

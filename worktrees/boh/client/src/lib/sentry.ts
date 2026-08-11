/**
 * SENTRY ERROR MONITORING
 * =======================
 * Initializes Sentry for the client-side application.
 *
 * Set VITE_SENTRY_DSN in .env to enable. If not set, Sentry is a no-op
 * and the app functions normally without error reporting.
 *
 * Captures:
 *   - Unhandled exceptions and promise rejections
 *   - React component errors (via Error Boundary integration)
 *   - Performance transactions (page loads, navigations)
 *   - Console errors in production
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.MODE || 'development';
const IS_PRODUCTION = ENVIRONMENT === 'production';

/**
 * Initialize Sentry. Safe to call even if DSN is not set.
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    if (!IS_PRODUCTION) {
      console.info('[Sentry] No VITE_SENTRY_DSN set — error monitoring disabled.');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: `driiva-client@${__APP_VERSION__}`,

    // Send default PII (IP address, user details) — configured in Sentry project
    sendDefaultPii: true,

    // Performance: Sample 100% in dev, 10% in production
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,

    // Session replay: Capture 1% of sessions normally, 100% when error occurs
    replaysSessionSampleRate: IS_PRODUCTION ? 0.01 : 0,
    replaysOnErrorSampleRate: IS_PRODUCTION ? 1.0 : 0,

    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Scrub sensitive data before sending
    beforeSend(event) {
      // Remove auth tokens from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(crumb => {
          if (crumb.data?.url) {
            // Strip query params that might contain tokens
            try {
              const url = new URL(crumb.data.url);
              url.searchParams.delete('token');
              url.searchParams.delete('apiKey');
              crumb.data.url = url.toString();
            } catch {
              // Not a valid URL, leave as-is
            }
          }
          return crumb;
        });
      }
      return event;
    },

    // Ignore known non-actionable errors
    ignoreErrors: [
      // Browser extensions
      'ResizeObserver loop',
      'ResizeObserver loop limit exceeded',
      // Network issues
      'Failed to fetch',
      'NetworkError',
      'Load failed',
      // Auth state (expected during logout)
      'auth/network-request-failed',
    ],
  });

  console.info(`[Sentry] Initialized (${ENVIRONMENT})`);
}

/**
 * Report an error to Sentry with extra context.
 */
export function captureError(
  error: Error | string,
  context?: Record<string, unknown>,
): void {
  const err = typeof error === 'string' ? new Error(error) : error;

  if (SENTRY_DSN) {
    Sentry.captureException(err, {
      extra: context,
    });
  }

  // Always log to console in dev
  if (!IS_PRODUCTION) {
    console.error('[Error]', err, context);
  }
}

/**
 * Set the current user for Sentry context.
 * Call after successful authentication.
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
} | null): void {
  if (!SENTRY_DSN) return;

  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add a breadcrumb for debugging context.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
): void {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

// Re-export Sentry's ErrorBoundary for use in React components
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// Declare version constant (set by Vite define plugin)
declare const __APP_VERSION__: string;

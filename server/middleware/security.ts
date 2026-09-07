import express from 'express';
import { makeRateLimiter, normalizeIp } from './distributedRateLimit';

/**
 * Rate limiters — distributed-safe for Vercel serverless.
 *
 * In production these use Upstash Redis REST (UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN) so counters are shared across all serverless
 * invocations. Without those env vars they fall back to in-memory (fine
 * for local dev; a warning is logged if NODE_ENV=production).
 *
 * Window / limit changes vs the old express-rate-limit config:
 *   authLimiter:     was 5/15 min  → now 10/1 min   (spec requirement)
 *   apiLimiter:      was 100/15 min → now 100/1 min  (spec requirement)
 *   webhookLimiter:  unchanged 10/1 min
 *   tripDataLimiter: unchanged 30/5 min
 */

// /api/auth/* — 10 requests per minute per IP
export const authLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `auth:${normalizeIp(req)}`,
  message: 'Too many authentication attempts, please try again later.',
});

// General /api/* — 100 requests per minute per IP
export const apiLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => `api:${normalizeIp(req)}`,
  message: 'Too many requests from this IP, please try again later.',
});

// Stripe webhook — 10 per minute per IP
export const webhookLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `webhook:${normalizeIp(req)}`,
  message: 'Too many webhook requests.',
});

// Trip data — 30 per 5 minutes per IP
export const tripDataLimiter = makeRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `trip:${normalizeIp(req)}`,
  message: 'Too many trip data requests.',
});

// /api/ai/coach — 5 requests per minute per authenticated user ID
// Exported so routes/ai.ts can apply it as middleware on the coach endpoint.
export const coachLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  // req.auth is set by verifyFirebaseAuth before this middleware runs
  keyGenerator: (req) => {
    const authReq = req as express.Request & { auth?: { uid?: string } };
    return `coach:${authReq.auth?.uid ?? normalizeIp(req)}`;
  },
  message: 'AI coach rate limit exceeded. Please wait before sending another request.',
});

// Enhanced security headers
export const securityHeaders = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');

  const isDev = process.env.NODE_ENV !== 'production';

  /*
   * Dev-only connect-src additions, and why the loopback ones are here.
   *
   * The Firebase emulators listen on 127.0.0.1 while the dev server serves the
   * page from localhost, so every emulator call is cross-origin and
   * connect-src 'self' refused it. Firebase reports that refusal as
   * auth/network-request-failed, which reads as a network fault or a bad
   * config and is neither - it is this header. That is what kept the four
   * authenticated routes NOT REACHED in `npm run gates`, and why chasing it
   * through browser extensions and emulator ports never landed.
   *
   * Loopback and plain http only reach the policy when NODE_ENV is not
   * production, so the shipped policy is byte-for-byte what it was.
   */
  const devConnectSrc = isDev
    ? "ws: wss: http://127.0.0.1:* http://localhost:*"
    : "";

  /*
   * Sentry ingest, in EVERY environment including production.
   *
   * client/src/lib/sentry.ts has been initialising Sentry for months and not
   * one browser event has ever arrived, because connect-src had no Sentry host
   * at all, so every envelope POST was refused by this header. The failure is
   * silent by design: Sentry swallows transport errors so it cannot take the
   * app down with it, which is why an error monitor reporting nothing looked
   * exactly like an app with no errors.
   *
   * Both regional hosts are listed on purpose. The live DSN is the DE one
   * (o4510852635099136.ingest.de.sentry.io), so a policy carrying only
   * *.ingest.sentry.io would still refuse every send - that near-miss is the
   * whole reason this is pinned by a test below. Dev-only would be useless:
   * production is the environment whose errors nobody can otherwise see.
   */
  const SENTRY_INGEST = "https://*.ingest.sentry.io https://*.ingest.de.sentry.io";

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${isDev ? "'unsafe-inline' 'unsafe-eval'" : ""} https://*.firebaseapp.com https://*.firebase.com https://*.googletagmanager.com https://js.stripe.com`,
    `connect-src 'self' ${devConnectSrc} https://*.googleapis.com https://*.firebaseio.com https://api.anthropic.com wss://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.stripe.com ${SENTRY_INGEST}`,
    "img-src 'self' data: https://*.openstreetmap.org https://*.googletagmanager.com https://*.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "frame-src https://*.firebaseapp.com https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
  ];

  res.setHeader('Content-Security-Policy', csp.join('; '));

  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = (req.query[key] as string).trim().replace(/[<>]/g, '');
      }
    });
  }

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    const sanitizeObject = (obj: Record<string, unknown>): void => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
          obj[key] = (obj[key] as string).trim().replace(/[<>]/g, '');
        } else if (obj[key] !== null && typeof obj[key] === 'object') {
          sanitizeObject(obj[key] as Record<string, unknown>);
        }
      }
    };
    sanitizeObject(req.body as Record<string, unknown>);
  }

  next();
};

// Error handling middleware
export const errorHandler = (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: {
      message: isDevelopment ? err.message : 'Internal server error',
      code: 500,
      timestamp: new Date().toISOString()
    }
  });
};
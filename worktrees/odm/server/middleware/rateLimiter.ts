/**
 * Rate limiters for sensitive and high-impact endpoints.
 * Use in addition to global API limiter to reduce DoS and abuse risk.
 *
 * - gdprDeleteLimiter: DELETE /api/gdpr/delete/:userId — account wipe (strict)
 * - poolModificationLimiter: PUT /api/community-pool — admin pool updates
 * - authSensitiveLimiter: login/register (reuse from security or define here)
 */

import rateLimit from "express-rate-limit";

/** GDPR delete: very strict — e.g. 3 attempts per hour per IP. */
export const gdprDeleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { message: "Too many delete attempts. Try again later.", code: "RATE_LIMIT_GDPR" },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Community pool modifications: 10 per 15 min per IP. */
export const poolModificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many pool update attempts.", code: "RATE_LIMIT_POOL" },
  standardHeaders: true,
  legacyHeaders: false,
});

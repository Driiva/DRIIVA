/**
 * API route registration. One module per domain, all mounted here in one
 * place so the auth middleware order is visible at a glance:
 *
 *   auth.ts        profile, Firebase token exchange, WebAuthn passkeys
 *   telematics.ts  dashboard, trips, scores, incidents, insights
 *   community.ts   community pool, leaderboard, achievements, refund simulator
 *   gdpr.ts        data export and deletion
 *   ai.ts          AI coach and the general ask endpoint
 *   payments.ts    Stripe subscription, checkout and billing portal
 *   webhooks.ts    Stripe and Root inbound webhooks
 *
 * All /api/* routes are protected except:
 *
 * PUBLIC (no auth): POST /api/auth/firebase, WebAuthn check/authenticate,
 *   GET /api/community-pool, GET /api/leaderboard, GET /api/achievements (list),
 *   the webhooks (signature-verified instead) and GET /api/health.
 *
 * PROTECTED (requireAuth): /api/profile/me, /api/auth/check, POST /api/incidents,
 *   POST /api/simulate-refund, POST /api/ask, the AI coach and the payment routes.
 *   Routes with :userId also use requireResourceOwner so User A cannot access
 *   User B's data (dashboard, trips, scores, insights, achievements, GDPR).
 *
 * ADMIN (requireAuth + requireAdmin): PUT /api/community-pool. Rate limited via
 * poolModificationLimiter. GDPR delete is rate limited via gdprDeleteLimiter.
 *
 * The full inventory (method, path, handler count) is pinned by
 * server/__tests__/route-inventory.test.ts; the module layout by
 * tests/unit/server-route-modules.test.ts.
 */
import type { Express } from "express";
import { verifyFirebaseAuth } from "../middleware/auth";
import { registerAuthRoutes } from "./auth";
import { registerTelematicsRoutes } from "./telematics";
import { registerCommunityRoutes } from "./community";
import { registerGdprRoutes } from "./gdpr";
import { registerAiRoutes } from "./ai";
import { registerPaymentRoutes } from "./payments";
import { registerWebhookRoutes } from "./webhooks";

export async function registerRoutes(app: Express): Promise<void> {
  // Verify Firebase JWT on all requests; sets req.auth { uid, email, userId } from token only (never from headers)
  app.use(verifyFirebaseAuth);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  registerAuthRoutes(app);
  registerTelematicsRoutes(app);
  registerCommunityRoutes(app);
  registerGdprRoutes(app);
  registerAiRoutes(app);
  registerPaymentRoutes(app);
  registerWebhookRoutes(app);
}

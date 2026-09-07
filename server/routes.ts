/**
 * API route registration. All /api/* routes are protected except:
 *
 * PUBLIC (no auth): POST /api/auth/login, POST /api/auth/register, POST /api/auth/firebase,
 *   WebAuthn endpoints, GET /api/community-pool, GET /api/leaderboard, GET /api/achievements (list).
 *
 * PROTECTED (requireAuth): /api/profile/me, /api/auth/check, POST /api/incidents,
 *   POST /api/simulate-refund, POST /api/ask. Routes with :userId also use requireResourceOwner
 *   so User A cannot access User B's data (dashboard, trips, scores, insights, achievements, GDPR).
 *
 * ADMIN (requireAuth + requireAdmin): PUT /api/community-pool. Rate limited via poolModificationLimiter.
 * GDPR delete is rate limited via gdprDeleteLimiter.
 *
 * The handlers themselves live in server/http/, one module per group, and are
 * registered below in the same order they were declared when this file held
 * them all. Registration order is not load-bearing (no two groups share a
 * path), but it is preserved so the route table reads the same as before.
 */
import type { Express } from "express";
import { verifyFirebaseAuth } from "./middleware/auth";
import { registerAuthRoutes } from "./http/authRoutes";
import { registerDriverRoutes } from "./http/driverRoutes";
import { registerCommunityRoutes } from "./http/communityRoutes";
import { registerAiRoutes } from "./http/aiRoutes";
import { registerPaymentRoutes } from "./http/paymentRoutes";
import { registerWebhookRoutes } from "./http/webhookRoutes";

export async function registerRoutes(app: Express): Promise<void> {
  // Verify Firebase JWT on all requests; sets req.auth { uid, email, userId } from token only (never from headers)
  app.use(verifyFirebaseAuth);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  registerAuthRoutes(app);
  registerDriverRoutes(app);
  registerCommunityRoutes(app);
  registerAiRoutes(app);
  registerPaymentRoutes(app);
  registerWebhookRoutes(app);
}

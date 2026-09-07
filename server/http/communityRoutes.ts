/**
 * Community, rewards and data-rights routes: the community pool, the cached
 * leaderboard, achievements, the refund simulator, AI insights and the two
 * GDPR endpoints. Extracted verbatim from server/routes.ts.
 *
 * PUBLIC (no auth): GET /api/community-pool, GET /api/leaderboard,
 *   GET /api/achievements.
 * ADMIN: PUT /api/community-pool (requireAdmin + poolModificationLimiter).
 * GDPR delete is rate limited via gdprDeleteLimiter.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { calculateRefundCents } from "../../packages/scoring/src/refund";
import { aiInsightsEngine } from "../lib/aiInsights";
import { gdprDeleteLimiter, poolModificationLimiter } from "../middleware/rateLimiter";
import {
  requireAuth,
  requireResourceOwner,
  requireAdmin,
  type AuthRequest,
} from "../middleware/auth";
import { getCachedLeaderboard, setCachedLeaderboard } from "./leaderboardCache";

export function registerCommunityRoutes(app: Express): void {
  // Get community pool (public read-only)
  app.get("/api/community-pool", async (req, res) => {
    try {
      const pool = await storage.getCommunityPool();
      res.json(pool);
    } catch (error) {
      res.status(500).json({ message: "Error fetching community pool" });
    }
  });

  // Update community pool (admin only; rate limited)
  app.put("/api/community-pool", requireAuth, requireAdmin, poolModificationLimiter, async (req, res) => {
    try {
      const poolData = req.body;
      const pool = await storage.updateCommunityPool(poolData);
      res.json(pool);
    } catch (error) {
      res.status(500).json({ message: "Error updating community pool" });
    }
  });

  // Get leaderboard (cached — 60s TTL)
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const period = req.query.period as string || 'weekly';
      const limit = parseInt(req.query.limit as string) || 50;
      const cacheKey = `${period}:${limit}`;

      const cached = getCachedLeaderboard(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const leaderboard = await storage.getLeaderboard(period, limit);
      setCachedLeaderboard(cacheKey, leaderboard);
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ message: "Error fetching leaderboard" });
    }
  });

  // Get achievements
  app.get("/api/achievements", async (req, res) => {
    try {
      const achievements = await storage.getAchievements();
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ message: "Error fetching achievements" });
    }
  });

  // Get user achievements (protected: own data only)
  app.get("/api/achievements/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      const achievements = await storage.getUserAchievements(userId);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user achievements" });
    }
  });

  // Refund simulator (protected)
  app.post("/api/simulate-refund", requireAuth, async (req, res) => {
    try {
      const { personalScore, poolSafetyFactor, premiumAmount } = req.body;
      const communityScore = 75;
      const premiumCents = Math.round(premiumAmount * 100);
      const refund = calculateRefundCents(personalScore, communityScore, premiumCents, poolSafetyFactor, premiumCents);
      res.json({ refund });
    } catch (error) {
      res.status(500).json({ message: "Error simulating refund" });
    }
  });

  // AI insights (protected: own data only)
  app.get("/api/insights/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      
      // Get user profile and recent trips
      const profile = await storage.getDrivingProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Driving profile not found" });
      }
      
      const trips = await storage.getTrips(userId, 20, 0);
      const communityPool = await storage.getCommunityPool(1);
      
      // Generate AI insights
      const insights = aiInsightsEngine.generateInsights(
        profile,
        trips,
        Number(communityPool?.safetyFactor) * 100 || 75
      );
      
      res.json(insights);
    } catch (error) {
      res.status(500).json({ message: "Error generating insights" });
    }
  });

  // GDPR: Export user data (protected: own data only)
  app.get("/api/gdpr/export/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      const userData = await storage.exportUserData(userId);

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=driiva-data-${userId}.json`);
      res.json(userData);
    } catch (error) {
      res.status(500).json({ message: "Error exporting data" });
    }
  });

  // GDPR: Delete user account (protected: own data only; strict rate limit)
  app.delete("/api/gdpr/delete/:userId", requireAuth, requireResourceOwner("userId"), gdprDeleteLimiter, async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      await storage.deleteUserData(userId);
      res.json({ message: "User data deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting user data" });
    }
  });
}

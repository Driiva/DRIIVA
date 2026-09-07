/**
 * Community routes: the shared pool, the public leaderboard, the achievement
 * catalogue and the refund simulator.
 *
 * Reads are public and cached where they are hot; the one write, updating
 * the pool, is admin-only and rate limited.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { calculateRefundCents } from "../../packages/scoring/src/refund";
import { getCachedLeaderboard, setCachedLeaderboard } from "../lib/leaderboardCache";
import { poolModificationLimiter } from "../middleware/rateLimiter";
import { requireAuth, requireResourceOwner, requireAdmin, type AuthRequest } from "../middleware/auth";

export function registerCommunityRoutes(app: Express): void {
  // Get community pool (public read-only)
  app.get("/api/community-pool", async (req, res) => {
    try {
      const pool = await storage.getCommunityPool();
      res.json(pool);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching community pool" });
    }
  });

  // Update community pool (admin only; rate limited)
  app.put("/api/community-pool", requireAuth, requireAdmin, poolModificationLimiter, async (req, res) => {
    try {
      const poolData = req.body;
      const pool = await storage.updateCommunityPool(poolData);
      res.json(pool);
    } catch (error: any) {
      res.status(500).json({ message: "Error updating community pool" });
    }
  });

  // Get leaderboard (cached, 60s TTL)
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
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching leaderboard" });
    }
  });

  // Get achievements
  app.get("/api/achievements", async (req, res) => {
    try {
      const achievements = await storage.getAchievements();
      res.json(achievements);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching achievements" });
    }
  });

  // Get user achievements (protected: own data only)
  app.get("/api/achievements/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      const achievements = await storage.getUserAchievements(userId);
      res.json(achievements);
    } catch (error: any) {
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
    } catch (error: any) {
      res.status(500).json({ message: "Error simulating refund" });
    }
  });
}

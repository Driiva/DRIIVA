/**
 * Driver-facing data routes: dashboard, trips, aggregated scores and incident
 * reporting. Extracted verbatim from server/routes.ts; every path is
 * requireAuth + requireResourceOwner("userId") except POST /api/incidents,
 * which takes its userId from the verified token.
 */
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { calculateRefundCents } from "../../packages/scoring/src/refund";
import { scoreAggregation } from "../lib/scoreAggregation";
import { insertIncidentSchema } from "@shared/schema";
import { requireAuth, requireResourceOwner, type AuthRequest } from "../middleware/auth";
import { getCachedLeaderboard, setCachedLeaderboard } from "./leaderboardCache";

export function registerDriverRoutes(app: Express): void {
  // Get user dashboard data (protected: token required; user can only access own dashboard)
  app.get("/api/dashboard/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;

      const user = await storage.getUser(userId);
      const profile = await storage.getDrivingProfile(userId);
      const recentTrips = await storage.getUserTrips(userId, 5);
      const pool = await storage.getCommunityPool();
      const achievements = await storage.getUserAchievements(userId);
      const lbCacheKey = 'weekly:10';
      const leaderboard = getCachedLeaderboard(lbCacheKey) ?? await (async () => {
        const lb = await storage.getLeaderboard('weekly', 10);
        setCachedLeaderboard(lbCacheKey, lb);
        return lb;
      })();

      if (!user || !profile) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate projected refund. Inlined from the retired
      // server/lib/telematics.ts TelematicsProcessor.calculateRefund wrapper:
      // fixed default community score of 75, premium amount doubles as both
      // the contribution and the cap base, same as before.
      const poolSafetyFactor = pool?.safetyFactor || 0.80;
      const communityScore = 75;
      const premiumCents = Math.round(Number(user.premiumAmount) * 100);
      const projectedRefund = calculateRefundCents(
        profile.currentScore || 0,
        communityScore,
        premiumCents,
        Number(poolSafetyFactor),
        premiumCents
      );
      res.json({
        user,
        profile: { ...profile, projectedRefund },
        recentTrips,
        communityPool: pool,
        achievements,
        leaderboard
      });
    } catch (error) {
      console.error("Dashboard error details:", error);
      res.status(500).json({ message: "Error fetching dashboard data" });
    }
  });

  // Get user trips (protected: user can only access own trips)
  app.get("/api/trips/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Support date range filtering for time-series optimization
      if (req.query.startDate && req.query.endDate) {
        const startDate = new Date(req.query.startDate as string);
        const endDate = new Date(req.query.endDate as string);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({ message: 'Invalid startDate or endDate; use ISO 8601 format' });
        }
        if (endDate <= startDate) {
          return res.status(400).json({ message: 'endDate must be after startDate' });
        }
        const trips = await storage.getTripsByDateRange(userId, startDate, endDate, limit);
        return res.json(trips);
      }
      
      const trips = await storage.getUserTrips(userId, limit, offset);
      res.json(trips);
    } catch (error) {
      res.status(500).json({ message: "Error fetching trips" });
    }
  });

  // Get aggregated weekly score (protected: own data only)
  app.get("/api/scores/weekly/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      const weekStart = req.query.weekStart 
        ? new Date(req.query.weekStart as string)
        : undefined;
      
      const score = await scoreAggregation.getWeeklyScore(userId, weekStart);
      if (!score) {
        return res.status(404).json({ message: "No trips found for this week" });
      }
      res.json(score);
    } catch (error) {
      res.status(500).json({ message: "Error fetching weekly score" });
    }
  });

  // Get aggregated monthly score (protected: own data only)
  app.get("/api/scores/monthly/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      const monthStart = req.query.monthStart 
        ? new Date(req.query.monthStart as string)
        : undefined;
      
      const score = await scoreAggregation.getMonthlyScore(userId, monthStart);
      if (!score) {
        return res.status(404).json({ message: "No trips found for this month" });
      }
      res.json(score);
    } catch (error) {
      res.status(500).json({ message: "Error fetching monthly score" });
    }
  });

  // Get time-series data (protected: own data only)
  app.get("/api/scores/timeseries/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      const startDate = new Date(req.query.startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      const endDate = new Date(req.query.endDate as string || new Date().toISOString());
      const granularity = (req.query.granularity as 'daily' | 'weekly' | 'monthly') || 'daily';
      
      const data = await scoreAggregation.getTimeSeriesData(userId, startDate, endDate, granularity);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Error fetching time-series data" });
    }
  });

  // Get score trend (protected: own data only)
  app.get("/api/scores/trend/:userId", requireAuth, requireResourceOwner("userId"), async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      const period = (req.query.period as 'weekly' | 'monthly') || 'weekly';
      
      const trend = await scoreAggregation.getScoreTrend(userId, period);
      res.json(trend);
    } catch (error) {
      res.status(500).json({ message: "Error fetching score trend" });
    }
  });

  // Report incident (protected: userId set from token)
  app.post("/api/incidents", requireAuth, async (req: AuthRequest, res) => {
    try {
      const incidentData = {
        ...req.body,
        userId: req.auth!.userId,
        reportedAt: new Date(),
        timestamp: req.body.timestamp || new Date().toISOString()
      };

      const validatedData = insertIncidentSchema.parse(incidentData);
      const incident = await storage.createIncident(validatedData);
      res.json(incident);
    } catch (error) {
      console.error("Incident submission error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      } else {
        res.status(500).json({ message: "Error reporting incident" });
      }
    }
  });

}

/**
 * API route registration. All /api/* routes are protected except:
 *
 * PUBLIC (no auth): POST /api/auth/login, POST /api/auth/register, POST /api/auth/firebase,
 *   WebAuthn endpoints, GET /api/community-pool, GET /api/leaderboard, GET /api/achievements (list).
 *
 * PROTECTED (requireAuth): /api/profile/me, /api/auth/check, POST /api/trips, POST /api/incidents,
 *   POST /api/simulate-refund, POST /api/ask. Routes with :userId also use requireResourceOwner
 *   so User A cannot access User B's data (dashboard, trips, scores, insights, achievements, GDPR).
 *
 * ADMIN (requireAuth + requireAdmin): PUT /api/community-pool. Rate limited via poolModificationLimiter.
 * GDPR delete is rate limited via gdprDeleteLimiter.
 */
import type { Express } from "express";
import { storage } from "./storage";
import { crypto } from "./lib/crypto";
import { telematicsProcessor, TelematicsData, TripJSON } from "./lib/telematics";
import { aiInsightsEngine } from "./lib/aiInsights";
import { scoreAggregation } from "./lib/scoreAggregation";
import { insertTripSchema, insertIncidentSchema, type InsertDrivingProfile } from "@shared/schema";
import { z } from "zod";
import { webauthnService } from "./webauthn";
import { authLimiter, tripDataLimiter, webhookLimiter, coachLimiter } from "./middleware/security";
import { gdprDeleteLimiter, poolModificationLimiter } from "./middleware/rateLimiter";
import {
  verifyFirebaseAuth,
  requireAuth,
  requireResourceOwner,
  requireAdmin,
  type AuthRequest,
} from "./middleware/auth";
import { getStripe, getStripeWebhookSecret, stripeIdempotencyKey } from "./lib/stripe";
import { transitionPolicy, createPolicyWithAudit, InvalidPolicyTransitionError } from "./lib/policyLifecycle";
import { emitPoolContribution } from "./lib/poolContribution";

// In-memory TTL cache for leaderboard (public, read-heavy, rarely changes)
const leaderboardCache = new Map<string, { data: unknown; expiresAt: number }>();
const LEADERBOARD_CACHE_TTL_MS = 60_000; // 60 seconds

function getCachedLeaderboard(key: string): unknown | null {
  const entry = leaderboardCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    leaderboardCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedLeaderboard(key: string, data: unknown): void {
  leaderboardCache.set(key, { data, expiresAt: Date.now() + LEADERBOARD_CACHE_TTL_MS });
}

function invalidateLeaderboardCache(): void {
  leaderboardCache.clear();
}

/**
 * Server-side allow-list of Stripe Price IDs a client may reference directly.
 * Without this a user could substitute a cheaper Stripe Price in create-subscription's
 * legacy branch or in create-checkout. The list is sourced from server env only —
 * never from the request body. STRIPE_MONTHLY_PRICE_ID is always included when set;
 * STRIPE_ALLOWED_PRICE_IDS is an optional comma-separated list for any additional
 * prices (e.g. one-off add-on Prices used by create-checkout).
 */
function allowedStripePriceIds(): Set<string> {
  const ids = new Set<string>();
  const monthly = process.env.STRIPE_MONTHLY_PRICE_ID;
  if (monthly) ids.add(monthly);
  const extra = process.env.STRIPE_ALLOWED_PRICE_IDS;
  if (extra) {
    for (const id of extra.split(',').map(s => s.trim()).filter(Boolean)) {
      ids.add(id);
    }
  }
  return ids;
}

export async function registerRoutes(app: Express): Promise<void> {
  // Verify Firebase JWT on all requests; sets req.auth { uid, email, userId } from token only (never from headers)
  app.use(verifyFirebaseAuth);

  // -------------------------------------------------------------------------
  // PUBLIC ROUTES (no auth) — login, register, webauthn, read-only leaderboard/achievements/community-pool
  // -------------------------------------------------------------------------

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // -------------------------------------------------------------------------
  // Profile API (protected: Firebase token required; identity from token only)
  // -------------------------------------------------------------------------
  app.get("/api/profile/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.uid;
      const email = req.auth!.email ?? "";
      let profile = await storage.getUserByFirebaseUid(uid);
      if (!profile && email) {
        profile = await storage.getOrCreateUserByFirebase(uid, email, undefined);
      }
      if (!profile) {
        return res.status(404).json({ message: "Profile not found. Sign up first." });
      }
      const { password: _, ...safe } = profile;
      res.json({
        id: String(profile.id),
        firebaseUid: profile.firebaseUid,
        email: profile.email,
        name: profile.displayName ?? profile.firstName ?? profile.email?.split("@")[0] ?? "User",
        onboardingComplete: profile.onboardingComplete === true,
      });
    } catch (error: unknown) {
      console.error("GET /api/profile/me error:", error);
      res.status(500).json({ message: "Error fetching profile" });
    }
  });

  // Retired (M1 T3): this endpoint's only job was writing the Postgres
  // onboardingComplete column, which no longer gates anything now that
  // onboarding completion is a Firestore-only write (quick-onboarding.tsx
  // handleComplete, per DEC-4). No other profile field was ever writable
  // here, so the endpoint is deprecated outright rather than trimmed.
  app.patch("/api/profile/me", requireAuth, (_req: AuthRequest, res) => {
    console.warn("PATCH /api/profile/me called but is retired: onboarding completion is Firestore-only");
    res.status(410).json({ message: "Retired. Onboarding completion is now written directly to Firestore." });
  });

  // Auth check: requires valid Firebase JWT; returns authenticated + user from verified token (never trusts x-user-id)
  app.get("/api/auth/check", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.uid;
      const user = await storage.getUserByFirebaseUid(uid);
      if (!user) {
        return res.status(200).json({ authenticated: true, user: null, firebaseUid: uid });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json({ authenticated: true, user: userWithoutPassword });
    } catch (e) {
      console.error("GET /api/auth/check error:", e);
      res.status(500).json({ authenticated: false });
    }
  });


  // Firebase Authentication — verify ID token from client-side Firebase sign-in
  app.post("/api/auth/firebase", authLimiter, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token required" });
      }
      const { verifyFirebaseToken } = await import("./lib/firebase-admin");
      const decoded = await verifyFirebaseToken(token);
      if (!decoded) {
        return res.status(401).json({ message: "Invalid token" });
      }
      res.json({ authenticated: true, user: { uid: decoded.uid, email: decoded.email } });
    } catch (error) {
      console.error("Firebase auth error:", error);
      res.status(401).json({ message: "Invalid token" });
    }
  });

  // -------------------------------------------------------------------------
  // WebAuthn (Face ID / Touch ID) — all lookups use email, not username
  // -------------------------------------------------------------------------

  // Public: check whether a passkey exists for an email (pre-login, no auth required)
  app.post("/api/auth/webauthn/check", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "email required" });
      }
      const hasPasskey = await webauthnService.hasCredentials(email);
      res.json({ hasPasskey });
    } catch (error: any) {
      console.error("WebAuthn check error:", error);
      res.json({ hasPasskey: false });
    }
  });

  // Passkey ENROLMENT is an authenticated action: a logged-in user binds a new
  // authenticator to their OWN account. The email comes from the verified Firebase
  // token, never the request body — otherwise anyone could enrol a passkey on any
  // account by submitting a victim's email and complete a full account takeover.
  app.post("/api/auth/webauthn/register/start", authLimiter, requireAuth, async (req: AuthRequest, res) => {
    try {
      const email = req.auth?.email;
      if (!email) return res.status(400).json({ message: "Authenticated account has no email" });
      const userAgent = req.headers['user-agent'];
      const options = await webauthnService.generateRegistrationOptions(email, userAgent);
      res.json(options);
    } catch (error: any) {
      console.error("WebAuthn registration start error:", error);
      res.status(400).json({ message: "Failed to generate registration options" });
    }
  });

  app.post("/api/auth/webauthn/register/complete", authLimiter, requireAuth, async (req: AuthRequest, res) => {
    try {
      const email = req.auth?.email;
      const { credential } = req.body;
      if (!email) return res.status(400).json({ message: "Authenticated account has no email" });
      if (!credential) return res.status(400).json({ message: "credential required" });
      const userAgent = req.headers['user-agent'];
      const result = await webauthnService.verifyRegistration(email, credential, userAgent);
      if (result.verified) {
        res.json({ success: true, message: "Biometric authentication registered successfully" });
      } else {
        res.status(400).json({ message: result.error || "Registration verification failed" });
      }
    } catch (error: any) {
      console.error("WebAuthn registration complete error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/webauthn/authenticate/start", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "email required" });
      const options = await webauthnService.generateAuthenticationOptions(email);
      res.json(options);
    } catch (error: any) {
      console.error("WebAuthn authentication start error:", error);
      res.status(400).json({ message: "Failed to generate authentication options" });
    }
  });

  // Returns customToken — client must call signInWithCustomToken() to create Firebase session
  app.post("/api/auth/webauthn/authenticate/complete", authLimiter, async (req, res) => {
    try {
      const { email, assertion } = req.body;
      if (!email || !assertion) return res.status(400).json({ message: "email and assertion required" });
      const result = await webauthnService.verifyAuthentication(email, assertion);
      if (result.verified && result.user) {
        res.json({ success: true, user: result.user, customToken: result.customToken ?? null });
      } else {
        res.status(401).json({ message: result.error || "Authentication failed" });
      }
    } catch (error: any) {
      console.error("WebAuthn authentication complete error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  // List own passkeys (protected: Firebase session required)
  app.get("/api/auth/webauthn/credentials/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.auth!.uid);
      if (!user?.email) return res.status(404).json({ message: "User not found" });
      const credentials = await webauthnService.getUserCredentials(user.email);
      res.json({
        credentials: credentials.map((cred: any) => ({
          id: cred.credentialId,
          deviceType: cred.deviceType,
          deviceName: cred.deviceName,
          createdAt: cred.createdAt,
          lastUsed: cred.lastUsed,
        })),
      });
    } catch (error: any) {
      console.error("Get credentials error:", error);
      res.status(500).json({ message: "Failed to fetch credentials" });
    }
  });

  // Remove a specific passkey (soft-delete, protected)
  app.delete("/api/auth/webauthn/credentials/:credentialId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { credentialId } = req.params;
      const deleted = await webauthnService.deleteCredential(credentialId, req.auth!.uid);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Credential not found or already removed" });
      }
    } catch (error: any) {
      console.error("Delete credential error:", error);
      res.status(500).json({ message: "Failed to delete credential" });
    }
  });


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

      // Calculate projected refund
      const poolSafetyFactor = pool?.safetyFactor || 0.80;
      const projectedRefund = telematicsProcessor.calculateRefund(
        profile.currentScore || 0,
        Number(poolSafetyFactor),
        Number(user.premiumAmount)
      );
      res.json({
        user,
        profile: { ...profile, projectedRefund },
        recentTrips,
        communityPool: pool,
        achievements,
        leaderboard
      });
    } catch (error: any) {
      console.error("Dashboard error details:", error);
      res.status(500).json({ message: "Error fetching dashboard data" });
    }
  });

  // Submit trip data (protected: auth required; userId taken from token, not body)
  app.post("/api/trips", requireAuth, tripDataLimiter, async (req: AuthRequest, res) => {
    try {
      const authenticatedUserId = req.auth!.userId!;
      const body = { ...req.body, userId: authenticatedUserId };
      const tripData = insertTripSchema.parse(body);
      const telematicsDataOrJSON: TelematicsData | TripJSON = req.body.telematicsData || req.body;
      const userId = tripData.userId;

      // Get existing trips for duplicate detection (last 24 hours)
      const checkStart = new Date();
      checkStart.setHours(checkStart.getHours() - 24);
      const existingTrips = await storage.getTripsByDateRange(
        userId,
        checkStart,
        new Date(),
        100
      );

      // Convert to format needed for duplicate check
      const existingTripsForCheck = existingTrips.map(t => ({
        startTime: new Date(t.startTime),
        endTime: new Date(t.endTime),
        distance: Number(t.distance)
      }));

      // Process telematics data with anomaly detection
      const metrics = await telematicsProcessor.processTrip(
        telematicsDataOrJSON,
        userId,
        existingTripsForCheck
      );

      // Log anomalies if detected
      if (metrics.anomalies.hasImpossibleSpeed || metrics.anomalies.hasGPSJumps || metrics.anomalies.isDuplicate) {
        console.warn(`Trip anomalies detected for user ${userId}:`, {
          impossibleSpeed: metrics.anomalies.hasImpossibleSpeed,
          gpsJumps: metrics.anomalies.hasGPSJumps,
          duplicate: metrics.anomalies.isDuplicate,
          anomalyScore: metrics.anomalies.anomalyScore
        });
      }

      // Reject duplicate trips outright. Persisting a duplicate would double-count
      // its miles, trip count and score into the running aggregates and the
      // leaderboard — a fraud and data-integrity gap. This must happen BEFORE any
      // write so no aggregate is mutated. Impossible-speed / GPS-jump anomalies are
      // not rejected: they are kept and already soft-penalised in metrics.score by
      // the processor, so we persist them rather than silently lose the trip.
      if (metrics.anomalies.isDuplicate) {
        return res.status(409).json({
          message: "Duplicate trip rejected",
          anomalies: metrics.anomalies
        });
      }

      // Require a real encryption key — no insecure fallback in production
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        console.error('ENCRYPTION_KEY env var not set; refusing to store telematics data');
        return res.status(500).json({ message: 'Server configuration error' });
      }

      // Read the current profile and compute the next aggregate values. The read
      // stays outside the transaction; the three writes below commit atomically.
      const profile = await storage.getDrivingProfile(tripData.userId);
      let newCurrentScore: number | undefined;
      let profileUpdate: Partial<InsertDrivingProfile> | undefined;
      if (profile) {
        const currentScore = profile.currentScore || 0;
        const totalTrips = profile.totalTrips || 0;
        newCurrentScore = Math.round((currentScore * totalTrips + metrics.score) / (totalTrips + 1));

        profileUpdate = {
          currentScore: newCurrentScore,
          hardBrakingScore: (profile.hardBrakingScore || 0) + metrics.hardBrakingEvents,
          accelerationScore: (profile.accelerationScore || 0) + metrics.harshAccelerationEvents,
          speedAdherenceScore: (profile.speedAdherenceScore || 0) + metrics.speedViolations,
          nightDrivingScore: (profile.nightDrivingScore || 0) + (metrics.nightDriving ? 1 : 0),
          corneringScore: (profile.corneringScore || 0) + metrics.sharpCorners,
          totalTrips: totalTrips + 1,
          totalMiles: (Number(profile.totalMiles) + metrics.distanceKm * 0.621371).toString() // Convert km to miles
        };
      }

      // Persist trip + profile + leaderboard atomically (all-or-nothing). A partial
      // write would corrupt the running aggregates the next trip is computed from.
      const { trip } = await storage.recordTripAtomic({
        trip: {
          ...tripData,
          score: metrics.score,
          hardBrakingEvents: metrics.hardBrakingEvents,
          harshAcceleration: metrics.harshAccelerationEvents,
          speedViolations: metrics.speedViolations,
          nightDriving: metrics.nightDriving,
          sharpCorners: metrics.sharpCorners,
          distance: metrics.distanceKm.toString(), // Store in km
          duration: metrics.duration,
          telematicsData: crypto.encrypt(
            JSON.stringify(telematicsDataOrJSON),
            encryptionKey
          )
        },
        profileUpdate,
        leaderboardScore: profile ? newCurrentScore : undefined
      });

      // Bust the leaderboard cache only when the leaderboard actually changed.
      if (profile) {
        invalidateLeaderboardCache();
      }

      res.json({
        trip,
        metrics: {
          ...metrics,
          distance_km: metrics.distanceKm,
          avg_speed: metrics.avgSpeed,
          harsh_braking_count: metrics.harshBrakingCount
        },
        anomalies: metrics.anomalies
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error processing trip" });
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      console.error("Incident submission error:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      } else {
        res.status(500).json({ message: "Error reporting incident" });
      }
    }
  });

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
      const refund = telematicsProcessor.calculateRefund(personalScore, poolSafetyFactor, premiumAmount);
      res.json({ refund });
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      res.status(500).json({ message: "Error exporting data" });
    }
  });

  // GDPR: Delete user account (protected: own data only; strict rate limit)
  app.delete("/api/gdpr/delete/:userId", requireAuth, requireResourceOwner("userId"), gdprDeleteLimiter, async (req: AuthRequest, res) => {
    try {
      const userId = req.auth!.userId!;
      await storage.deleteUserData(userId);
      res.json({ message: "User data deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Error deleting user data" });
    }
  });

  // Perplexity AI endpoint (protected)
  // -------------------------------------------------------------------------
  // AI Driiva — structured driving feedback per trip
  // -------------------------------------------------------------------------

  // coachLimiter: 5 req/min per user, distributed-safe (see middleware/security.ts)
  app.post("/api/ai/coach", requireAuth, coachLimiter, async (req: AuthRequest, res) => {
    try {
      const {
        score,
        scoreBreakdown,
        events,
        distanceMeters,
        durationSeconds,
        context,
        averageScore,
        totalTrips,
      } = req.body;

      if (score == null || !scoreBreakdown) {
        return res.status(400).json({ message: "Missing required trip score data" });
      }

      const distanceMiles = ((distanceMeters ?? 0) / 1609.34).toFixed(1);
      const durationMins = Math.round((durationSeconds ?? 0) / 60);

      const userPrompt = [
        `Trip data:`,
        `  Overall score: ${score}/100`,
        `  Speed score: ${scoreBreakdown.speedScore}, Braking: ${scoreBreakdown.brakingScore}, Acceleration: ${scoreBreakdown.accelerationScore}, Cornering: ${scoreBreakdown.corneringScore}, Phone: ${scoreBreakdown.phoneUsageScore}`,
        `  Hard braking events: ${events?.hardBrakingCount ?? 0}, Hard acceleration: ${events?.hardAccelerationCount ?? 0}, Speeding: ${events?.speedingSeconds ?? 0}s, Sharp turns: ${events?.sharpTurnCount ?? 0}`,
        `  Distance: ${distanceMiles} miles, Duration: ${durationMins} minutes`,
        context?.isNightDriving ? '  Night driving: yes' : '',
        context?.isRushHour ? '  Rush hour: yes' : '',
        context?.weatherCondition ? `  Weather: ${context.weatherCondition}` : '',
        averageScore != null ? `  Driver average score: ${averageScore}` : '',
        totalTrips != null ? `  Total trips recorded: ${totalTrips}` : '',
      ].filter(Boolean).join('\n');

      const systemPrompt =
        "You are Driiva's AI Driving Coach. Analyse the driving trip data and respond with ONLY valid JSON (no markdown, no backticks) in this exact shape: " +
        '{"headline":"<one sentence insight>","tips":["<tip1>","<tip2>","<tip3 optional>"],"encouragement":"<one encouraging sentence about strengths>"}. ' +
        "Tips should be specific, actionable, and based on the weakest scores. Be concise, warm, data-specific. Use UK English.";

      const provider = process.env.AI_COACH_PROVIDER ?? 'perplexity';
      const apiKey = process.env.AI_COACH_API_KEY ?? process.env.PERPLEXITY_API_KEY;

      if (!apiKey) {
        return res.status(503).json({ message: "AI Driiva is not configured" });
      }

      let result: { headline: string; tips: string[]; encouragement: string };

      if (provider === 'anthropic') {
        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 400,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });
        if (!anthropicRes.ok) {
          const err = await anthropicRes.text();
          throw new Error(`Anthropic API error: ${anthropicRes.status} — ${err}`);
        }
        const anthropicData = await anthropicRes.json();
        const text = anthropicData.content?.[0]?.text ?? '{}';
        try {
          result = JSON.parse(text);
        } catch {
          throw new Error("AI provider returned non-JSON response");
        }
      } else {
        const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "sonar-pro",
            stream: false,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            return_images: false,
            return_related_questions: false,
          }),
        });
        if (!perplexityRes.ok) {
          const err = await perplexityRes.text();
          throw new Error(`Perplexity API error: ${perplexityRes.status} — ${err}`);
        }
        const perplexityData = await perplexityRes.json();
        const raw = perplexityData.choices?.[0]?.message?.content ?? '{}';
        try {
          result = JSON.parse(raw);
        } catch {
          throw new Error("AI provider returned non-JSON response");
        }
      }

      if (!result.headline || !Array.isArray(result.tips) || !result.encouragement) {
        throw new Error("Invalid response shape from AI provider");
      }

      res.json(result);
    } catch (error: any) {
      console.error("[AI Driiva] Error:", error);
      res.status(500).json({ message: "AI Coach error" });
    }
  });

  // -------------------------------------------------------------------------
  // General AI ask endpoint
  // -------------------------------------------------------------------------

  app.post("/api/ask", requireAuth, async (req, res) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: "sonar-pro",
          stream: false,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          return_images: false,
          return_related_questions: false
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Perplexity API error:", response.status, errorData);
        throw new Error(`Perplexity API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      
      res.json({
        answer: data.choices[0].message.content,
        citations: data.citations || []
      });
    } catch (error: any) {
      console.error("AI backend error:", error);
      res.status(500).json({ message: "AI backend error" });
    }
  });

  // -------------------------------------------------------------------------
  // STRIPE PAYMENT ROUTES
  // -------------------------------------------------------------------------

  /**
   * Create (or retrieve) a Stripe Customer + Subscription.
   * Uses inline price_data so each user pays their individually-computed premium.
   *
   * Body:
   *   annualPremiumCents  — annual premium in pence (from client pricingEngine × 100)
   *   billingPeriod       — 'monthly' | 'annual'
   *   quoteId?            — Root Platform quoteId stored in subscription metadata
   *
   * If annualPremiumCents is missing, falls back to STRIPE_MONTHLY_PRICE_ID for
   * backwards compatibility with older clients.
   */
  app.post("/api/payments/create-subscription", requireAuth, async (req: AuthRequest, res) => {
    try {
      const stripe = getStripe();
      const uid = req.auth!.uid;
      const user = await storage.getUserByFirebaseUid(uid);
      if (!user) return res.status(404).json({ message: "User not found" });

      const quoteId: string | undefined = req.body.quoteId;
      const billingPeriod: 'monthly' | 'annual' = req.body.billingPeriod === 'annual' ? 'annual' : 'monthly';
      const annualPremiumCents: number | undefined = req.body.annualPremiumCents
        ? Number(req.body.annualPremiumCents)
        : undefined;

      // Validate annualPremiumCents when provided
      if (annualPremiumCents !== undefined) {
        if (!Number.isFinite(annualPremiumCents) || annualPremiumCents < 10000 || annualPremiumCents > 500000) {
          return res.status(400).json({ message: "annualPremiumCents must be between 10000 and 500000" });
        }
      }

      // Upsert Stripe customer
      let customerId = user.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          metadata: { firebaseUid: uid, driivUserId: String(user.id) },
        }, { idempotencyKey: stripeIdempotencyKey(uid, 'customer-create') });
        customerId = customer.id;
        await storage.updateStripeCustomerId(user.id, customerId);
      }

      // Build subscription metadata
      const subscriptionMeta: Record<string, string> = { firebaseUid: uid, billingPeriod };
      if (quoteId) subscriptionMeta.quoteId = quoteId;

      // Build subscription item: use price_data if we have a computed premium,
      // otherwise fall back to the pre-created monthly Price ID.
      let subscriptionItem: any;
      const productId = process.env.STRIPE_PRODUCT_ID;

      if (annualPremiumCents !== undefined && productId) {
        const unitAmount = billingPeriod === 'annual'
          ? annualPremiumCents
          : Math.round(annualPremiumCents / 12 * 1.07);

        subscriptionItem = {
          price_data: {
            currency: 'gbp',
            product: productId,
            recurring: { interval: billingPeriod === 'annual' ? 'year' : 'month' },
            unit_amount: unitAmount,
          },
        };
        subscriptionMeta.annualPremiumCents = String(annualPremiumCents);
      } else {
        // Legacy fallback: use the pre-created monthly Price ID. If the client
        // supplies a priceId it MUST be in the server allow-list — otherwise a user
        // could substitute a cheaper Stripe Price than the one we intend to charge.
        const requestedPriceId: string | undefined = req.body.priceId;
        if (requestedPriceId && !allowedStripePriceIds().has(requestedPriceId)) {
          return res.status(400).json({ message: "Invalid priceId" });
        }
        const priceId = requestedPriceId || process.env.STRIPE_MONTHLY_PRICE_ID;
        if (!priceId) {
          return res.status(400).json({ message: "STRIPE_PRODUCT_ID or STRIPE_MONTHLY_PRICE_ID is required" });
        }
        subscriptionItem = { price: priceId };
      }

      const idempotencyKey = stripeIdempotencyKey(
        uid,
        `subscription-${billingPeriod}-${annualPremiumCents ?? 'fixed'}-${quoteId ?? 'none'}`,
      );

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [subscriptionItem],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: subscriptionMeta,
      }, { idempotencyKey });

      const invoice = subscription.latest_invoice as any;
      const paymentIntent = invoice?.payment_intent;

      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent?.client_secret ?? null,
        status: subscription.status,
      });
    } catch (error: any) {
      if (error.message?.includes('STRIPE_SECRET_KEY')) {
        return res.status(503).json({ message: "Stripe is not configured on this environment" });
      }
      console.error("[Stripe] create-subscription error:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  /**
   * Create a one-time Stripe Checkout Session (for add-ons / one-off payments).
   * Body: { priceId: string, successUrl?: string, cancelUrl?: string }
   */
  app.post("/api/payments/create-checkout", requireAuth, async (req: AuthRequest, res) => {
    try {
      const stripe = getStripe();
      const uid = req.auth!.uid;
      const { priceId, successUrl, cancelUrl } = req.body;
      if (!priceId) return res.status(400).json({ message: "priceId is required" });
      // Allow-list the priceId server-side: a client must not be able to check out
      // against an arbitrary (cheaper) Stripe Price. Configure one-off add-on Prices
      // via STRIPE_ALLOWED_PRICE_IDS.
      if (!allowedStripePriceIds().has(priceId)) {
        return res.status(400).json({ message: "Invalid priceId" });
      }

      const user = await storage.getUserByFirebaseUid(uid);
      if (!user) return res.status(404).json({ message: "User not found" });

      let customerId = user.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { firebaseUid: uid },
        });
        customerId = customer.id;
        await storage.updateStripeCustomerId(user.id, customerId);
      }

      const origin = req.headers.origin || process.env.WEBAUTHN_ORIGIN || 'http://localhost:5000';
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl || `${origin}/dashboard?checkout=success`,
        cancel_url: cancelUrl || `${origin}/checkout?checkout=cancelled`,
        metadata: { firebaseUid: uid },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      if (error.message?.includes('STRIPE_SECRET_KEY')) {
        return res.status(503).json({ message: "Stripe is not configured on this environment" });
      }
      console.error("[Stripe] create-checkout error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  /**
   * Return a Stripe Customer Portal link so users can manage their subscription.
   */
  app.get("/api/payments/billing-portal", requireAuth, async (req: AuthRequest, res) => {
    try {
      const stripe = getStripe();
      const uid = req.auth!.uid;
      const user = await storage.getUserByFirebaseUid(uid);
      if (!user?.stripeCustomerId) {
        return res.status(404).json({ message: "No billing account found" });
      }

      const origin = req.headers.origin || process.env.WEBAUTHN_ORIGIN || 'http://localhost:5000';
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${origin}/settings`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      if (error.message?.includes('STRIPE_SECRET_KEY')) {
        return res.status(503).json({ message: "Stripe is not configured on this environment" });
      }
      console.error("[Stripe] billing-portal error:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  /**
   * Stripe webhook endpoint.
   * Raw body is required for signature verification (app.ts registers express.raw for this path).
   * Events handled:
   *   invoice.payment_succeeded      → write a Firestore pendingPayment so the app /
   *                                    Root binds cover (the money-in / cover path).
   *   invoice.payment_failed         → resolve the user, persist a past_due flag on
   *                                    the bound policy (reuses policies.status -
   *                                    no new column) + structured warn.
   *   customer.subscription.deleted  → resolve the user, transition the bound policy
   *                                    to cancelled (reuses policies.status). Direct
   *                                    transition is a stopgap: route through the
   *                                    Task 3/4 policy lifecycle state machine once
   *                                    it lands on this branch.
   *   checkout.session.completed     → session → entitlement lookup → grant. No
   *                                    product/entitlement catalog exists yet, so
   *                                    this path is wired but grants nothing - an
   *                                    explicit structured no-op log, not a silent
   *                                    skip.
   *
   * Idempotency + audit: every event with an `id` gets a `stripe_events` row
   * (status received) written before processing, same side of the ACK boundary as
   * the switch below - see the comment ahead of the try block for why. A duplicate
   * delivery of an event already marked `processed` short-circuits: ack 200 without
   * re-running the switch. A duplicate of an event still `received` or `failed` is
   * NOT skipped - it re-enters the switch so Stripe's redelivery-on-non-2xx keeps
   * working for events whose side effects never actually completed.
   */
  app.post("/api/webhooks/stripe", webhookLimiter, async (req, res) => {
    let event: any;
    try {
      const stripe = getStripe();
      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = getStripeWebhookSecret();
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Stripe webhook] Signature verification failed:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    // Idempotency + audit: check/record the event BEFORE processing, still before the
    // ACK. A lookup/write failure here is not fatal to the request (no event.id is a
    // legitimate case for malformed/test payloads) - it degrades to "process without
    // a dedupe guarantee" rather than blocking the critical side effects below.
    if (event.id) {
      try {
        const existing = await storage.getStripeEventById(event.id);
        if (existing?.status === 'processed') {
          console.log(`[Stripe webhook] Duplicate event ${event.id} already processed - skipping`);
          return res.json({ received: true });
        }
        if (!existing) {
          await storage.createStripeEvent({ id: event.id, type: event.type, payload: event });
        }
      } catch (auditErr) {
        console.warn('[Stripe webhook] stripe_events lookup/write failed - proceeding without dedupe:', auditErr);
      }
    }

    // Process BEFORE acknowledging. A payment that binds a policy is a critical
    // side effect: if it throws we must return a non-2xx so Stripe redelivers the
    // event. ACKing first (200) and processing async means a failed bind - Firestore
    // down, Admin not initialised, transient Root error - is dropped forever with no
    // retry, leaving a charged customer with no cover (money-in / no-cover).
    try {
      switch (event.type) {
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;
          const subscriptionId = invoice.subscription as string;
          console.log(`[Stripe webhook] Payment succeeded for customer ${customerId}`);

          // Retrieve subscription to get quoteId from metadata
          let quoteId: string | undefined;
          try {
            const stripe = getStripe();
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            quoteId = sub.metadata?.quoteId;
          } catch (subErr) {
            console.warn('[Stripe webhook] Could not retrieve subscription metadata:', subErr);
          }

          await handleStripePaymentSucceeded(customerId, subscriptionId, quoteId, event.id, invoice.amount_paid);
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;
          // Resolve the user for an actionable log. Guard the lookup: this branch has
          // no critical side effect, so a transient DB failure must not bubble up and
          // trigger a 500 + Stripe retry storm for a logging-only event.
          let driivUserId: number | undefined;
          let firebaseUid: string | undefined;
          try {
            const user = await storage.getUserByStripeCustomerId(customerId);
            driivUserId = user?.id;
            firebaseUid = user?.firebaseUid ?? undefined;
          } catch (lookupErr) {
            console.warn('[Stripe webhook] payment_failed user lookup failed:', lookupErr);
          }
          console.warn(`[Stripe webhook] Payment FAILED for customer ${customerId}`, {
            invoiceId: invoice.id,
            subscriptionId: invoice.subscription,
            attemptCount: invoice.attempt_count,
            driivUserId,
            firebaseUid,
          });
          // Persist past_due against the bound policy via the M4 Task 3 policy
          // lifecycle state machine (server/lib/policyLifecycle.ts), not a raw
          // status write - so the transition is validated and audited like every
          // other status change. This IS a critical side effect: if the write
          // fails we rethrow so the outer catch 500s and Stripe redelivers,
          // rather than silently dropping a past_due transition.
          const failedSubscriptionId = invoice.subscription as string | undefined;
          if (failedSubscriptionId) {
            try {
              const policy = await storage.getPolicyByStripeSubscriptionId(failedSubscriptionId);
              if (policy) {
                try {
                  await transitionPolicy({ policy, toStatus: 'past_due', causedBy: `stripe:${event.id}` });
                  console.log(`[Stripe webhook] Policy ${policy.id} marked past_due`);
                } catch (transitionErr) {
                  // A policy that's cancelled or lapsed has no valid transition to
                  // past_due (cancelled is terminal; lapsed only goes to
                  // active/cancelled) - a redelivered or late payment_failed event
                  // against such a policy is a benign no-op, not a webhook failure.
                  // Any other rejection is a real problem and must still fail the
                  // webhook.
                  if (transitionErr instanceof InvalidPolicyTransitionError) {
                    console.log(`[Stripe webhook] Policy ${policy.id} cannot move to past_due from ${transitionErr.from} - skipping`, {
                      attempted: `${transitionErr.from} -> ${transitionErr.to}`,
                    });
                  } else {
                    throw transitionErr;
                  }
                }
              } else {
                console.warn(`[Stripe webhook] No policy bound to subscription ${failedSubscriptionId} - cannot persist past_due`);
              }
            } catch (policyErr) {
              console.error('[Stripe webhook] Failed to persist past_due flag:', policyErr);
              throw policyErr;
            }
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const customerId = sub.customer as string;
          let driivUserId: number | undefined;
          let firebaseUid: string | undefined;
          try {
            const user = await storage.getUserByStripeCustomerId(customerId);
            driivUserId = user?.id;
            firebaseUid = user?.firebaseUid ?? undefined;
          } catch (lookupErr) {
            console.warn('[Stripe webhook] subscription.deleted user lookup failed:', lookupErr);
          }
          console.warn(`[Stripe webhook] Subscription deleted: ${sub.id}`, {
            customerId,
            driivUserId,
            firebaseUid,
          });
          // Transition the bound policy to cancelled via the M4 Task 3 policy
          // lifecycle state machine (server/lib/policyLifecycle.ts).
          try {
            const policy = await storage.getPolicyByStripeSubscriptionId(sub.id as string);
            if (policy) {
              try {
                await transitionPolicy({ policy, toStatus: 'cancelled', causedBy: `stripe:${event.id}` });
                console.log(`[Stripe webhook] Policy ${policy.id} cancelled`);
              } catch (transitionErr) {
                // Stripe can and does redeliver subscription.deleted (retries,
                // duplicate webhook endpoints, etc). A policy that's already
                // cancelled has no valid outgoing transition (cancelled is
                // terminal), so a redelivery lands here as a rejected
                // transition - treat that specific case as a benign no-op, not
                // a webhook failure. Any other rejection (or non-transition
                // error) is a real problem and must still fail the webhook.
                if (
                  transitionErr instanceof InvalidPolicyTransitionError &&
                  transitionErr.from === 'cancelled'
                ) {
                  console.log(`[Stripe webhook] Policy ${policy.id} already cancelled - skipping redundant transition`);
                } else {
                  throw transitionErr;
                }
              }
            } else {
              console.warn(`[Stripe webhook] No policy bound to subscription ${sub.id} - cannot cancel`);
            }
          } catch (policyErr) {
            console.error('[Stripe webhook] Failed to cancel policy:', policyErr);
            throw policyErr;
          }
          break;
        }
        case 'checkout.session.completed': {
          const session = event.data.object;
          console.log(`[Stripe webhook] Checkout completed: ${session.id}`, {
            customerId: session.customer ?? undefined,
            firebaseUid: session.metadata?.firebaseUid,
            mode: session.mode,
            amountTotal: session.amount_total,
          });
          // Session → entitlement lookup → grant. No product/entitlement catalog
          // exists anywhere in this codebase yet (grepped shared/schema.ts,
          // server/storage.ts, client/src for "entitlement"/"addon"/"add-on" - zero
          // hits), so this path is real and wired but currently grants nothing.
          // Explicit structured no-op, not a silent skip, so ops can see fulfilment
          // was considered and deliberately deferred.
          console.log('[Stripe webhook] checkout.session.completed: no entitlement catalog defined yet - granting nothing', {
            sessionId: session.id,
            customerId: session.customer ?? undefined,
          });
          break;
        }
        default:
          // Unhandled event type - ignore silently
      }
      // All handled (or intentionally ignored) without throwing → acknowledge.
      // Mark the audit row processed. A failure to mark it is not re-thrown: the
      // critical side effects above already succeeded, and rethrowing here would
      // turn an audit-only write failure into a spurious Stripe retry that reruns
      // side effects that already landed. The row simply stays "received" and a
      // genuine retry will re-attempt (safe: reprocessing is idempotent per handler).
      if (event.id) {
        try {
          await storage.markStripeEventProcessed(event.id);
        } catch (markErr) {
          console.warn('[Stripe webhook] Could not mark stripe_events processed:', markErr);
        }
      }
      res.json({ received: true });
    } catch (err) {
      // Do NOT swallow: a 5xx tells Stripe to redeliver so the side effect retries.
      console.error("[Stripe webhook] Handler error, returning 500 for Stripe retry:", err);
      if (event?.id) {
        try {
          await storage.markStripeEventFailed(event.id);
        } catch (markErr) {
          console.warn('[Stripe webhook] Could not mark stripe_events failed:', markErr);
        }
      }
      res.status(500).json({ message: "Webhook handler failed; will be retried" });
    }
  });

  // -------------------------------------------------------------------------
  // ROOT PLATFORM WEBHOOK
  // Root pushes async policy status updates here.
  // -------------------------------------------------------------------------
  app.post("/api/webhooks/root", webhookLimiter, async (req, res) => {
    // Root signs webhooks with HMAC-SHA256; verify if ROOT_WEBHOOK_SECRET is set.
    const rootSecret = process.env.ROOT_WEBHOOK_SECRET;
    if (rootSecret) {
      const crypto = await import('crypto');
      const sig = req.headers['x-root-signature'] as string | undefined;
      if (!sig) return res.status(400).json({ message: "Missing Root webhook signature" });
      const expected = crypto.default
        .createHmac('sha256', rootSecret)
        .update(req.body as Buffer)
        .digest('hex');
      if (!sig || !crypto.default.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(400).json({ message: "Invalid Root webhook signature" });
    }

    res.json({ received: true });

    try {
      const body = JSON.parse((req.body as Buffer).toString('utf8'));
      const eventType: string = body.event_type || body.type || '';
      const policyId: string = body.policy_id || body.data?.policy_id || '';
      console.log(`[Root webhook] Event: ${eventType}, policy: ${policyId}`);

      // Additional Root webhook handling would be wired here when Root sandbox creds
      // are available to confirm the exact payload shape.
    } catch (err) {
      console.error("[Root webhook] Handler error:", err);
    }
  });

}

// ---------------------------------------------------------------------------
// Stripe → Root integration glue (called from webhook handler above)
// ---------------------------------------------------------------------------

async function handleStripePaymentSucceeded(
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  quoteId?: string,
  stripeEventId?: string,
  amountPaidCents?: number,
): Promise<void> {
  const user = await storage.getUserByStripeCustomerId(stripeCustomerId);
  if (!user) {
    console.warn(`[Integration] No user found for Stripe customer ${stripeCustomerId}`);
    return;
  }

  // Policy lifecycle (M4 Task 3): create or transition the Postgres policy row
  // through the state machine. This is the real policy-bind step - it replaces
  // the client-only flag flip that checkout.tsx used to do on payment success,
  // and it's a critical side effect (rethrow on failure so Stripe redelivers),
  // unlike the Firestore pendingPayment write below which stays best-effort.
  const causedBy = stripeEventId ? `stripe:${stripeEventId}` : `stripe:sub:${stripeSubscriptionId}`;
  let boundPolicyId: string | number | undefined;
  try {
    const existingPolicy = await storage.getPolicyByStripeSubscriptionId(stripeSubscriptionId);
    if (existingPolicy) {
      boundPolicyId = existingPolicy.id;
      try {
        await transitionPolicy({ policy: existingPolicy, toStatus: 'active', causedBy });
        console.log(`[Integration] Policy ${existingPolicy.id} transitioned to active`);
      } catch (transitionErr) {
        // Payment succeeded on an already-active policy (e.g. a redelivered
        // event, or a renewal invoice on a still-active policy) has no valid
        // active -> active transition - benign no-op, not a failure. Only that
        // exact case is swallowed: anything else (e.g. cancelled -> active, a
        // payment landing on a cancelled policy) is a genuine reconciliation
        // signal and must rethrow so the webhook still errors and gets
        // investigated, not silently swallowed.
        if (
          transitionErr instanceof InvalidPolicyTransitionError &&
          transitionErr.from === 'active' &&
          transitionErr.to === 'active'
        ) {
          console.log(`[Integration] Policy ${existingPolicy.id} already ${existingPolicy.status} - no transition needed`, {
            attempted: `${transitionErr.from} -> ${transitionErr.to}`,
          });
        } else {
          throw transitionErr;
        }
      }
    } else {
      const now = new Date();
      const expiration = new Date(now);
      expiration.setFullYear(expiration.getFullYear() + 1);
      const { policy } = await createPolicyWithAudit({
        policy: {
          userId: user.id,
          policyNumber: `POL-${stripeSubscriptionId}`,
          status: 'active',
          coverageType: 'standard',
          basePremiumCents: 0,
          currentPremiumCents: 0,
          effectiveDate: now,
          expirationDate: expiration,
          stripeSubscriptionId,
        },
        causedBy,
      });
      boundPolicyId = policy.id;
      console.log(`[Integration] Policy ${policy.id} created (active) for ${user.id}`);
    }
  } catch (policyErr) {
    console.error('[Integration] Failed to create/transition policy:', policyErr);
    throw policyErr;
  }

  // Pool-contribution seam (M4 Task 4): emit exactly once per successful
  // payment, after the policy bind/transition above has succeeded (including
  // the benign already-active no-op - money was still received). M3 doesn't
  // exist yet, so this only logs today - see server/lib/poolContribution.ts.
  if (boundPolicyId) {
    emitPoolContribution({
      userId: user.id,
      policyId: boundPolicyId,
      amountCents: amountPaidCents ?? 0,
      source: 'stripe_payment_succeeded',
      timestamp: new Date(),
    });
  }

  if (!user.firebaseUid) {
    console.warn(`[Integration] User ${user.id} has no firebaseUid - skipping Firestore pendingPayment write`);
    return;
  }

  try {
    console.log(`[Integration] Payment succeeded for ${user.firebaseUid} - writing pendingPayment`, { quoteId });

    const adminLib = await import('./lib/firebase-admin');
    const adminApp = adminLib.getFirebaseAdmin();
    if (!adminApp) {
      console.warn('[Integration] Firebase Admin not initialised — cannot write pendingPayment');
      return;
    }

    const { firestore: fsAdmin } = await import('firebase-admin');
    const doc: Record<string, unknown> = {
      stripeSubscriptionId,
      stripeCustomerId,
      status: 'pending',
      createdAt: fsAdmin.FieldValue.serverTimestamp(),
    };
    if (quoteId) doc.quoteId = quoteId;

    await adminApp.firestore()
      .collection('users')
      .doc(user.firebaseUid)
      .collection('pendingPayments')
      .doc(stripeSubscriptionId)
      .set(doc);

    console.log(`[Integration] pendingPayment written for ${user.firebaseUid}`);
  } catch (err) {
    console.error("[Integration] handleStripePaymentSucceeded error:", err);
  }
}
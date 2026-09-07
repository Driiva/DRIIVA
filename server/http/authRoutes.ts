/**
 * Identity routes: profile, auth check, Firebase token exchange and WebAuthn
 * (Face ID / Touch ID). Extracted verbatim from server/routes.ts; paths,
 * middleware order and response shapes are unchanged.
 *
 * PUBLIC (no auth): POST /api/auth/firebase, POST /api/auth/webauthn/check,
 *   POST /api/auth/webauthn/authenticate/{start,complete}.
 * PROTECTED (requireAuth): /api/profile/me, /api/auth/check,
 *   POST /api/auth/webauthn/register/{start,complete},
 *   GET|DELETE /api/auth/webauthn/credentials.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { webauthnService } from "../webauthn";
import { authLimiter } from "../middleware/security";
import { requireAuth, type AuthRequest } from "../middleware/auth";

export function registerAuthRoutes(app: Express): void {

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
      const { verifyFirebaseToken } = await import("../lib/firebase-admin");
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
        credentials: credentials.map((cred) => ({
          id: cred.credentialId,
          deviceType: cred.deviceType,
          deviceName: cred.deviceName,
          createdAt: cred.createdAt,
          lastUsed: cred.lastUsed,
        })),
      });
    } catch (error) {
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
    } catch (error) {
      console.error("Delete credential error:", error);
      res.status(500).json({ message: "Failed to delete credential" });
    }
  });


}

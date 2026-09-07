/**
 * GDPR routes: a driver can export everything held about them, or delete it.
 *
 * Both are own-data only. Deletion is strictly rate limited because it is
 * irreversible and the obvious target for an abusive automated call.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { gdprDeleteLimiter } from "../middleware/rateLimiter";
import { requireAuth, requireResourceOwner, type AuthRequest } from "../middleware/auth";

export function registerGdprRoutes(app: Express): void {
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
}

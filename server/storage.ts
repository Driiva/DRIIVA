import {
  users,
  drivingProfiles,
  trips,
  communityPool,
  achievements,
  userAchievements,
  incidents,
  leaderboard,
  policies,
  policyAuditLog,
  stripeEvents,
  type User,
  type InsertUser,
  type DrivingProfile,
  type InsertDrivingProfile,
  type Trip,
  type InsertTrip,
  type CommunityPool,
  type Achievement,
  type InsertAchievement,
  type UserAchievement,
  type InsertUserAchievement,
  type Incident,
  type InsertIncident,
  type Leaderboard,
  type Policy,
  type InsertPolicy,
  type PolicyAuditLog,
  type StripeEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gte, lte, sql } from "drizzle-orm";

import type { ExportedUserData, IStorage } from "./storageContract";

// The port this class implements lives in ./storageContract; re-exported here
// because callers have always imported IStorage from this module.
export type { ExportedUserData, IStorage } from "./storageContract";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getOrCreateUserByFirebase(firebaseUid: string, email: string, displayName?: string | null): Promise<User> {
    // 1. Try by Firebase UID first (fastest path for returning users)
    const existing = await this.getUserByFirebaseUid(firebaseUid);
    if (existing) return existing;

    // 2. Try by email — the same person may have a row without the UID set yet
    const [byEmail] = await db.select().from(users).where(eq(users.email, email));
    if (byEmail) {
      // Backfill the Firebase UID so future lookups use the fast path
      const [updated] = await db.update(users)
        .set({ firebaseUid, updatedBy: "firebase-auth" })
        .where(eq(users.id, byEmail.id))
        .returning();
      return updated ?? byEmail;
    }

    // 3. Brand-new user — insert
    const [user] = await db.insert(users).values({
      firebaseUid,
      email,
      displayName: displayName ?? null,
      onboardingComplete: false,
      createdBy: "firebase-auth",
      updatedBy: "firebase-auth",
    }).returning();
    if (!user) throw new Error("Failed to create user from Firebase");
    await this.createDrivingProfile({ userId: user.id });
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    
    // Create initial driving profile
    await this.createDrivingProfile({ userId: user.id });
    
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getDrivingProfile(userId: number): Promise<DrivingProfile | undefined> {
    const [profile] = await db.select().from(drivingProfiles).where(eq(drivingProfiles.userId, userId));
    return profile || undefined;
  }

  async createDrivingProfile(profile: InsertDrivingProfile): Promise<DrivingProfile> {
    // Use upsert so duplicate calls (e.g. race conditions on user creation)
    // don't throw a unique constraint error — return the existing row instead.
    const [newProfile] = await db.insert(drivingProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: drivingProfiles.userId,
        set: { lastUpdated: new Date() }, // no-op update; just return existing row
      })
      .returning();
    return newProfile;
  }

  async updateDrivingProfile(userId: number, updates: Partial<InsertDrivingProfile>): Promise<DrivingProfile> {
    const [profile] = await db.update(drivingProfiles)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(drivingProfiles.userId, userId))
      .returning();
    return profile;
  }

  async createTrip(trip: InsertTrip): Promise<Trip> {
    const [newTrip] = await db.insert(trips).values(trip).returning();
    return newTrip;
  }

  /**
   * Persist a trip and its derived aggregates atomically. The trip insert, the
   * driving-profile update and the leaderboard upsert either all commit or all
   * roll back together. A partial write here would corrupt the running aggregates
   * (currentScore is recomputed from totalTrips on the next trip, so a trip row
   * without its matching profile increment permanently skews the average).
   */
  async recordTripAtomic(params: {
    trip: InsertTrip;
    profileUpdate?: Partial<InsertDrivingProfile>;
    leaderboardScore?: number;
    leaderboardPeriod?: string;
  }): Promise<{ trip: Trip; profile?: DrivingProfile }> {
    return await db.transaction(async (tx) => {
      const [newTrip] = await tx.insert(trips).values(params.trip).returning();

      let profile: DrivingProfile | undefined;
      if (params.profileUpdate) {
        [profile] = await tx.update(drivingProfiles)
          .set({ ...params.profileUpdate, lastUpdated: new Date() })
          .where(eq(drivingProfiles.userId, params.trip.userId))
          .returning();
      }

      if (params.leaderboardScore !== undefined) {
        const period = params.leaderboardPeriod ?? 'weekly';
        await tx.insert(leaderboard)
          .values({ userId: params.trip.userId, score: params.leaderboardScore, period, rank: 1 })
          .onConflictDoUpdate({
            target: [leaderboard.userId, leaderboard.period],
            set: { score: params.leaderboardScore, lastUpdated: new Date() }
          });
      }

      return { trip: newTrip, profile };
    });
  }

  async getUserTrips(userId: number, limit: number = 10, offset: number = 0): Promise<Trip[]> {
    const query = db.select().from(trips)
      .where(eq(trips.userId, userId))
      .orderBy(desc(trips.startTime)) // Use startTime for time-series optimization
      .limit(limit)
      .offset(offset);
    
    return await query;
  }

  /**
   * Optimized query for time-series data by date range
   * Uses index on startTime for better performance
   */
  async getTripsByDateRange(
    userId: number,
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<Trip[]> {
    return await db.select().from(trips)
      .where(
        and(
          eq(trips.userId, userId),
          gte(trips.startTime, startDate),
          lte(trips.endTime, endDate)
        )
      )
      .orderBy(desc(trips.startTime))
      .limit(limit);
  }

  /**
   * Check for duplicate trips - optimized for time-series duplicate detection
   */
  async getTripsForDuplicateCheck(
    userId: number,
    startTime: Date,
    endTime: Date,
    distance: number
  ): Promise<Trip[]> {
    // Check for trips within 5 minutes and similar distance
    const timeWindow = 5 * 60 * 1000; // 5 minutes in ms
    const distanceTolerance = 0.5; // 500m tolerance
    
    const checkStart = new Date(startTime.getTime() - timeWindow);
    const checkEnd = new Date(endTime.getTime() + timeWindow);
    
    return await db.select().from(trips)
      .where(
        and(
          eq(trips.userId, userId),
          gte(trips.startTime, checkStart),
          lte(trips.endTime, checkEnd),
          // Distance check using SQL
          sql`ABS(${trips.distance}::numeric - ${distance}) < ${distanceTolerance}`
        )
      )
      .limit(10);
  }

  async getTripById(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip || undefined;
  }

  async getTrips(userId: number, limit: number = 10, offset: number = 0): Promise<Trip[]> {
    return this.getUserTrips(userId, limit, offset);
  }

  async getCommunityPool(id?: number): Promise<CommunityPool | undefined> {
    if (id) {
      const [pool] = await db.select().from(communityPool).where(eq(communityPool.id, id));
      return pool || undefined;
    }
    const [pool] = await db.select().from(communityPool).orderBy(desc(communityPool.lastUpdated)).limit(1);
    return pool || undefined;
  }

  async updateCommunityPool(updates: Partial<CommunityPool>): Promise<CommunityPool> {
    // community_pool is a singleton; always target the existing row by id to
    // avoid updating ALL rows when no WHERE clause is supplied.
    const existing = await this.getCommunityPool();
    if (!existing) {
      throw new Error('Community pool record not found; seed it first');
    }
    const [pool] = await db.update(communityPool)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(communityPool.id, existing.id))
      .returning();
    return pool;
  }

  async getAchievements(): Promise<Achievement[]> {
    return await db.select().from(achievements).where(eq(achievements.isActive, true));
  }

  async getUserAchievements(userId: number): Promise<UserAchievement[]> {
    return await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
  }

  async unlockAchievement(userId: number, achievementId: number): Promise<UserAchievement> {
    const [achievement] = await db.insert(userAchievements)
      .values({ userId, achievementId })
      .returning();
    return achievement;
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [newIncident] = await db.insert(incidents).values(incident).returning();
    return newIncident;
  }

  async getUserIncidents(userId: number): Promise<Incident[]> {
    return await db.select().from(incidents)
      .where(eq(incidents.userId, userId))
      .orderBy(desc(incidents.reportedAt));
  }

  async updateIncident(id: number, updates: Partial<InsertIncident>): Promise<Incident> {
    const [incident] = await db.update(incidents).set(updates).where(eq(incidents.id, id)).returning();
    return incident;
  }

  async getLeaderboard(period: string = 'weekly', limit: number = 50): Promise<Leaderboard[]> {
    return await db.select().from(leaderboard)
      .where(eq(leaderboard.period, period))
      .orderBy(asc(leaderboard.rank))
      .limit(limit);
  }

  async updateLeaderboard(userId: number, score: number, period: string = 'weekly'): Promise<Leaderboard> {
    const [entry] = await db.insert(leaderboard)
      .values({ userId, score, period, rank: 1 })
      .onConflictDoUpdate({
        target: [leaderboard.userId, leaderboard.period],
        set: { score, lastUpdated: new Date() }
      })
      .returning();
    return entry;
  }

  async exportUserData(userId: number): Promise<ExportedUserData> {
    const user = await this.getUser(userId);
    const profile = await this.getDrivingProfile(userId);
    const userTrips = await this.getUserTrips(userId, 1000);
    const userAchievements = await this.getUserAchievements(userId);
    const userIncidents = await this.getUserIncidents(userId);

    return {
      user,
      drivingProfile: profile,
      trips: userTrips,
      achievements: userAchievements,
      incidents: userIncidents,
      exportedAt: new Date().toISOString()
    };
  }

  async deleteUserData(userId: number): Promise<void> {
    await db.delete(userAchievements).where(eq(userAchievements.userId, userId));
    await db.delete(incidents).where(eq(incidents.userId, userId));
    await db.delete(leaderboard).where(eq(leaderboard.userId, userId));
    await db.delete(trips).where(eq(trips.userId, userId));
    await db.delete(drivingProfiles).where(eq(drivingProfiles.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }

  async updateStripeCustomerId(userId: number, stripeCustomerId: string): Promise<void> {
    await db.update(users).set({ stripeCustomerId, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user || undefined;
  }

  // --- Stripe webhook idempotency + audit -----------------------------------

  async getStripeEventById(eventId: string): Promise<StripeEvent | undefined> {
    const [event] = await db.select().from(stripeEvents).where(eq(stripeEvents.id, eventId));
    return event || undefined;
  }

  // I3a fix: INSERT ... ON CONFLICT DO UPDATE ... RETURNING is a single atomic
  // statement, so two concurrent deliveries of the same event.id can no
  // longer both observe "no existing row" and both proceed as if they were
  // first (the old read-then-insert - getStripeEventById then a conditional
  // createStripeEvent - had exactly that TOCTOU gap). The `set` clause
  // rewrites `type` to its own value - a genuine no-op for a real duplicate
  // (type never changes for a given event.id) - purely so RETURNING gives
  // back the authoritative existing row on conflict instead of nothing,
  // letting the caller inspect its real status in the same round trip.
  async createStripeEvent(event: { id: string; type: string; payload: unknown }): Promise<StripeEvent> {
    const [row] = await db.insert(stripeEvents)
      .values({
        id: event.id,
        type: event.type,
        status: "received",
        payload: event.payload,
      })
      .onConflictDoUpdate({
        target: stripeEvents.id,
        set: { type: event.type },
      })
      .returning();
    return row;
  }

  async markStripeEventProcessed(eventId: string): Promise<void> {
    await db.update(stripeEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(stripeEvents.id, eventId));
  }

  async markStripeEventFailed(eventId: string): Promise<void> {
    await db.update(stripeEvents)
      .set({ status: "failed" })
      .where(eq(stripeEvents.id, eventId));
  }

  // --- Policy operations ------------------------------------------------------

  async getPolicy(id: number): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(eq(policies.id, id));
    return policy || undefined;
  }

  async getPolicyByStripeSubscriptionId(subscriptionId: string): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(eq(policies.stripeSubscriptionId, subscriptionId));
    return policy || undefined;
  }

  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const [row] = await db.insert(policies).values(policy).returning();
    return row;
  }

  async updatePolicy(id: number, updates: Partial<InsertPolicy>): Promise<Policy | undefined> {
    const [policy] = await db.update(policies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning();
    return policy || undefined;
  }

  // Optimistic-concurrency write: only applies `updates` if the row's current
  // status still matches `fromStatus` at write time. Returns undefined (zero
  // rows affected) if another writer already moved the policy off `fromStatus`
  // - callers (transitionPolicy) must treat that as a rejected transition, not
  // retry or fall back to an unconditional write.
  async updatePolicyIfStatus(id: number, fromStatus: string, updates: Partial<InsertPolicy>): Promise<Policy | undefined> {
    const [policy] = await db.update(policies)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(policies.id, id), eq(policies.status, fromStatus)))
      .returning();
    return policy || undefined;
  }

  // --- Policy lifecycle audit trail (M4 Task 3) -------------------------------

  async createPolicyAuditLog(entry: {
    policyId: number;
    fromStatus: string | null;
    toStatus: string;
    causedBy: string;
  }): Promise<PolicyAuditLog> {
    const [row] = await db.insert(policyAuditLog).values(entry).returning();
    return row;
  }

  async getPolicyAuditLog(policyId: number): Promise<PolicyAuditLog[]> {
    return db.select().from(policyAuditLog)
      .where(eq(policyAuditLog.policyId, policyId))
      .orderBy(asc(policyAuditLog.createdAt));
  }

  // I4 fix: the CAS status update and the audit insert used to be two
  // independent calls from policyLifecycle.ts's transitionPolicy
  // (updatePolicyIfStatus, then createPolicyAuditLog). If the audit insert
  // threw after the status write had already committed, the status change
  // was permanently un-audited with no rollback - and every call site's
  // InvalidPolicyTransitionError handling treats a retry as a benign
  // already-in-target-state no-op, so the gap would never resurface or get
  // retried. Wrapping both writes in one db.transaction (same pattern as
  // recordTripAtomic above) means an audit-insert failure rolls the status
  // write back too: a Stripe redelivery then sees the policy still in
  // fromStatus and genuinely retries the whole transition, rather than
  // silently losing an audit entry.
  async transitionPolicyWithAudit(params: {
    id: number;
    fromStatus: string;
    toStatus: string;
    causedBy: string;
  }): Promise<{ policy: Policy; audit: PolicyAuditLog } | undefined> {
    return await db.transaction(async (tx) => {
      const [policy] = await tx.update(policies)
        .set({ status: params.toStatus, updatedAt: new Date() })
        .where(and(eq(policies.id, params.id), eq(policies.status, params.fromStatus)))
        .returning();
      // CAS guard didn't match (another writer already moved the row off
      // fromStatus) - zero rows changed, nothing to roll back, no audit row.
      if (!policy) return undefined;

      const [audit] = await tx.insert(policyAuditLog).values({
        policyId: params.id,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        causedBy: params.causedBy,
      }).returning();

      return { policy, audit };
    });
  }
}

export const storage = new DatabaseStorage();

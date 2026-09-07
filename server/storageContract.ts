/**
 * The storage port: every read and write server code is allowed to make
 * against Postgres. Extracted verbatim from server/storage.ts, which
 * implements it and re-exports it, so callers importing IStorage from
 * ./storage are unaffected.
 */
import type {
  User,
  InsertUser,
  DrivingProfile,
  InsertDrivingProfile,
  Trip,
  InsertTrip,
  CommunityPool,
  Achievement,
  UserAchievement,
  Incident,
  InsertIncident,
  Leaderboard,
  Policy,
  InsertPolicy,
  PolicyAuditLog,
  StripeEvent,
} from "@shared/schema";

/**
 * Everything exportUserData hands back for a GDPR data-portability request.
 * Spelled out rather than left as `any`: this payload is served straight to a
 * driver as a download, so its shape is part of the contract.
 */
export interface ExportedUserData {
  user: User | undefined;
  drivingProfile: DrivingProfile | undefined;
  trips: Trip[];
  achievements: UserAchievement[];
  incidents: Incident[];
  exportedAt: string;
}

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  getOrCreateUserByFirebase(firebaseUid: string, email: string, displayName?: string | null): Promise<User>;

  // Driving profile operations
  getDrivingProfile(userId: number): Promise<DrivingProfile | undefined>;
  createDrivingProfile(profile: InsertDrivingProfile): Promise<DrivingProfile>;
  updateDrivingProfile(userId: number, updates: Partial<InsertDrivingProfile>): Promise<DrivingProfile>;
  
  // Trip operations
  createTrip(trip: InsertTrip): Promise<Trip>;
  recordTripAtomic(params: {
    trip: InsertTrip;
    profileUpdate?: Partial<InsertDrivingProfile>;
    leaderboardScore?: number;
    leaderboardPeriod?: string;
  }): Promise<{ trip: Trip; profile?: DrivingProfile }>;
  getUserTrips(userId: number, limit?: number, offset?: number): Promise<Trip[]>;
  getTrips(userId: number, limit?: number, offset?: number): Promise<Trip[]>;
  getTripById(id: number): Promise<Trip | undefined>;
  
  // Community pool operations
  getCommunityPool(id?: number): Promise<CommunityPool | undefined>;
  updateCommunityPool(updates: Partial<CommunityPool>): Promise<CommunityPool>;
  
  // Achievement operations
  getAchievements(): Promise<Achievement[]>;
  getUserAchievements(userId: number): Promise<UserAchievement[]>;
  unlockAchievement(userId: number, achievementId: number): Promise<UserAchievement>;
  
  // Incident operations
  createIncident(incident: InsertIncident): Promise<Incident>;
  getUserIncidents(userId: number): Promise<Incident[]>;
  updateIncident(id: number, updates: Partial<InsertIncident>): Promise<Incident>;
  
  // Leaderboard operations
  getLeaderboard(period?: string, limit?: number): Promise<Leaderboard[]>;
  updateLeaderboard(userId: number, score: number, period?: string): Promise<Leaderboard>;
  
  // Time-series optimized queries
  getTripsByDateRange(userId: number, startDate: Date, endDate: Date, limit?: number): Promise<Trip[]>;
  getTripsForDuplicateCheck(userId: number, startTime: Date, endTime: Date, distance: number): Promise<Trip[]>;
  
  // GDPR operations
  exportUserData(userId: number): Promise<ExportedUserData>;
  deleteUserData(userId: number): Promise<void>;

  // Stripe operations
  updateStripeCustomerId(userId: number, stripeCustomerId: string): Promise<void>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;

  // Stripe webhook idempotency + audit
  getStripeEventById(eventId: string): Promise<StripeEvent | undefined>;
  // Atomic dedupe primitive (M4 review fix I3a): the write itself - not a
  // preceding read - is what makes this safe under concurrent delivery of the
  // same event.id. Always returns the authoritative row (freshly inserted, or
  // the pre-existing row on conflict) in one round trip; never throws a raw
  // unique-violation for a duplicate id.
  createStripeEvent(event: { id: string; type: string; payload: unknown }): Promise<StripeEvent>;
  markStripeEventProcessed(eventId: string): Promise<void>;
  markStripeEventFailed(eventId: string): Promise<void>;

  // Policy operations
  getPolicy(id: number): Promise<Policy | undefined>;
  getPolicyByStripeSubscriptionId(subscriptionId: string): Promise<Policy | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  updatePolicy(id: number, updates: Partial<InsertPolicy>): Promise<Policy | undefined>;
  updatePolicyIfStatus(id: number, fromStatus: string, updates: Partial<InsertPolicy>): Promise<Policy | undefined>;

  // Policy lifecycle audit trail (M4 Task 3)
  createPolicyAuditLog(entry: {
    policyId: number;
    fromStatus: string | null;
    toStatus: string;
    causedBy: string;
  }): Promise<PolicyAuditLog>;
  getPolicyAuditLog(policyId: number): Promise<PolicyAuditLog[]>;

  // Atomic CAS status write + audit insert (M4 review fix I4): replaces the
  // old updatePolicyIfStatus-then-createPolicyAuditLog two-step so a failure
  // writing the audit row rolls the status write back too, instead of
  // silently leaving an un-audited status change. Returns undefined if the
  // CAS guard didn't match (same "rejected transition" contract as
  // updatePolicyIfStatus) - no audit row is written in that case.
  transitionPolicyWithAudit(params: {
    id: number;
    fromStatus: string;
    toStatus: string;
    causedBy: string;
  }): Promise<{ policy: Policy; audit: PolicyAuditLog } | undefined>;
}

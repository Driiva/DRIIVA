/**
 * The module-boundary mock rig the API contract characterisation suites share:
 * the env vi.hoisted block, every vi.mock, the app import that must come after
 * them, and the fixtures. Extracted from
 * server/__tests__/api-contract.characterisation.test.ts when that file was
 * split by describe block; the mocks are unchanged.
 *
 * Importing this module is what installs the mocks, so each suite imports it
 * before anything that reaches server/app.ts.
 */
import { vi } from "vitest";

vi.hoisted(() => {
  // Read at import time by middleware/auth
  process.env.ADMIN_FIREBASE_UIDS = "admin-uid";
  // Read at request time by routes
  process.env.ENCRYPTION_KEY = "test-encryption-key-32-bytes-ok!";
  process.env.STRIPE_MONTHLY_PRICE_ID = "price_allowed_monthly";
  process.env.STRIPE_ALLOWED_PRICE_IDS = "price_allowed_extra";
  process.env.STRIPE_PRODUCT_ID = "prod_test";
  delete process.env.ROOT_WEBHOOK_SECRET;
});

vi.mock("../../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getUserByFirebaseUid: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    getOrCreateUserByFirebase: vi.fn(),
    getDrivingProfile: vi.fn(),
    createDrivingProfile: vi.fn(),
    updateDrivingProfile: vi.fn(),
    createTrip: vi.fn(),
    recordTripAtomic: vi.fn(),
    getUserTrips: vi.fn(),
    getTrips: vi.fn(),
    getTripById: vi.fn(),
    getCommunityPool: vi.fn(),
    updateCommunityPool: vi.fn(),
    getAchievements: vi.fn(),
    getUserAchievements: vi.fn(),
    createIncident: vi.fn(),
    getUserIncidents: vi.fn(),
    updateIncident: vi.fn(),
    getLeaderboard: vi.fn(),
    updateLeaderboard: vi.fn(),
    getTripsByDateRange: vi.fn(),
    getTripsForDuplicateCheck: vi.fn(),
    exportUserData: vi.fn(),
    deleteUserData: vi.fn(),
    updateStripeCustomerId: vi.fn(),
    getUserByStripeCustomerId: vi.fn(),
    getStripeEventById: vi.fn(),
    createStripeEvent: vi.fn(),
    markStripeEventProcessed: vi.fn(),
    markStripeEventFailed: vi.fn(),
    getPolicy: vi.fn(),
    getPolicyByStripeSubscriptionId: vi.fn(),
    createPolicy: vi.fn(),
    updatePolicy: vi.fn(),
    updatePolicyIfStatus: vi.fn(),
    createPolicyAuditLog: vi.fn(),
    getPolicyAuditLog: vi.fn(),
    transitionPolicyWithAudit: vi.fn(),
  },
}));

vi.mock("../../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  getFirebaseAdmin: vi.fn(() => null),
}));

// Dynamically imported by the Stripe webhook handler for FieldValue only.
vi.mock("firebase-admin", () => ({
  firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } },
}));

vi.mock("../../lib/aiInsights", () => ({
  aiInsightsEngine: { generateInsights: vi.fn(() => ({ insights: [] })) },
}));

vi.mock("../../lib/scoreAggregation", () => ({
  scoreAggregation: {
    getWeeklyScore: vi.fn(),
    getMonthlyScore: vi.fn(),
    getTimeSeriesData: vi.fn(),
    getScoreTrend: vi.fn(),
  },
}));

vi.mock("../../webauthn", () => ({
  webauthnService: {
    hasCredentials: vi.fn(),
    generateRegistrationOptions: vi.fn(),
    verifyRegistration: vi.fn(),
    generateAuthenticationOptions: vi.fn(),
    verifyAuthentication: vi.fn(),
    getUserCredentials: vi.fn(),
    deleteCredential: vi.fn(),
  },
}));

const { stripeMock } = vi.hoisted(() => ({
  stripeMock: {
    customers: { create: vi.fn() },
    subscriptions: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  },
}));

vi.mock("../../lib/stripe", () => ({
  getStripe: () => stripeMock,
  getStripeWebhookSecret: () => "whsec_test",
  stripeIdempotencyKey: (...parts: unknown[]) => parts.join("-"),
}));

vi.mock("../../lib/crypto", () => ({
  crypto: { encrypt: vi.fn(() => "encrypted-blob") },
}));

// Rate limiters are pass-through in this file (contract characterised separately).
vi.mock("../../middleware/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware/security")>();
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    ...actual,
    apiLimiter: pass,
    authLimiter: pass,
    tripDataLimiter: pass,
    webhookLimiter: pass,
    coachLimiter: pass,
  };
});
vi.mock("../../middleware/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware/rateLimiter")>();
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...actual, gdprDeleteLimiter: pass, poolModificationLimiter: pass };
});

import { storage } from "../../storage";
import { verifyFirebaseToken, getFirebaseAdmin } from "../../lib/firebase-admin";

export const verify = vi.mocked(verifyFirebaseToken);
export const admin = vi.mocked(getFirebaseAdmin);

export const NEON_USER = {
  id: 7,
  firebaseUid: "fb-uid-1",
  email: "driver@driiva.co.uk",
  name: "Test Driver",
  onboardingComplete: true,
  premiumAmount: "840.00",
  stripeCustomerId: null as string | null,
};

/** Authenticate subsequent requests as the given Neon user (or token-only if row=null). */
export function asUser(row: typeof NEON_USER | null = NEON_USER, uid = "fb-uid-1") {
  verify.mockResolvedValue({ uid, email: row?.email ?? "driver@driiva.co.uk" });
  vi.mocked(storage.getUserByFirebaseUid).mockResolvedValue(row as never);
  return { Authorization: "Bearer test-token" };
}

/**
 * The Stripe double. Exported here rather than at its declaration because
 * vi.hoisted bindings cannot carry an export clause of their own.
 */
export { stripeMock };

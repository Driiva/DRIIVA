/**
 * The mock rig the policy-bind characterisation suites share: the storage
 * double, the Firebase Admin stub, the Stripe double, and the fixtures the
 * webhook payloads are built from. Extracted from
 * server/__tests__/policy-bind.test.ts when that file was split by describe
 * block; the mocks are unchanged.
 *
 * Importing this module installs the mocks, so each suite imports it before
 * anything that reaches server/app.ts.
 */
import { vi } from "vitest";

/** The slice of the Firestore Admin surface these tests drive. */
interface FirestoreStub {
  collection: (name: string) => unknown;
}

/** The slice of the Admin app the integration glue calls. */
export interface AdminAppStub {
  firestore: () => FirestoreStub;
}


vi.hoisted(() => {
  process.env.ADMIN_FIREBASE_UIDS = "admin-uid";
  process.env.ENCRYPTION_KEY = "test-encryption-key-32-bytes-ok!";
  process.env.STRIPE_MONTHLY_PRICE_ID = "price_allowed_monthly";
  process.env.STRIPE_ALLOWED_PRICE_IDS = "price_allowed_extra";
  process.env.STRIPE_PRODUCT_ID = "prod_test";
  delete process.env.ROOT_WEBHOOK_SECRET;
});

const storageMock = vi.hoisted(() => ({
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
}));

vi.mock("../../storage", () => ({ storage: storageMock }));

const { getFirebaseAdminMock } = vi.hoisted(() => ({
  getFirebaseAdminMock: vi.fn<() => AdminAppStub | null>(() => null),
}));
vi.mock("../../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  getFirebaseAdmin: getFirebaseAdminMock,
}));

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

vi.mock("../../lib/crypto", () => ({ crypto: { encrypt: vi.fn(() => "encrypted-blob") } }));

vi.mock("../../middleware/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware/security")>();
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...actual, apiLimiter: pass, authLimiter: pass, tripDataLimiter: pass, webhookLimiter: pass, coachLimiter: pass };
});
vi.mock("../../middleware/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware/rateLimiter")>();
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...actual, gdprDeleteLimiter: pass, poolModificationLimiter: pass };
});


export const rawBody = JSON.stringify({ probe: true });

export function receivedRow(id: string, type: string) {
  return { id, type, status: "received" as const, payload: {}, processedAt: null, createdAt: new Date() };
}

export function failedRow(id: string, type: string) {
  return { id, type, status: "failed" as const, payload: {}, processedAt: null, createdAt: new Date() };
}

/** Minimal chainable Firestore Admin mock: quotes/{id} and users/{uid}/pendingPayments/{subId}. */
export function makeAdminApp(opts: { quoteExists?: boolean; quoteData?: Record<string, unknown>; pendingPaymentSetImpl?: () => Promise<void> } = {}) {
  const { quoteExists = false, quoteData = {}, pendingPaymentSetImpl } = opts;
  const getQuoteMock = vi.fn().mockResolvedValue({ exists: quoteExists, data: () => quoteData });
  const setPendingPaymentMock = pendingPaymentSetImpl
    ? vi.fn(pendingPaymentSetImpl)
    : vi.fn().mockResolvedValue(undefined);

  const quotesChain = { doc: vi.fn(() => ({ get: getQuoteMock })) };
  const pendingPaymentsChain = { doc: vi.fn(() => ({ set: setPendingPaymentMock })) };
  const usersChain = { doc: vi.fn(() => ({ collection: vi.fn(() => pendingPaymentsChain) })) };

  const firestoreRoot = {
    collection: vi.fn((name: string) => (name === "quotes" ? quotesChain : usersChain)),
  };

  const adminApp: AdminAppStub = { firestore: () => firestoreRoot as unknown as FirestoreStub };
  return { app: adminApp, getQuoteMock, setPendingPaymentMock };
}

/**
 * The hoisted doubles, exported here rather than at their declarations because
 * a vi.hoisted binding cannot carry an export clause of its own.
 */
export { getFirebaseAdminMock, storageMock, stripeMock };

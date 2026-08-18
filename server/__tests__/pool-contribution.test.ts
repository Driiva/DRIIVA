/**
 * Pool-contribution seam (M4 Task 4).
 *
 * emitPoolContribution() is a log/no-op today - M3 (the pool ledger) doesn't
 * exist yet (blocked on D6, see m4-grounding.md section 4). This test proves
 * the seam is actually wired into the payment-success path added in Task 3
 * (handleStripePaymentSucceeded -> transitionPolicy/createPolicyWithAudit),
 * not just defined and unused: emitPoolContribution is called exactly once
 * per successful invoice.payment_succeeded webhook, with a correctly-shaped
 * payload, for both the "existing policy transitioned" and "brand new policy
 * created" cases. Harness mirrors stripe-webhook-idempotency.test.ts.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

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

vi.mock("../storage", () => ({ storage: storageMock }));

vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  getFirebaseAdmin: vi.fn(() => null),
}));

vi.mock("firebase-admin", () => ({
  firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } },
}));

vi.mock("../lib/telematics", () => ({
  telematicsProcessor: { processTrip: vi.fn(), calculateRefund: vi.fn(() => 42) },
}));
vi.mock("../lib/aiInsights", () => ({
  aiInsightsEngine: { generateInsights: vi.fn(() => ({ insights: [] })) },
}));
vi.mock("../lib/scoreAggregation", () => ({
  scoreAggregation: {
    getWeeklyScore: vi.fn(),
    getMonthlyScore: vi.fn(),
    getTimeSeriesData: vi.fn(),
    getScoreTrend: vi.fn(),
  },
}));
vi.mock("../webauthn", () => ({
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

vi.mock("../lib/stripe", () => ({
  getStripe: () => stripeMock,
  getStripeWebhookSecret: () => "whsec_test",
  stripeIdempotencyKey: (...parts: unknown[]) => parts.join("-"),
}));

vi.mock("../lib/crypto", () => ({ crypto: { encrypt: vi.fn(() => "encrypted-blob") } }));

vi.mock("../middleware/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware/security")>();
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...actual, apiLimiter: pass, authLimiter: pass, tripDataLimiter: pass, webhookLimiter: pass, coachLimiter: pass };
});
vi.mock("../middleware/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware/rateLimiter")>();
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...actual, gdprDeleteLimiter: pass, poolModificationLimiter: pass };
});

const { emitPoolContributionMock } = vi.hoisted(() => ({
  emitPoolContributionMock: vi.fn(),
}));
vi.mock("../lib/poolContribution", () => ({
  emitPoolContribution: emitPoolContributionMock,
}));

import { app, ready } from "../app";

const rawBody = JSON.stringify({ probe: true });

const ACTIVE_POLICY = { id: 42, userId: 7, stripeSubscriptionId: "sub_123", status: "active" };

beforeAll(async () => {
  await ready;
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Pool-contribution seam (M4 Task 4)", () => {
  it("emits exactly one pool-contribution event, correctly shaped, when payment succeeds on an existing (currently past_due) policy", async () => {
    const pastDuePolicy = { ...ACTIVE_POLICY, status: "past_due" };
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_payment_succeeded_pool_1",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_123", amount_paid: 4599 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.createStripeEvent.mockResolvedValue({
      id: "evt_payment_succeeded_pool_1",
      type: "invoice.payment_succeeded",
      status: "received",
      payload: {},
      processedAt: null,
      createdAt: new Date(),
    });
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(pastDuePolicy);
    storageMock.transitionPolicyWithAudit.mockResolvedValue({
      policy: { ...pastDuePolicy, status: "active" },
      audit: { id: 1, policyId: 42, fromStatus: "past_due", toStatus: "active", causedBy: "stripe:evt_payment_succeeded_pool_1", createdAt: new Date() },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(emitPoolContributionMock).toHaveBeenCalledTimes(1);
    expect(emitPoolContributionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        policyId: 42,
        amountCents: 4599,
        source: "stripe_payment_succeeded",
        // I5 fix: the Stripe event id is threaded through so a future M3
        // consumer can dedupe a double-emit caused by a retried delivery.
        eventId: "evt_payment_succeeded_pool_1",
        timestamp: expect.any(Date),
      }),
    );
  });

  it("emits exactly one pool-contribution event when payment succeeds and a brand new policy is created", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_payment_succeeded_pool_2",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_2", subscription: "sub_456", amount_paid: 3000 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 9, firebaseUid: "fb-2" });
    storageMock.createStripeEvent.mockResolvedValue({
      id: "evt_payment_succeeded_pool_2",
      type: "invoice.payment_succeeded",
      status: "received",
      payload: {},
      processedAt: null,
      createdAt: new Date(),
    });
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(undefined);
    storageMock.createPolicy.mockResolvedValue({ id: 99, userId: 9, status: "active" });
    storageMock.createPolicyAuditLog.mockResolvedValue({ id: "audit-1" });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(emitPoolContributionMock).toHaveBeenCalledTimes(1);
    expect(emitPoolContributionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        policyId: 99,
        amountCents: 3000,
        source: "stripe_payment_succeeded",
        eventId: "evt_payment_succeeded_pool_2",
      }),
    );
  });

  it("does NOT emit a pool-contribution event when the policy bind/transition fails (payment succeeded but bind was rejected)", async () => {
    const cancelledPolicy = { ...ACTIVE_POLICY, status: "cancelled" };
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_payment_succeeded_pool_3",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_123", amount_paid: 1000 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.createStripeEvent.mockResolvedValue({
      id: "evt_payment_succeeded_pool_3",
      type: "invoice.payment_succeeded",
      status: "received",
      payload: {},
      processedAt: null,
      createdAt: new Date(),
    });
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(cancelledPolicy);
    // cancelled -> active is not a valid transition (cancelled is terminal):
    // rejected by isValidTransition before any storage write, rethrows, no bind.

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(500);
    expect(emitPoolContributionMock).not.toHaveBeenCalled();
  });
});

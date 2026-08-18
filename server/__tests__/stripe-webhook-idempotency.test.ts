/**
 * Stripe webhook idempotency + audit trail (M4 Task 2).
 *
 * Verifies the stripe_events dedupe/audit contract added on top of the existing
 * ACK-after-process webhook handler (server/routes.ts ~1080-1280):
 *   - a signed event writes a stripe_events row (status received → processed)
 *   - a redelivery of an event already marked "processed" short-circuits: ack 200
 *     without re-running the switch / side effects
 *   - a handler failure (DB write throws) returns non-2xx and leaves the
 *     stripe_events row NOT marked "processed" (proving Stripe would legitimately
 *     retry, and that a retry of a failed event is NOT skipped as a duplicate)
 *
 * Mocking follows api-contract.characterisation.test.ts's pattern: real Express
 * wiring via supertest, storage/Stripe/Firebase mocked at the module boundary.
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

import { app, ready } from "../app";

const rawBody = JSON.stringify({ probe: true });

const CANCELLED_POLICY = { id: 42, userId: 7, stripeSubscriptionId: "sub_123", status: "active" };

// I3a fix: storage.createStripeEvent is now the atomic dedupe primitive - it
// always returns the authoritative row (never undefined), so every test that
// exercises the webhook must mock its return value directly instead of the
// old getStripeEventById-based read-then-insert setup.
function receivedEventRow(id: string, type: string) {
  return { id, type, status: "received" as const, payload: {}, processedAt: null, createdAt: new Date() };
}

beforeAll(async () => {
  await ready;
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Stripe webhook - stripe_events idempotency + audit (M4 Task 2)", () => {
  it("signed customer.subscription.deleted writes a stripe_events row and transitions the policy to cancelled", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_sub_deleted_1",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123", customer: "cus_1" } },
    });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.createStripeEvent.mockResolvedValue(receivedEventRow("evt_sub_deleted_1", "customer.subscription.deleted"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(CANCELLED_POLICY);
    storageMock.transitionPolicyWithAudit.mockResolvedValue({
      policy: { ...CANCELLED_POLICY, status: "cancelled" },
      audit: { id: 1, policyId: 42, fromStatus: "active", toStatus: "cancelled", causedBy: "stripe:evt_sub_deleted_1", createdAt: new Date() },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    // stripe_events row written before processing.
    expect(storageMock.createStripeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt_sub_deleted_1", type: "customer.subscription.deleted" })
    );
    // Policy state transition + audit write observed as one atomic call (I4).
    expect(storageMock.transitionPolicyWithAudit).toHaveBeenCalledWith({
      id: 42,
      fromStatus: "active",
      toStatus: "cancelled",
      causedBy: "stripe:evt_sub_deleted_1",
    });
    // Marked processed after the switch runs successfully.
    expect(storageMock.markStripeEventProcessed).toHaveBeenCalledWith("evt_sub_deleted_1");
    expect(storageMock.markStripeEventFailed).not.toHaveBeenCalled();
  });

  it("a redelivery of an event already marked processed short-circuits: 200 ack, switch not re-run", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_sub_deleted_1",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123", customer: "cus_1" } },
    });
    storageMock.createStripeEvent.mockResolvedValue({
      id: "evt_sub_deleted_1",
      type: "customer.subscription.deleted",
      status: "processed",
      processedAt: new Date(),
      payload: {},
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    // Side effects did NOT re-run.
    expect(storageMock.getPolicyByStripeSubscriptionId).not.toHaveBeenCalled();
    expect(storageMock.transitionPolicyWithAudit).not.toHaveBeenCalled();
    // The atomic dedupe write (I3a) IS always attempted - the returned row's
    // status is what tells us this event is a duplicate in the first place -
    // it just doesn't trigger reprocessing when that status is 'processed'.
    expect(storageMock.createStripeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt_sub_deleted_1" })
    );
  });

  it("forced-failure: a DB write throw during processing returns non-2xx and leaves stripe_events NOT processed (Stripe would legitimately retry)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_sub_deleted_fail",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_fail", customer: "cus_1" } },
    });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.createStripeEvent.mockResolvedValue(receivedEventRow("evt_sub_deleted_fail", "customer.subscription.deleted"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(CANCELLED_POLICY);
    storageMock.transitionPolicyWithAudit.mockRejectedValue(new Error("simulated DB write failure"));

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(500);
    // The row was written on receipt but must NOT be marked processed.
    expect(storageMock.createStripeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt_sub_deleted_fail" })
    );
    expect(storageMock.markStripeEventProcessed).not.toHaveBeenCalled();
    // Explicitly marked failed so a retry of the same event.id is NOT treated as
    // already-processed and re-enters the switch.
    expect(storageMock.markStripeEventFailed).toHaveBeenCalledWith("evt_sub_deleted_fail");
  });

  it("subscription.deleted is safe on repeated delivery: a policy already cancelled is not re-written (guarded, not unconditional)", async () => {
    // First delivery: policy starts 'active', event.id is new -> real write.
    const policy = { ...CANCELLED_POLICY, status: "active" };
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_sub_deleted_2",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123", customer: "cus_1" } },
    });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.createStripeEvent.mockResolvedValueOnce(receivedEventRow("evt_sub_deleted_2", "customer.subscription.deleted"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(policy);
    storageMock.transitionPolicyWithAudit.mockResolvedValue({
      policy: { ...policy, status: "cancelled" },
      audit: { id: 1, policyId: 42, fromStatus: "active", toStatus: "cancelled", causedBy: "stripe:evt_sub_deleted_2", createdAt: new Date() },
    });

    const first = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(first.status).toBe(200);
    expect(storageMock.transitionPolicyWithAudit).toHaveBeenCalledTimes(1);
    expect(storageMock.transitionPolicyWithAudit).toHaveBeenCalledWith({
      id: 42,
      fromStatus: "active",
      toStatus: "cancelled",
      causedBy: "stripe:evt_sub_deleted_2",
    });

    // Second delivery for the same subscription, simulating a redelivery that
    // reaches the switch again (e.g. stripe_events dedupe was bypassed, or a
    // second distinct event.id targets the same subscription). The
    // handler-level guard (skip if policy.status === 'cancelled') is what makes
    // this safe regardless of the event.id dedupe layer. The policy is now
    // already cancelled from the first call.
    const cancelledPolicy = { ...policy, status: "cancelled" };
    storageMock.createStripeEvent.mockResolvedValueOnce(receivedEventRow("evt_sub_deleted_2", "customer.subscription.deleted"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(cancelledPolicy);
    storageMock.transitionPolicyWithAudit.mockClear();

    const second = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(second.status).toBe(200);
    // No redundant write: exactly zero further calls to transitionPolicyWithAudit
    // on this second delivery, since the policy is already in the terminal state
    // and cancelled -> cancelled is rejected before any write is attempted.
    expect(storageMock.transitionPolicyWithAudit).not.toHaveBeenCalled();
  });

  it("invoice.payment_failed routes through the state machine: valid active -> past_due writes exactly one audit row", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_invoice_failed_1",
      type: "invoice.payment_failed",
      data: { object: { id: "in_1", customer: "cus_1", subscription: "sub_123", attempt_count: 1 } },
    });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.createStripeEvent.mockResolvedValue(receivedEventRow("evt_invoice_failed_1", "invoice.payment_failed"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(CANCELLED_POLICY); // status: "active"
    storageMock.transitionPolicyWithAudit.mockResolvedValue({
      policy: { ...CANCELLED_POLICY, status: "past_due" },
      audit: { id: 1, policyId: 42, fromStatus: "active", toStatus: "past_due", causedBy: "stripe:evt_invoice_failed_1", createdAt: new Date() },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(storageMock.transitionPolicyWithAudit).toHaveBeenCalledTimes(1);
    expect(storageMock.transitionPolicyWithAudit).toHaveBeenCalledWith({
      id: 42,
      fromStatus: "active",
      toStatus: "past_due",
      causedBy: "stripe:evt_invoice_failed_1",
    });
    expect(storageMock.markStripeEventProcessed).toHaveBeenCalledWith("evt_invoice_failed_1");
  });

  it("invoice.payment_failed on an already-cancelled policy is rejected as a benign no-op: no audit row, no crash", async () => {
    const cancelledPolicy = { ...CANCELLED_POLICY, status: "cancelled" };
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_invoice_failed_2",
      type: "invoice.payment_failed",
      data: { object: { id: "in_2", customer: "cus_1", subscription: "sub_123", attempt_count: 2 } },
    });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.createStripeEvent.mockResolvedValue(receivedEventRow("evt_invoice_failed_2", "invoice.payment_failed"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(cancelledPolicy);
    // cancelled is terminal (POLICY_TRANSITIONS.cancelled = []) - rejected by
    // isValidTransition before any storage call is made.

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(storageMock.transitionPolicyWithAudit).not.toHaveBeenCalled();
    expect(storageMock.markStripeEventProcessed).toHaveBeenCalledWith("evt_invoice_failed_2");
    expect(storageMock.markStripeEventFailed).not.toHaveBeenCalled();
  });

  it("payment_succeeded on a cancelled policy is a genuine reconciliation signal, not swallowed: rethrows, 500s, not marked processed", async () => {
    const cancelledPolicy = { ...CANCELLED_POLICY, status: "cancelled" };
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_payment_succeeded_1",
      type: "invoice.payment_succeeded",
      // amount_paid must be a valid positive amount here (C1 fix): otherwise
      // handleStripePaymentSucceeded's amount guard throws first and this
      // test would 500 for the wrong reason, never reaching the
      // cancelled-policy reconciliation path it's meant to exercise.
      data: { object: { customer: "cus_1", subscription: "sub_123", amount_paid: 4600 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.createStripeEvent.mockResolvedValue(receivedEventRow("evt_payment_succeeded_1", "invoice.payment_succeeded"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(cancelledPolicy);
    // cancelled -> active is not a valid transition (cancelled is terminal),
    // so transitionPolicy's narrowed catch (which only swallows the benign
    // active -> active no-op) must NOT treat this as benign - it must rethrow.

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(500);
    expect(storageMock.transitionPolicyWithAudit).not.toHaveBeenCalled();
    expect(storageMock.markStripeEventProcessed).not.toHaveBeenCalled();
    expect(storageMock.markStripeEventFailed).toHaveBeenCalledWith("evt_payment_succeeded_1");
  });
});

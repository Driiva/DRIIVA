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
  getPolicyByStripeSubscriptionId: vi.fn(),
  updatePolicy: vi.fn(),
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

import { app, ready } from "../app";

const rawBody = JSON.stringify({ probe: true });

const CANCELLED_POLICY = { id: 42, userId: 7, stripeSubscriptionId: "sub_123", status: "active" };

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
    storageMock.getStripeEventById.mockResolvedValue(undefined);
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(CANCELLED_POLICY);

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
    // Policy state transition observed.
    expect(storageMock.updatePolicy).toHaveBeenCalledWith(42, { status: "cancelled" });
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
    storageMock.getStripeEventById.mockResolvedValue({
      id: "evt_sub_deleted_1",
      type: "customer.subscription.deleted",
      status: "processed",
      processedAt: new Date(),
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
    expect(storageMock.updatePolicy).not.toHaveBeenCalled();
    expect(storageMock.createStripeEvent).not.toHaveBeenCalled();
  });

  it("forced-failure: a DB write throw during processing returns non-2xx and leaves stripe_events NOT processed (Stripe would legitimately retry)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_sub_deleted_fail",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_fail", customer: "cus_1" } },
    });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.getStripeEventById.mockResolvedValue(undefined);
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(CANCELLED_POLICY);
    storageMock.updatePolicy.mockRejectedValue(new Error("simulated DB write failure"));

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

  it("invoice.payment_failed persists past_due against the bound policy", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_invoice_failed_1",
      type: "invoice.payment_failed",
      data: { object: { id: "in_1", customer: "cus_1", subscription: "sub_123", attempt_count: 1 } },
    });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-1" });
    storageMock.getStripeEventById.mockResolvedValue(undefined);
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(CANCELLED_POLICY);
    storageMock.updatePolicy.mockResolvedValue({ ...CANCELLED_POLICY, status: "past_due" });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(storageMock.updatePolicy).toHaveBeenCalledWith(42, { status: "past_due" });
    expect(storageMock.markStripeEventProcessed).toHaveBeenCalledWith("evt_invoice_failed_1");
  });
});

/**
 * Policy-bind correctness tests (M4 whole-branch review fixes C1, C2, I3b).
 *
 * Harness mirrors stripe-webhook-idempotency.test.ts: real Express wiring via
 * supertest, storage/Stripe/Firebase mocked at the module boundary.
 *
 * Covers:
 *  - C1: a newly-bound policy carries the real premium Stripe actually
 *    charged and the real billing term (not the old hardcoded
 *    basePremiumCents: 0 / coverageType: 'standard' / now+1-year fabrication),
 *    and refuses (500, no policy row) when amount_paid is missing.
 *  - C2: a Firestore pendingPayment write failure now returns non-2xx and
 *    leaves stripe_events unmarked-processed (instead of the old
 *    swallow-and-200), and a subsequent retry is safe (no duplicate policy
 *    creation) and can succeed once Firestore recovers.
 *  - I3b: two concurrent first-payment deliveries for the same new
 *    subscription result in exactly one policy row - the loser's unique-
 *    constraint violation is caught and transitions the winner's row instead
 *    of crashing or creating a duplicate.
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

const { getFirebaseAdminMock } = vi.hoisted(() => ({
  getFirebaseAdminMock: vi.fn(() => null as any),
}));
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  getFirebaseAdmin: getFirebaseAdminMock,
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

function receivedRow(id: string, type: string) {
  return { id, type, status: "received" as const, payload: {}, processedAt: null, createdAt: new Date() };
}

function failedRow(id: string, type: string) {
  return { id, type, status: "failed" as const, payload: {}, processedAt: null, createdAt: new Date() };
}

/** Minimal chainable Firestore Admin mock: quotes/{id} and users/{uid}/pendingPayments/{subId}. */
function makeAdminApp(opts: { quoteExists?: boolean; quoteData?: Record<string, unknown>; pendingPaymentSetImpl?: () => Promise<void> } = {}) {
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

  return { app: { firestore: () => firestoreRoot } as any, getQuoteMock, setPendingPaymentMock };
}

beforeAll(async () => {
  await ready;
});

beforeEach(() => {
  vi.resetAllMocks();
  getFirebaseAdminMock.mockReturnValue(null);
});

describe("C1: policy bind carries real premium/term data", () => {
  it("creates a new policy with basePremiumCents/currentPremiumCents = the actual invoice amount, billingCycle + expiration from the real Stripe subscription term", async () => {
    const currentPeriodEndUnix = Math.floor(new Date("2027-07-28T00:00:00.000Z").getTime() / 1000);
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_c1_real_premium",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_c1", amount_paid: 12500 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      metadata: { billingPeriod: "annual" },
      items: { data: [{ current_period_end: currentPeriodEndUnix, plan: { interval: "year" } }] },
    });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: undefined });
    storageMock.createStripeEvent.mockResolvedValue(receivedRow("evt_c1_real_premium", "invoice.payment_succeeded"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(undefined);
    storageMock.createPolicy.mockImplementation(async (policy: any) => ({ id: 501, ...policy }));
    storageMock.createPolicyAuditLog.mockResolvedValue({ id: 1 });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(storageMock.createPolicy).toHaveBeenCalledTimes(1);
    const createdPolicy = storageMock.createPolicy.mock.calls[0][0];
    // Real premium - what Stripe actually charged - not a hardcoded 0.
    expect(createdPolicy.basePremiumCents).toBe(12500);
    expect(createdPolicy.currentPremiumCents).toBe(12500);
    // Real billing cycle from the subscription's own metadata/interval.
    expect(createdPolicy.billingCycle).toBe("annual");
    // Real expiration from Stripe's own current_period_end - not a fabricated
    // now+1-year regardless of actual interval.
    expect(createdPolicy.expirationDate).toEqual(new Date(currentPeriodEndUnix * 1000));
    expect(createdPolicy.status).toBe("active");
  });

  it("reads current_period_end from the subscription root when the pinned Stripe API version (acacia) doesn't carry it on items, not just the newer (basil) items-shaped field", async () => {
    // server/lib/stripe.ts pins apiVersion 2025-01-27.acacia. Under that version
    // current_period_end lives on the subscription object itself, not on
    // subscription items (that moved in 2025-03-31.basil). stripe-node's types
    // reflect the newer shape regardless of the pinned version, so a fix that only
    // reads sub.items.data[0].current_period_end silently falls back on every real
    // acacia-shaped response.
    const currentPeriodEndUnix = Math.floor(new Date("2027-06-15T00:00:00.000Z").getTime() / 1000);
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_c1_acacia_shape",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_c1_acacia", amount_paid: 9900 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      metadata: { billingPeriod: "annual" },
      // acacia shape: current_period_end on the root, absent from items.
      current_period_end: currentPeriodEndUnix,
      items: { data: [{ plan: { interval: "year" } }] },
    });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: undefined });
    storageMock.createStripeEvent.mockResolvedValue(receivedRow("evt_c1_acacia_shape", "invoice.payment_succeeded"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(undefined);
    storageMock.createPolicy.mockImplementation(async (policy: any) => ({ id: 502, ...policy }));
    storageMock.createPolicyAuditLog.mockResolvedValue({ id: 1 });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(storageMock.createPolicy).toHaveBeenCalledTimes(1);
    const createdPolicy = storageMock.createPolicy.mock.calls[0][0];
    expect(createdPolicy.expirationDate).toEqual(new Date(currentPeriodEndUnix * 1000));
  });

  it("resolves coverageType from the stored Firestore quote when quoteId + Admin are both available", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_c1_quote",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_c1_quote", amount_paid: 8000 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: { quoteId: "q_premium_1" } });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: undefined });
    storageMock.createStripeEvent.mockResolvedValue(receivedRow("evt_c1_quote", "invoice.payment_succeeded"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(undefined);
    storageMock.createPolicy.mockImplementation(async (policy: any) => ({ id: 502, ...policy }));
    storageMock.createPolicyAuditLog.mockResolvedValue({ id: 1 });

    const { app: adminApp } = makeAdminApp({ quoteExists: true, quoteData: { coverageType: "premium" } });
    getFirebaseAdminMock.mockReturnValue(adminApp);

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(200);
    const createdPolicy = storageMock.createPolicy.mock.calls[0][0];
    expect(createdPolicy.coverageType).toBe("premium");
  });

  it("refuses to bind (500, no policy row, Stripe retries) when invoice.amount_paid is missing", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_c1_no_amount",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_c1_no_amount" } }, // no amount_paid
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: undefined });
    storageMock.createStripeEvent.mockResolvedValue(receivedRow("evt_c1_no_amount", "invoice.payment_succeeded"));

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(500);
    expect(storageMock.createPolicy).not.toHaveBeenCalled();
    expect(storageMock.getPolicyByStripeSubscriptionId).not.toHaveBeenCalled();
    expect(storageMock.markStripeEventProcessed).not.toHaveBeenCalled();
    expect(storageMock.markStripeEventFailed).toHaveBeenCalledWith("evt_c1_no_amount");
  });

  it("refuses to bind when amount_paid is zero (a real charge cannot legitimately be £0 for bound cover)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_c1_zero_amount",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_c1_zero", amount_paid: 0 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: undefined });
    storageMock.createStripeEvent.mockResolvedValue(receivedRow("evt_c1_zero_amount", "invoice.payment_succeeded"));

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(500);
    expect(storageMock.createPolicy).not.toHaveBeenCalled();
  });
});

describe("C2: Firestore cover-bind write failure must not silently succeed", () => {
  it("a Firestore pendingPayment write failure returns non-2xx and leaves the stripe_events row NOT marked processed, even though the Postgres policy is already active", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_c2_firestore_fail",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_c2", amount_paid: 6000 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-c2" });
    storageMock.createStripeEvent.mockResolvedValue(receivedRow("evt_c2_firestore_fail", "invoice.payment_succeeded"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(undefined);
    storageMock.createPolicy.mockImplementation(async (policy: any) => ({ id: 601, ...policy }));
    storageMock.createPolicyAuditLog.mockResolvedValue({ id: 1 });

    const { app: adminApp } = makeAdminApp({
      pendingPaymentSetImpl: () => Promise.reject(new Error("Firestore unavailable")),
    });
    getFirebaseAdminMock.mockReturnValue(adminApp);

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    // The webhook must NOT ack 200 - the old swallow-and-log behaviour would
    // have returned 200 here despite the Firestore mirror never being written.
    expect(res.status).toBe(500);
    // The Postgres policy WAS already created/active (that's exactly the
    // "charged customer, no cover record" gap this fix closes - it's not that
    // the policy bind failed, it's that the mirror write failed afterwards).
    expect(storageMock.createPolicy).toHaveBeenCalledTimes(1);
    // stripe_events must not be marked processed, so Stripe's
    // redelivery-on-non-2xx actually fires and this gets retried.
    expect(storageMock.markStripeEventProcessed).not.toHaveBeenCalled();
    expect(storageMock.markStripeEventFailed).toHaveBeenCalledWith("evt_c2_firestore_fail");
  });

  it("a retry after a Firestore failure is safe: does not re-create the policy (active -> active benign no-op) and succeeds once Firestore recovers", async () => {
    const EXISTING_ACTIVE_POLICY = { id: 602, userId: 7, stripeSubscriptionId: "sub_c2_retry", status: "active" };

    // First delivery: policy already active in Postgres (e.g. from a prior
    // successful bind), but the Firestore mirror write fails. Same event.id
    // both times (Stripe redelivers the identical event on retry) - a
    // persistent mockReturnValue, not Once, since both requests need it.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_c2_retry",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_c2_retry", amount_paid: 6000 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: "fb-c2-retry" });
    storageMock.createStripeEvent.mockResolvedValueOnce(receivedRow("evt_c2_retry", "invoice.payment_succeeded"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(EXISTING_ACTIVE_POLICY);

    const failingAdmin = makeAdminApp({ pendingPaymentSetImpl: () => Promise.reject(new Error("Firestore unavailable")) });
    getFirebaseAdminMock.mockReturnValueOnce(failingAdmin.app);

    const first = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(first.status).toBe(500);
    // Policy bind hit the active -> active benign no-op path - no new policy,
    // no CAS write attempted.
    expect(storageMock.createPolicy).not.toHaveBeenCalled();
    expect(storageMock.transitionPolicyWithAudit).not.toHaveBeenCalled();

    // Stripe redelivers the same event.id. The stripe_events row is now
    // 'failed' (from markStripeEventFailed above) - createStripeEvent's
    // atomic upsert returns that row, and 'failed' is NOT skipped (unchanged
    // dedupe contract), so it re-enters the switch.
    storageMock.createStripeEvent.mockResolvedValueOnce(failedRow("evt_c2_retry", "invoice.payment_succeeded"));
    const recoveredAdmin = makeAdminApp(); // set() resolves normally this time
    getFirebaseAdminMock.mockReturnValueOnce(recoveredAdmin.app);

    const second = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(second.status).toBe(200);
    // Still no policy creation across either attempt - the retry reused the
    // already-active policy rather than duplicating it.
    expect(storageMock.createPolicy).not.toHaveBeenCalled();
    expect(recoveredAdmin.setPendingPaymentMock).toHaveBeenCalledTimes(1);
    expect(storageMock.markStripeEventProcessed).toHaveBeenCalledWith("evt_c2_retry");
  });
});

describe("I3b: concurrent first-payment deliveries for a new subscription do not create duplicate policy rows", () => {
  it("the loser's unique-constraint violation on policies.stripe_subscription_id is caught and transitions the winner's row instead of crashing or duplicating", async () => {
    const WINNER_POLICY = { id: 701, userId: 7, stripeSubscriptionId: "sub_race", status: "active" };

    // Delivery A (the "winner"): observes no existing policy, insert succeeds.
    stripeMock.webhooks.constructEvent.mockReturnValueOnce({
      id: "evt_race_a",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_race", amount_paid: 5000 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: undefined });
    storageMock.createStripeEvent.mockResolvedValueOnce(receivedRow("evt_race_a", "invoice.payment_succeeded"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValueOnce(undefined);
    storageMock.createPolicy.mockResolvedValueOnce(WINNER_POLICY);
    storageMock.createPolicyAuditLog.mockResolvedValueOnce({ id: 1 });

    const first = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(first.status).toBe(200);
    expect(storageMock.createPolicy).toHaveBeenCalledTimes(1);

    // Delivery B (the "loser"): a genuinely concurrent second event for the
    // same subscription (e.g. a duplicate webhook endpoint, or Stripe's own
    // at-least-once delivery firing twice close together). It also observed
    // no existing policy at its own read time (the true race), so it also
    // attempts to create one - but by the time its INSERT runs, delivery A's
    // row already exists, so it hits the unique-constraint violation.
    stripeMock.webhooks.constructEvent.mockReturnValueOnce({
      id: "evt_race_b",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_race", amount_paid: 5000 } },
    });
    storageMock.createStripeEvent.mockResolvedValueOnce(receivedRow("evt_race_b", "invoice.payment_succeeded"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValueOnce(undefined); // race: still saw nothing
    const uniqueViolation = Object.assign(
      new Error('duplicate key value violates unique constraint "policies_stripe_subscription_id_unique"'),
      { code: "23505" },
    );
    storageMock.createPolicy.mockRejectedValueOnce(uniqueViolation);
    // Re-fetch after the conflict finds delivery A's row.
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValueOnce(WINNER_POLICY);

    const second = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    // Handled gracefully, not a crash/500.
    expect(second.status).toBe(200);
    // The loser attempted an insert (and it was rejected) - but no second
    // policy row was actually created: createPolicy was called twice total
    // (once per delivery), and the second call's rejection was caught rather
    // than propagating as an unhandled failure or a duplicate row.
    expect(storageMock.createPolicy).toHaveBeenCalledTimes(2);
    // The loser transitioned the winner's row - active -> active is rejected
    // by the state machine before any storage write, so this is a genuine
    // no-op (not a second audit-logged transition).
    expect(storageMock.transitionPolicyWithAudit).not.toHaveBeenCalled();
    expect(storageMock.createPolicyAuditLog).toHaveBeenCalledTimes(1); // only delivery A's create
  });

  it("surfaces a non-unique-violation createPolicy failure as a genuine error (500) rather than misclassifying it as a race", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_genuine_db_error",
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_genuine_fail", amount_paid: 5000 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });
    storageMock.getUserByStripeCustomerId.mockResolvedValue({ id: 7, firebaseUid: undefined });
    storageMock.createStripeEvent.mockResolvedValue(receivedRow("evt_genuine_db_error", "invoice.payment_succeeded"));
    storageMock.getPolicyByStripeSubscriptionId.mockResolvedValue(undefined);
    storageMock.createPolicy.mockRejectedValue(new Error("connection terminated unexpectedly"));

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);

    expect(res.status).toBe(500);
    expect(storageMock.markStripeEventFailed).toHaveBeenCalledWith("evt_genuine_db_error");
  });
});

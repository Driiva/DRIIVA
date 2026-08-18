/**
 * CHARACTERISATION SUITE — server API contract (rebuild mission, 2026-07).
 *
 * Locks in the CURRENT behaviour of server/app.ts + server/routes.ts, quirks
 * included. A failure here means behaviour changed (or the test is wrong) —
 * never "found a bug". Contract source: docs/rebuild/audit-api-contracts.md
 * (API-01..API-36).
 *
 * Real: Express wiring, middleware order, zod schemas, route logic, refund
 * calculation (@driiva/scoring's calculateRefundCents - a pure function, not
 * mocked).
 * Mocked at the module boundary: Firebase Admin, Neon storage, Stripe,
 * WebAuthn service, AI providers.
 * Rate limiters are pass-through here; their 429 contract is characterised
 * separately in rate-limit.characterisation.test.ts (own module registry).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

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

vi.mock("../storage", () => ({
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

vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  getFirebaseAdmin: vi.fn(() => null),
}));

// Dynamically imported by the Stripe webhook handler for FieldValue only.
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

vi.mock("../lib/crypto", () => ({
  crypto: { encrypt: vi.fn(() => "encrypted-blob") },
}));

// Rate limiters are pass-through in this file (contract characterised separately).
vi.mock("../middleware/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware/security")>();
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
vi.mock("../middleware/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware/rateLimiter")>();
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...actual, gdprDeleteLimiter: pass, poolModificationLimiter: pass };
});

import { app, ready } from "../app";
import { storage } from "../storage";
import { verifyFirebaseToken, getFirebaseAdmin } from "../lib/firebase-admin";
import { calculateRefundCents } from "../../packages/scoring/src/refund";
import { scoreAggregation } from "../lib/scoreAggregation";
import { webauthnService } from "../webauthn";

const verify = vi.mocked(verifyFirebaseToken);
const admin = vi.mocked(getFirebaseAdmin);

const NEON_USER = {
  id: 7,
  firebaseUid: "fb-uid-1",
  email: "driver@driiva.co.uk",
  name: "Test Driver",
  onboardingComplete: true,
  premiumAmount: "840.00",
  stripeCustomerId: null as string | null,
};

/** Authenticate subsequent requests as the given Neon user (or token-only if row=null). */
function asUser(row: typeof NEON_USER | null = NEON_USER, uid = "fb-uid-1") {
  verify.mockResolvedValue({ uid, email: row?.email ?? "driver@driiva.co.uk" });
  vi.mocked(storage.getUserByFirebaseUid).mockResolvedValue(row as never);
  return { Authorization: "Bearer test-token" };
}

beforeAll(async () => {
  await ready;
});

beforeEach(() => {
  vi.clearAllMocks();
  admin.mockReturnValue(null);
});

describe("API-01 health", () => {
  it("GET /api/health is public and returns ok+timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
  });
});

describe("auth gating (requireAuth / requireResourceOwner / requireAdmin)", () => {
  it("AUTH endpoint without token → 401 FIREBASE_TOKEN_REQUIRED", async () => {
    const res = await request(app).get("/api/profile/me");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("FIREBASE_TOKEN_REQUIRED");
  });

  it("AUTH endpoint with invalid token → 401", async () => {
    verify.mockResolvedValue(null);
    const res = await request(app)
      .get("/api/profile/me")
      .set("Authorization", "Bearer bad");
    expect(res.status).toBe(401);
  });

  it("OWNER endpoint with mismatched :userId → 403 RESOURCE_OWNER_REQUIRED", async () => {
    const headers = asUser();
    const res = await request(app).get("/api/dashboard/999").set(headers);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("RESOURCE_OWNER_REQUIRED");
  });

  it("ADMIN endpoint as non-admin → 403 ADMIN_REQUIRED", async () => {
    const headers = asUser();
    const res = await request(app)
      .put("/api/community-pool")
      .set(headers)
      .send({ poolAmount: "1.00" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_REQUIRED");
  });

  it("ADMIN endpoint as admin uid passes the gate (unvalidated body goes straight to storage)", async () => {
    const headers = asUser({ ...NEON_USER, firebaseUid: "admin-uid" }, "admin-uid");
    vi.mocked(storage.updateCommunityPool).mockResolvedValue({ id: 1, poolAmount: "1.00" } as never);
    const res = await request(app)
      .put("/api/community-pool")
      .set(headers)
      .send({ anyField: "accepted-without-validation" });
    expect(res.status).toBe(200);
    // QUIRK: no field allow-list — arbitrary body reaches storage.updateCommunityPool
    expect(vi.mocked(storage.updateCommunityPool).mock.calls[0][0]).toMatchObject({
      anyField: "accepted-without-validation",
    });
  });
});

describe("API-02/03 profile/me", () => {
  // DISPOSITION (M1 T3): the two prior "QUIRK: ... 401" tests below pinned
  // verifyFirebaseAuth's old wall (no Neon row → req.auth never set → 401).
  // The wall is retired: a valid token now authenticates regardless of a
  // Neon row. FIX, not drop: both are rewritten to pin the new behaviour.
  it("FIX (was QUIRK/401): valid Firebase token with NO Neon row now authenticates, GET /api/profile/me 200s via auto-provision", async () => {
    const headers = asUser(null);
    vi.mocked(storage.getOrCreateUserByFirebase).mockResolvedValue(NEON_USER as never);
    const res = await request(app).get("/api/profile/me").set(headers);
    expect(res.status).toBe(200);
    expect(storage.getOrCreateUserByFirebase).toHaveBeenCalledWith(
      "fb-uid-1",
      "driver@driiva.co.uk",
      undefined
    );
  });

  // DISPOSITION: FIX. PATCH no longer 401s for a missing Neon row; it is
  // retired outright (410) regardless of the row, so the old distinction
  // this test drew (401 for no-row vs 400/200 for a row) no longer applies.
  it("FIX (was QUIRK/401): PATCH /api/profile/me is retired, 410 regardless of Neon row, no storage write", async () => {
    const headers = asUser(null);
    const res = await request(app)
      .patch("/api/profile/me")
      .set(headers)
      .send({ onboardingComplete: true });
    expect(res.status).toBe(410);
    expect(storage.updateUser).not.toHaveBeenCalled();
  });

  // DISPOSITION: DROP. The endpoint no longer parses the request body at
  // all (onboarding-write role retired), so "rejects non-boolean" no longer
  // has anything to assert; folded into the 410-for-any-body test below.
  //
  // DISPOSITION: DROP. "persists boolean onboardingComplete via
  // storage.updateUser" pinned the write path this task removes; superseded
  // by the 410 test above and the one below.
  it("PATCH /api/profile/me stays 410 for an existing Neon user too (no legacy write path remains)", async () => {
    const headers = asUser();
    const res = await request(app)
      .patch("/api/profile/me")
      .set(headers)
      .send({ onboardingComplete: true });
    expect(res.status).toBe(410);
    expect(storage.updateUser).not.toHaveBeenCalled();
  });
});

describe("API-15 GET /api/trips/:userId", () => {
  it("QUIRK: startDate without endDate is silently ignored — falls through to the pagination path, 200", async () => {
    const headers = asUser();
    vi.mocked(storage.getUserTrips).mockResolvedValue([] as never);
    const res = await request(app)
      .get("/api/trips/7?startDate=2026-06-01T00:00:00Z")
      .set(headers);
    expect(res.status).toBe(200);
    expect(storage.getUserTrips).toHaveBeenCalled();
    expect(storage.getTripsByDateRange).not.toHaveBeenCalled();
  });

  it("unparseable dates (both present) → 400 ISO 8601 message", async () => {
    const headers = asUser();
    const res = await request(app)
      .get("/api/trips/7?startDate=abc&endDate=def")
      .set(headers);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("ISO 8601");
  });

  it("endDate <= startDate → 400", async () => {
    const headers = asUser();
    const res = await request(app)
      .get("/api/trips/7?startDate=2026-06-02T00:00:00Z&endDate=2026-06-01T00:00:00Z")
      .set(headers);
    expect(res.status).toBe(400);
  });

  it("default pagination path returns array from getUserTrips", async () => {
    const headers = asUser();
    vi.mocked(storage.getUserTrips).mockResolvedValue([{ id: 1 }] as never);
    const res = await request(app).get("/api/trips/7").set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
  });
});

describe("API-16..19 scores", () => {
  it("weekly with no data → 404", async () => {
    const headers = asUser();
    vi.mocked(scoreAggregation.getWeeklyScore).mockResolvedValue(null as never);
    const res = await request(app).get("/api/scores/weekly/7").set(headers);
    expect(res.status).toBe(404);
  });

  it("QUIRK: timeseries accepts an invalid granularity without a 400 (unvalidated cast)", async () => {
    const headers = asUser();
    vi.mocked(scoreAggregation.getTimeSeriesData).mockResolvedValue([] as never);
    const res = await request(app)
      .get("/api/scores/timeseries/7?granularity=hourly")
      .set(headers);
    expect(res.status).toBe(200);
    expect(vi.mocked(scoreAggregation.getTimeSeriesData).mock.calls[0]).toContain("hourly");
  });
});

describe("API-13 dashboard aggregate", () => {
  it("404 when driving profile missing", async () => {
    const headers = asUser();
    vi.mocked(storage.getUser).mockResolvedValue(NEON_USER as never);
    vi.mocked(storage.getDrivingProfile).mockResolvedValue(undefined as never);
    const res = await request(app).get("/api/dashboard/7").set(headers);
    expect(res.status).toBe(404);
  });

  it("aggregates user+profile+trips+pool+achievements+leaderboard with projectedRefund", async () => {
    const headers = asUser();
    vi.mocked(storage.getUser).mockResolvedValue(NEON_USER as never);
    vi.mocked(storage.getDrivingProfile).mockResolvedValue({ currentScore: 90 } as never);
    vi.mocked(storage.getUserTrips).mockResolvedValue([] as never);
    vi.mocked(storage.getCommunityPool).mockResolvedValue({ safetyFactor: "0.80" } as never);
    vi.mocked(storage.getUserAchievements).mockResolvedValue([] as never);
    vi.mocked(storage.getLeaderboard).mockResolvedValue([] as never);
    const res = await request(app).get("/api/dashboard/7").set(headers);
    expect(res.status).toBe(200);
    // Real calculateRefundCents (unmocked): communityScore 75, premium 840.00
    // -> 84000 cents contribution and cap base, safetyFactor 0.80.
    const expectedRefund = calculateRefundCents(90, 75, 84000, 0.80, 84000);
    expect(res.body.profile).toHaveProperty("projectedRefund", expectedRefund);
    expect(res.body).toHaveProperty("communityPool");
    expect(res.body).toHaveProperty("leaderboard");
  });
});

describe("API-21/23 public reads", () => {
  it("QUIRK: GET /api/community-pool returns an empty 200 body when no pool row exists", async () => {
    vi.mocked(storage.getCommunityPool).mockResolvedValue(undefined as never);
    const res = await request(app).get("/api/community-pool");
    expect(res.status).toBe(200);
    expect(res.text).toBe("");
  });

  it("GET /api/leaderboard is public and caches for 60s (second call skips storage)", async () => {
    vi.mocked(storage.getLeaderboard).mockResolvedValue([{ userId: 7 }] as never);
    const key = `${Date.now()}`; // unique period defeats any cache from other tests
    const first = await request(app).get(`/api/leaderboard?period=${key}`);
    const second = await request(app).get(`/api/leaderboard?period=${key}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(vi.mocked(storage.getLeaderboard)).toHaveBeenCalledTimes(1);
  });
});

describe("API-20 incidents", () => {
  it("surfaces Zod errors as 400 with errors array (contrast trips' 500 quirk)", async () => {
    const headers = asUser();
    const res = await request(app)
      .post("/api/incidents")
      .set(headers)
      .send({ description: "missing type and severity" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});

describe("API-28/29 GDPR", () => {
  it("export sets a file-download Content-Disposition", async () => {
    const headers = asUser();
    vi.mocked(storage.exportUserData).mockResolvedValue({ user: NEON_USER } as never);
    const res = await request(app).get("/api/gdpr/export/7").set(headers);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("driiva-data-7.json");
  });

  it("delete calls storage.deleteUserData for the owner only", async () => {
    const headers = asUser();
    vi.mocked(storage.deleteUserData).mockResolvedValue(undefined as never);
    const res = await request(app).delete("/api/gdpr/delete/7").set(headers);
    expect(res.status).toBe(200);
    expect(storage.deleteUserData).toHaveBeenCalledWith(7);
  });
});

describe("API-30/31 AI endpoints", () => {
  it("coach without score/scoreBreakdown → 400", async () => {
    const headers = asUser();
    const res = await request(app).post("/api/ai/coach").set(headers).send({});
    expect(res.status).toBe(400);
  });

  it("coach with no provider key configured → 503", async () => {
    const savedA = process.env.AI_COACH_API_KEY;
    const savedP = process.env.PERPLEXITY_API_KEY;
    delete process.env.AI_COACH_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    try {
      const headers = asUser();
      const res = await request(app)
        .post("/api/ai/coach")
        .set(headers)
        .send({ score: 88, scoreBreakdown: {} });
      expect(res.status).toBe(503);
    } finally {
      if (savedA !== undefined) process.env.AI_COACH_API_KEY = savedA;
      if (savedP !== undefined) process.env.PERPLEXITY_API_KEY = savedP;
    }
  });

  it("ask without prompt → 400", async () => {
    const headers = asUser();
    const res = await request(app).post("/api/ask").set(headers).send({});
    expect(res.status).toBe(400);
  });
});

describe("API-32/33/34 payments", () => {
  beforeEach(() => {
    vi.mocked(storage.updateStripeCustomerId).mockResolvedValue(undefined as never);
    stripeMock.customers.create.mockResolvedValue({ id: "cus_new" });
  });

  it("create-subscription rejects annualPremiumCents outside 10000..500000 with 400", async () => {
    const headers = asUser();
    const res = await request(app)
      .post("/api/payments/create-subscription")
      .set(headers)
      .send({ annualPremiumCents: 999 });
    expect(res.status).toBe(400);
  });

  it("create-subscription legacy branch rejects a non-allow-listed priceId with 400", async () => {
    const headers = asUser();
    const res = await request(app)
      .post("/api/payments/create-subscription")
      .set(headers)
      .send({ priceId: "price_attacker_cheap" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid priceId");
  });

  it("create-checkout rejects a non-allow-listed priceId with 400", async () => {
    const headers = asUser();
    const res = await request(app)
      .post("/api/payments/create-checkout")
      .set(headers)
      .send({ priceId: "price_attacker_cheap" });
    expect(res.status).toBe(400);
  });

  it("create-checkout accepts an allow-listed priceId and returns session url", async () => {
    const headers = asUser();
    stripeMock.checkout.sessions.create.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.test/cs_1",
    });
    const res = await request(app)
      .post("/api/payments/create-checkout")
      .set(headers)
      .send({ priceId: "price_allowed_extra" });
    expect(res.status).toBe(200);
    expect(res.body.url).toContain("checkout.stripe.test");
  });

  it("billing-portal without stripeCustomerId → 404", async () => {
    const headers = asUser({ ...NEON_USER, stripeCustomerId: null });
    const res = await request(app).get("/api/payments/billing-portal").set(headers);
    expect(res.status).toBe(404);
  });
});

describe("API-35 Stripe webhook", () => {
  const rawBody = JSON.stringify({ probe: true });

  it("bad signature → 400 Webhook Error", async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("sig mismatch");
    });
    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "bad")
      .set("content-type", "application/json")
      .send(rawBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Webhook Error");
  });

  it("QUIRK: payment_failed / subscription.deleted / checkout.session.completed are log-only stubs that still 200", async () => {
    for (const type of [
      "invoice.payment_failed",
      "customer.subscription.deleted",
      "checkout.session.completed",
    ]) {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type,
        data: { object: { customer: "cus_1", subscription: "sub_1", id: "obj_1" } },
      });
      vi.mocked(storage.getUserByStripeCustomerId).mockResolvedValue(NEON_USER as never);
      const res = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "ok")
        .set("content-type", "application/json")
        .send(rawBody);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
    }
  });

  it("QUIRK: payment_succeeded with Firebase Admin uninitialised still 200s (pendingPayment write silently skipped)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "invoice.payment_succeeded",
      // amount_paid must be a valid positive amount (C1 fix): the webhook now
      // refuses to bind a policy without a real charged amount.
      data: { object: { customer: "cus_1", subscription: "sub_1", amount_paid: 4600 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: { quoteId: "q_1" } });
    vi.mocked(storage.getUserByStripeCustomerId).mockResolvedValue(NEON_USER as never);
    vi.mocked(storage.getPolicyByStripeSubscriptionId).mockResolvedValue(undefined as never);
    vi.mocked(storage.createPolicy).mockResolvedValue({ id: 99, status: "active" } as never);
    admin.mockReturnValue(null);
    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);
    expect(res.status).toBe(200);
  });

  it("payment_succeeded with Admin available writes users/{uid}/pendingPayments/{subId}", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", subscription: "sub_1", amount_paid: 4600 } },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: { quoteId: "q_1" } });
    vi.mocked(storage.getUserByStripeCustomerId).mockResolvedValue(NEON_USER as never);
    vi.mocked(storage.getPolicyByStripeSubscriptionId).mockResolvedValue(undefined as never);
    vi.mocked(storage.createPolicy).mockResolvedValue({ id: 99, status: "active" } as never);

    const set = vi.fn().mockResolvedValue(undefined);
    const chain = {
      collection: vi.fn(() => chain),
      doc: vi.fn(() => chain),
      set,
    };
    admin.mockReturnValue({ firestore: () => chain } as never);

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "ok")
      .set("content-type", "application/json")
      .send(rawBody);
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0]).toMatchObject({
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      status: "pending",
      quoteId: "q_1",
    });
  });
});

describe("API-36 Root webhook", () => {
  it("QUIRK: with ROOT_WEBHOOK_SECRET unset, any unsigned payload is accepted (200, log-only)", async () => {
    delete process.env.ROOT_WEBHOOK_SECRET;
    const res = await request(app)
      .post("/api/webhooks/root")
      .set("content-type", "application/json")
      .send(JSON.stringify({ event_type: "policy.updated", policy_id: "p_1" }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it("with ROOT_WEBHOOK_SECRET set, a missing signature → 400", async () => {
    process.env.ROOT_WEBHOOK_SECRET = "root_secret";
    try {
      const res = await request(app)
        .post("/api/webhooks/root")
        .set("content-type", "application/json")
        .send(JSON.stringify({ event_type: "policy.updated" }));
      expect(res.status).toBe(400);
    } finally {
      delete process.env.ROOT_WEBHOOK_SECRET;
    }
  });
});

describe("WebAuthn endpoints (API-06..API-10)", () => {
  it("QUIRK: /check always 200s — internal errors collapse to hasPasskey:false", async () => {
    vi.mocked(webauthnService.hasCredentials).mockRejectedValue(new Error("db down"));
    const res = await request(app)
      .post("/api/auth/webauthn/check")
      .send({ email: "driver@driiva.co.uk" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasPasskey: false });
  });

  it("register/start requires auth (401 without token) — enrolment cannot be aimed at a victim email", async () => {
    const res = await request(app)
      .post("/api/auth/webauthn/register/start")
      .send({ email: "victim@driiva.co.uk" });
    expect(res.status).toBe(401);
  });

  it("authenticate/complete success returns user + Firebase customToken bridge (route checks result.verified, not success)", async () => {
    vi.mocked(webauthnService.verifyAuthentication).mockResolvedValue({
      verified: true,
      user: { id: 7, email: "driver@driiva.co.uk" },
      customToken: "custom-token-1",
    } as never);
    const res = await request(app)
      .post("/api/auth/webauthn/authenticate/complete")
      .send({ email: "driver@driiva.co.uk", assertion: {} });
    expect(res.status).toBe(200);
    expect(res.body.customToken).toBe("custom-token-1");
  });
});

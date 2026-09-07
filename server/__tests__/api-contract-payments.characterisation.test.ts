/**
 * CHARACTERISATION SUITE - payments and webhooks.
 *
 * Split out of api-contract.characterisation.test.ts, which had grown past the
 * 500-line ceiling. Same rig, same rules: this locks in CURRENT behaviour of
 * API-32..API-36, quirks included, and a failure means behaviour changed.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

// The rig installs every module mock, so it must be imported before anything
// below it pulls in server/app.ts.
import { admin, asUser, NEON_USER, stripeMock, verify } from "./helpers/apiContractRig";
import { app, ready } from "../app";
import { storage } from "../storage";
import { calculateRefundCents } from "../../packages/scoring/src/refund";
import { scoreAggregation } from "../lib/scoreAggregation";
import { webauthnService } from "../webauthn";

beforeAll(async () => {
  await ready;
});

beforeEach(() => {
  vi.clearAllMocks();
  admin.mockReturnValue(null);
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

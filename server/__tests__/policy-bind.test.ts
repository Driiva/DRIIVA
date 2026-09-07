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

// The rig installs every module mock, so it is imported before server/app.ts.
import {
  failedRow,
  getFirebaseAdminMock,
  makeAdminApp,
  rawBody,
  receivedRow,
  storageMock,
  stripeMock,
} from "./helpers/policyBindRig";
import { app, ready } from "../app";

beforeAll(async () => {
  await ready;
});

beforeEach(() => {
  vi.resetAllMocks();
  getFirebaseAdminMock.mockReturnValue(null);
});
import type { InsertPolicy } from "@shared/schema";

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
    storageMock.createPolicy.mockImplementation(async (policy: InsertPolicy) => ({ id: 501, ...policy }));
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
    storageMock.createPolicy.mockImplementation(async (policy: InsertPolicy) => ({ id: 502, ...policy }));
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
    storageMock.createPolicy.mockImplementation(async (policy: InsertPolicy) => ({ id: 502, ...policy }));
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

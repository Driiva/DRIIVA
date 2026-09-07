/**
 * POLICY BIND: the Firestore mirror and the concurrent-delivery race.
 *
 * Split out of server/__tests__/policy-bind.test.ts, which had grown past the
 * 500-line ceiling. Same rig, same rules: these lock in CURRENT behaviour of
 * the C2 and I3b fixes, and a failure means behaviour changed.
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
    storageMock.createPolicy.mockImplementation(async (policy: InsertPolicy) => ({ id: 601, ...policy }));
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

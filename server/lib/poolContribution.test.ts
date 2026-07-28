/**
 * Unit tests for the pool-contribution seam itself (M4 review fix I5).
 *
 * server/__tests__/pool-contribution.test.ts already covers the
 * webhook-integration path (emitPoolContribution called exactly once per
 * successful payment, with the Stripe event id threaded through). This file
 * covers emitPoolContribution's own defensive contract directly: by the time
 * handleStripePaymentSucceeded calls it, amountPaidCents has already been
 * validated upstream (C1's amount guard), so the "missing amount" case is no
 * longer reachable via the webhook integration test - but emitPoolContribution
 * is an exported, reusable seam that a future caller could invoke without that
 * upstream guard, so its own refusal-to-emit-a-zero-value-contribution
 * behaviour needs to be verified independently.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { emitPoolContribution, type PoolContributionEvent } from "./poolContribution";

describe("emitPoolContribution", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  const baseEvent: PoolContributionEvent = {
    userId: 7,
    policyId: 42,
    amountCents: 4599,
    source: "stripe_payment_succeeded",
    eventId: "evt_test_1",
    timestamp: new Date("2026-07-28T00:00:00.000Z"),
  };

  it("logs the event, including the eventId, when amountCents is valid", () => {
    emitPoolContribution(baseEvent);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][1]).toMatchObject({
      userId: 7,
      policyId: 42,
      amountCents: 4599,
      eventId: "evt_test_1",
      source: "stripe_payment_succeeded",
    });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["NaN", NaN],
    ["zero", 0],
    ["negative", -100],
    ["Infinity", Infinity],
  ])("refuses to emit (loud log, no silent zero-default) when amountCents is %s", (_label, badAmount) => {
    emitPoolContribution({ ...baseEvent, amountCents: badAmount as unknown as number });

    // Never logs the "event emitted" success line for an invalid amount.
    expect(logSpy).not.toHaveBeenCalled();
    // Logs loudly instead of silently defaulting to 0.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("refusing to emit");
    expect(errorSpy.mock.calls[0][1]).toMatchObject({
      userId: 7,
      policyId: 42,
      eventId: "evt_test_1",
    });
  });

  it("never throws for an invalid amount - this seam must not fail the payment flow it's attached to", () => {
    expect(() => emitPoolContribution({ ...baseEvent, amountCents: undefined as unknown as number })).not.toThrow();
  });

  it("carries the eventId through so a future consumer can dedupe a double-emit by it", () => {
    emitPoolContribution({ ...baseEvent, eventId: "evt_dedupe_me" });
    expect(logSpy.mock.calls[0][1]).toMatchObject({ eventId: "evt_dedupe_me" });
  });

  it("still logs (with eventId undefined) when no eventId is supplied - the field is optional, not required", () => {
    const { eventId, ...rest } = baseEvent;
    emitPoolContribution(rest);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][1]).toMatchObject({ eventId: undefined });
  });
});

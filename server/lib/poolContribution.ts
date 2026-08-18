/**
 * Pool-contribution seam (M4 Task 4).
 *
 * M3 (the pool module, blocked on D6 per m4-grounding.md section 4) doesn't
 * exist yet, so this is deliberately a log/no-op today - NOT a real ledger
 * write. It exists so the payment-success path already emits a well-shaped
 * event the moment M3 lands, instead of M3 having to go back and instrument
 * every successful-payment call site.
 *
 * Do not build M3 here. Do not block the webhook handler on this call -
 * emitPoolContribution() must never throw in a way that fails the payment
 * flow it's attached to.
 */

export type PoolContributionSource = "stripe_payment_succeeded";

export interface PoolContributionEvent {
  userId: string | number;
  policyId: string | number;
  tripId?: string | number;
  amountCents: number;
  source: PoolContributionSource;
  /**
   * The Stripe event id (or invoice id) that produced this contribution (M4
   * review fix I5). emitPoolContribution can legitimately fire twice for one
   * real payment today: if markStripeEventProcessed fails after the webhook
   * switch case completes, Stripe redelivers, the switch re-runs, the policy
   * transition hits the active -> active benign no-op path (correct for
   * policy state), but this seam still gets called again - double-counting
   * the contribution. There's no way to fully prevent that double-emit here
   * without a deeper rearchitecture, so this field exists so the eventual M3
   * consumer can dedupe by it instead of double-crediting the pool. Optional
   * only because this seam has no other callers today; always pass it from a
   * Stripe-originated call site.
   */
  eventId?: string;
  timestamp: Date;
}

/**
 * Emit a pool-contribution event for a successful payment. Today this only
 * logs - there is no M3 ledger to write to. Swallows its own errors so a
 * logging failure can never turn a successful payment into a failed webhook.
 *
 * Refuses (loud log, no throw) to emit when amountCents is missing/invalid
 * (M4 review fix I5) - previously `amountCents: amountPaidCents ?? 0` at the
 * call site silently emitted a zero-value contribution whenever
 * invoice.amount_paid was absent. A missing amount is a real data problem
 * worth surfacing, not a value to default away, but this seam must still
 * never throw in a way that fails the payment flow it's attached to.
 */
export function emitPoolContribution(event: PoolContributionEvent): void {
  if (
    event.amountCents === undefined ||
    event.amountCents === null ||
    !Number.isFinite(event.amountCents) ||
    event.amountCents <= 0
  ) {
    console.error("[PoolContribution] refusing to emit: missing/invalid amountCents", {
      userId: event.userId,
      policyId: event.policyId,
      eventId: event.eventId,
      amountCents: event.amountCents,
      source: event.source,
    });
    return;
  }
  try {
    console.log("[PoolContribution] event emitted (M3 not live - log-only)", {
      userId: event.userId,
      policyId: event.policyId,
      tripId: event.tripId,
      amountCents: event.amountCents,
      source: event.source,
      eventId: event.eventId,
      timestamp: event.timestamp.toISOString(),
    });
  } catch (err) {
    console.error("[PoolContribution] failed to log event:", err);
  }
}

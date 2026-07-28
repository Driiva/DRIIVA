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
  timestamp: Date;
}

/**
 * Emit a pool-contribution event for a successful payment. Today this only
 * logs - there is no M3 ledger to write to. Swallows its own errors so a
 * logging failure can never turn a successful payment into a failed webhook.
 */
export function emitPoolContribution(event: PoolContributionEvent): void {
  try {
    console.log("[PoolContribution] event emitted (M3 not live - log-only)", {
      userId: event.userId,
      policyId: event.policyId,
      tripId: event.tripId,
      amountCents: event.amountCents,
      source: event.source,
      timestamp: event.timestamp.toISOString(),
    });
  } catch (err) {
    console.error("[PoolContribution] failed to log event:", err);
  }
}

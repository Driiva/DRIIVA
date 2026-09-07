/**
 * Inbound webhooks: Stripe (payments) and Root (policy status).
 *
 * Both paths receive a raw Buffer body (app.ts registers express.raw for them
 * ahead of express.json) so the signature can be verified over the exact bytes
 * sent. Neither is behind Firebase auth; the signature is the credential.
 *
 * The Stripe handler processes BEFORE acknowledging and returns 5xx on any
 * failed critical side effect so Stripe redelivers; the policy bind itself
 * lives in server/lib/stripePaymentSucceeded.ts.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { webhookLimiter } from "../middleware/security";
import { getStripe, getStripeWebhookSecret } from "../lib/stripe";
import { transitionPolicy, InvalidPolicyTransitionError } from "../lib/policyLifecycle";
import { handleStripePaymentSucceeded, resolveSubscriptionBillingPeriod } from "../lib/stripePaymentSucceeded";

export function registerWebhookRoutes(app: Express): void {
  /**
   * Stripe webhook endpoint.
   * Raw body is required for signature verification (app.ts registers express.raw for this path).
   * Events handled:
   *   invoice.payment_succeeded      -> write a Firestore pendingPayment so the app /
   *                                    Root binds cover (the money-in / cover path).
   *   invoice.payment_failed         -> resolve the user, persist a past_due flag on
   *                                    the bound policy (reuses policies.status -
   *                                    no new column) + structured warn.
   *   customer.subscription.deleted  -> resolve the user, transition the bound policy
   *                                    to cancelled (reuses policies.status). Direct
   *                                    transition is a stopgap: route through the
   *                                    Task 3/4 policy lifecycle state machine once
   *                                    it lands on this branch.
   *   checkout.session.completed     -> session -> entitlement lookup -> grant. No
   *                                    product/entitlement catalog exists yet, so
   *                                    this path is wired but grants nothing - an
   *                                    explicit structured no-op log, not a silent
   *                                    skip.
   *
   * Idempotency + audit: every event with an `id` gets a `stripe_events` row
   * (status received) written before processing, same side of the ACK boundary as
   * the switch below - see the comment ahead of the try block for why. A duplicate
   * delivery of an event already marked `processed` short-circuits: ack 200 without
   * re-running the switch. A duplicate of an event still `received` or `failed` is
   * NOT skipped - it re-enters the switch so Stripe's redelivery-on-non-2xx keeps
   * working for events whose side effects never actually completed.
   */
  app.post("/api/webhooks/stripe", webhookLimiter, async (req, res) => {
    let event: any;
    try {
      const stripe = getStripe();
      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = getStripeWebhookSecret();
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Stripe webhook] Signature verification failed:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    // Idempotency + audit: write/record the event BEFORE processing, still before the
    // ACK. A lookup/write failure here is not fatal to the request (no event.id is a
    // legitimate case for malformed/test payloads) - it degrades to "process without
    // a dedupe guarantee" rather than blocking the critical side effects below.
    //
    // I3a fix: storage.createStripeEvent is now the atomic dedupe primitive
    // (INSERT ... ON CONFLICT DO UPDATE ... RETURNING - see server/storage.ts)
    // instead of a read-then-conditional-insert. It always returns the
    // authoritative row - freshly inserted, or the pre-existing row on
    // conflict - in one round trip, closing the old TOCTOU window where two
    // concurrent deliveries of a brand-new event.id could both see "no
    // existing row" and both proceed to process. A row already marked
    // `processed` short-circuits (ack 200, no reprocessing); a row still
    // `received` or `failed` is NOT skipped - it re-enters the switch so
    // Stripe's redelivery-on-non-2xx keeps working for events whose side
    // effects never actually completed (unchanged contract from before).
    if (event.id) {
      try {
        const eventRow = await storage.createStripeEvent({ id: event.id, type: event.type, payload: event });
        if (eventRow.status === 'processed') {
          console.log(`[Stripe webhook] Duplicate event ${event.id} already processed - skipping`);
          return res.json({ received: true });
        }
      } catch (auditErr) {
        console.warn('[Stripe webhook] stripe_events dedupe write failed - proceeding without dedupe:', auditErr);
      }
    }

    // Process BEFORE acknowledging. A payment that binds a policy is a critical
    // side effect: if it throws we must return a non-2xx so Stripe redelivers the
    // event. ACKing first (200) and processing async means a failed bind - Firestore
    // down, Admin not initialised, transient Root error - is dropped forever with no
    // retry, leaving a charged customer with no cover (money-in / no-cover).
    try {
      switch (event.type) {
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;
          const subscriptionId = invoice.subscription as string;
          console.log(`[Stripe webhook] Payment succeeded for customer ${customerId}`);

          // Retrieve the subscription for quoteId + the real billing
          // interval/period-end (C1 fix: a bound policy must reflect what was
          // actually charged and the actual Stripe subscription terms, not a
          // fabricated 0/'standard'/now+1-year default - see
          // handleStripePaymentSucceeded in lib/stripePaymentSucceeded.ts).
          let quoteId: string | undefined;
          let billingPeriod: 'monthly' | 'annual' = 'monthly';
          let currentPeriodEndUnix: number | undefined;
          try {
            const stripe = getStripe();
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            quoteId = sub.metadata?.quoteId;
            billingPeriod = resolveSubscriptionBillingPeriod(sub);
            // Stripe API version pinned in server/lib/stripe.ts (2025-01-27.acacia) still
            // carries current_period_end on the subscription root; it only moved onto
            // subscription items in the 2025-03-31.basil release. stripe-node's TypeScript
            // types reflect the newer (Basil) shape regardless of the pinned API version, so
            // this must check the root field first or it silently falls back on every bind.
            const subRootPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
            const firstItem = sub.items?.data?.[0];
            currentPeriodEndUnix = typeof subRootPeriodEnd === 'number'
              ? subRootPeriodEnd
              : (typeof firstItem?.current_period_end === 'number' ? firstItem.current_period_end : undefined);
          } catch (subErr) {
            console.warn('[Stripe webhook] Could not retrieve subscription metadata:', subErr);
          }

          await handleStripePaymentSucceeded(
            customerId,
            subscriptionId,
            quoteId,
            event.id,
            invoice.amount_paid,
            billingPeriod,
            currentPeriodEndUnix,
          );
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;
          // Resolve the user for an actionable log. Guard the lookup: this branch has
          // no critical side effect, so a transient DB failure must not bubble up and
          // trigger a 500 + Stripe retry storm for a logging-only event.
          let driivUserId: number | undefined;
          let firebaseUid: string | undefined;
          try {
            const user = await storage.getUserByStripeCustomerId(customerId);
            driivUserId = user?.id;
            firebaseUid = user?.firebaseUid ?? undefined;
          } catch (lookupErr) {
            console.warn('[Stripe webhook] payment_failed user lookup failed:', lookupErr);
          }
          console.warn(`[Stripe webhook] Payment FAILED for customer ${customerId}`, {
            invoiceId: invoice.id,
            subscriptionId: invoice.subscription,
            attemptCount: invoice.attempt_count,
            driivUserId,
            firebaseUid,
          });
          // Persist past_due against the bound policy via the M4 Task 3 policy
          // lifecycle state machine (server/lib/policyLifecycle.ts), not a raw
          // status write - so the transition is validated and audited like every
          // other status change. This IS a critical side effect: if the write
          // fails we rethrow so the outer catch 500s and Stripe redelivers,
          // rather than silently dropping a past_due transition.
          const failedSubscriptionId = invoice.subscription as string | undefined;
          if (failedSubscriptionId) {
            try {
              const policy = await storage.getPolicyByStripeSubscriptionId(failedSubscriptionId);
              if (policy) {
                try {
                  await transitionPolicy({ policy, toStatus: 'past_due', causedBy: `stripe:${event.id}` });
                  console.log(`[Stripe webhook] Policy ${policy.id} marked past_due`);
                } catch (transitionErr) {
                  // A policy that's cancelled or lapsed has no valid transition to
                  // past_due (cancelled is terminal; lapsed only goes to
                  // active/cancelled) - a redelivered or late payment_failed event
                  // against such a policy is a benign no-op, not a webhook failure.
                  // Any other rejection is a real problem and must still fail the
                  // webhook.
                  if (transitionErr instanceof InvalidPolicyTransitionError) {
                    console.log(`[Stripe webhook] Policy ${policy.id} cannot move to past_due from ${transitionErr.from} - skipping`, {
                      attempted: `${transitionErr.from} -> ${transitionErr.to}`,
                    });
                  } else {
                    throw transitionErr;
                  }
                }
              } else {
                console.warn(`[Stripe webhook] No policy bound to subscription ${failedSubscriptionId} - cannot persist past_due`);
              }
            } catch (policyErr) {
              console.error('[Stripe webhook] Failed to persist past_due flag:', policyErr);
              throw policyErr;
            }
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const customerId = sub.customer as string;
          let driivUserId: number | undefined;
          let firebaseUid: string | undefined;
          try {
            const user = await storage.getUserByStripeCustomerId(customerId);
            driivUserId = user?.id;
            firebaseUid = user?.firebaseUid ?? undefined;
          } catch (lookupErr) {
            console.warn('[Stripe webhook] subscription.deleted user lookup failed:', lookupErr);
          }
          console.warn(`[Stripe webhook] Subscription deleted: ${sub.id}`, {
            customerId,
            driivUserId,
            firebaseUid,
          });
          // Transition the bound policy to cancelled via the M4 Task 3 policy
          // lifecycle state machine (server/lib/policyLifecycle.ts).
          try {
            const policy = await storage.getPolicyByStripeSubscriptionId(sub.id as string);
            if (policy) {
              try {
                await transitionPolicy({ policy, toStatus: 'cancelled', causedBy: `stripe:${event.id}` });
                console.log(`[Stripe webhook] Policy ${policy.id} cancelled`);
              } catch (transitionErr) {
                // Stripe can and does redeliver subscription.deleted (retries,
                // duplicate webhook endpoints, etc). A policy that's already
                // cancelled has no valid outgoing transition (cancelled is
                // terminal), so a redelivery lands here as a rejected
                // transition - treat that specific case as a benign no-op, not
                // a webhook failure. Any other rejection (or non-transition
                // error) is a real problem and must still fail the webhook.
                if (
                  transitionErr instanceof InvalidPolicyTransitionError &&
                  transitionErr.from === 'cancelled'
                ) {
                  console.log(`[Stripe webhook] Policy ${policy.id} already cancelled - skipping redundant transition`);
                } else {
                  throw transitionErr;
                }
              }
            } else {
              console.warn(`[Stripe webhook] No policy bound to subscription ${sub.id} - cannot cancel`);
            }
          } catch (policyErr) {
            console.error('[Stripe webhook] Failed to cancel policy:', policyErr);
            throw policyErr;
          }
          break;
        }
        case 'checkout.session.completed': {
          const session = event.data.object;
          console.log(`[Stripe webhook] Checkout completed: ${session.id}`, {
            customerId: session.customer ?? undefined,
            firebaseUid: session.metadata?.firebaseUid,
            mode: session.mode,
            amountTotal: session.amount_total,
          });
          // Session -> entitlement lookup -> grant. No product/entitlement catalog
          // exists anywhere in this codebase yet (grepped shared/schema.ts,
          // server/storage.ts, client/src for "entitlement"/"addon"/"add-on" - zero
          // hits), so this path is real and wired but currently grants nothing.
          // Explicit structured no-op, not a silent skip, so ops can see fulfilment
          // was considered and deliberately deferred.
          console.log('[Stripe webhook] checkout.session.completed: no entitlement catalog defined yet - granting nothing', {
            sessionId: session.id,
            customerId: session.customer ?? undefined,
          });
          break;
        }
        default:
          // Unhandled event type - ignore silently
      }
      // All handled (or intentionally ignored) without throwing -> acknowledge.
      // Mark the audit row processed. A failure to mark it is not re-thrown: the
      // critical side effects above already succeeded, and rethrowing here would
      // turn an audit-only write failure into a spurious Stripe retry that reruns
      // side effects that already landed. The row simply stays "received" and a
      // genuine retry will re-attempt (safe: reprocessing is idempotent per handler).
      if (event.id) {
        try {
          await storage.markStripeEventProcessed(event.id);
        } catch (markErr) {
          console.warn('[Stripe webhook] Could not mark stripe_events processed:', markErr);
        }
      }
      res.json({ received: true });
    } catch (err) {
      // Do NOT swallow: a 5xx tells Stripe to redeliver so the side effect retries.
      console.error("[Stripe webhook] Handler error, returning 500 for Stripe retry:", err);
      if (event?.id) {
        try {
          await storage.markStripeEventFailed(event.id);
        } catch (markErr) {
          console.warn('[Stripe webhook] Could not mark stripe_events failed:', markErr);
        }
      }
      res.status(500).json({ message: "Webhook handler failed; will be retried" });
    }
  });

  // -------------------------------------------------------------------------
  // ROOT PLATFORM WEBHOOK
  // Root pushes async policy status updates here.
  // -------------------------------------------------------------------------
  app.post("/api/webhooks/root", webhookLimiter, async (req, res) => {
    // Root signs webhooks with HMAC-SHA256; verify if ROOT_WEBHOOK_SECRET is set.
    const rootSecret = process.env.ROOT_WEBHOOK_SECRET;
    if (rootSecret) {
      const crypto = await import('crypto');
      const sig = req.headers['x-root-signature'] as string | undefined;
      if (!sig) return res.status(400).json({ message: "Missing Root webhook signature" });
      const expected = crypto.default
        .createHmac('sha256', rootSecret)
        .update(req.body as Buffer)
        .digest('hex');
      if (!sig || !crypto.default.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(400).json({ message: "Invalid Root webhook signature" });
    }

    res.json({ received: true });

    try {
      const body = JSON.parse((req.body as Buffer).toString('utf8'));
      const eventType: string = body.event_type || body.type || '';
      const policyId: string = body.policy_id || body.data?.policy_id || '';
      console.log(`[Root webhook] Event: ${eventType}, policy: ${policyId}`);

      // Additional Root webhook handling would be wired here when Root sandbox creds
      // are available to confirm the exact payload shape.
    } catch (err) {
      console.error("[Root webhook] Handler error:", err);
    }
  });
}

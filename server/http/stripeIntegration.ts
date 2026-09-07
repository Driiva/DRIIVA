/**
 * Stripe → Root integration glue, called from the Stripe webhook handler.
 * Extracted verbatim from server/routes.ts.
 */
import { storage } from "../storage";
import { type Policy } from "@shared/schema";
import { transitionPolicy, createPolicyWithAudit, InvalidPolicyTransitionError } from "../lib/policyLifecycle";
import { emitPoolContribution } from "../lib/poolContribution";

/**
 * The subscription fields resolveSubscriptionBillingPeriod reads. Declared
 * structurally rather than as Stripe.Subscription because the pinned API
 * version (2025-01-27.acacia) still carries `plan` on the item, which
 * stripe-node's current types no longer describe.
 */
export interface BillingPeriodSource {
  metadata?: { billingPeriod?: string } | null;
  items?: {
    data?: Array<{
      plan?: { interval?: string } | null;
      price?: { recurring?: { interval?: string } | null } | null;
    }>;
  } | null;
}

export async function handleStripePaymentSucceeded(
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  quoteId: string | undefined,
  stripeEventId: string | undefined,
  amountPaidCents: number | undefined,
  billingPeriod: 'monthly' | 'annual' = 'monthly',
  currentPeriodEndUnix?: number,
): Promise<void> {
  const user = await storage.getUserByStripeCustomerId(stripeCustomerId);
  if (!user) {
    console.warn(`[Integration] No user found for Stripe customer ${stripeCustomerId}`);
    return;
  }

  // C1 fix: a policy bound off this payment must carry the premium that was
  // actually charged. A missing/zero/non-finite amount_paid means we cannot
  // honestly populate basePremiumCents/currentPremiumCents (or, downstream,
  // the pool-contribution amount) - fail loudly so Stripe redelivers, rather
  // than silently writing a zero-premium "active" policy for cover the
  // customer was supposedly charged for.
  if (
    amountPaidCents === undefined ||
    amountPaidCents === null ||
    !Number.isFinite(amountPaidCents) ||
    amountPaidCents <= 0
  ) {
    throw new Error(
      `[Integration] invoice.payment_succeeded for subscription ${stripeSubscriptionId} has no valid amount_paid (${amountPaidCents}) - refusing to bind/transition a policy without a real premium`,
    );
  }

  // Policy lifecycle (M4 Task 3): create or transition the Postgres policy row
  // through the state machine. This is the real policy-bind step - it replaces
  // the client-only flag flip that checkout.tsx used to do on payment success,
  // and it's a critical side effect (rethrow on failure so Stripe redelivers),
  // unlike the Firestore pendingPayment write below which stays best-effort.
  const causedBy = stripeEventId ? `stripe:${stripeEventId}` : `stripe:sub:${stripeSubscriptionId}`;
  let boundPolicyId: string | number | undefined;
  try {
    const existingPolicy = await storage.getPolicyByStripeSubscriptionId(stripeSubscriptionId);
    if (existingPolicy) {
      boundPolicyId = existingPolicy.id;
      await transitionExistingPolicyToActive(existingPolicy, causedBy);
    } else {
      // C1 fix: real premium from what Stripe actually charged, a
      // best-effort real coverageType from the stored quote, and a real
      // expiration/billing-cycle derived from the actual Stripe subscription
      // terms - not the previous hardcoded 0 / 'standard' / now+1-year
      // fabrication.
      const coverageType = await resolveCoverageTypeFromQuote(quoteId);
      const now = new Date();
      const expiration = currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000)
        : computeFallbackExpiration(now, billingPeriod, stripeSubscriptionId);

      try {
        const { policy } = await createPolicyWithAudit({
          policy: {
            userId: user.id,
            policyNumber: `POL-${stripeSubscriptionId}`,
            status: 'active',
            coverageType,
            basePremiumCents: amountPaidCents,
            currentPremiumCents: amountPaidCents,
            effectiveDate: now,
            expirationDate: expiration,
            billingCycle: billingPeriod,
            stripeSubscriptionId,
          },
          causedBy,
        });
        boundPolicyId = policy.id;
        console.log(`[Integration] Policy ${policy.id} created (active) for ${user.id}`, {
          basePremiumCents: amountPaidCents,
          billingCycle: billingPeriod,
          coverageType,
        });
      } catch (createErr) {
        // I3b fix: two concurrent first-payment deliveries for the same
        // subscription can both reach this branch (both observed no existing
        // policy via the read above). The unique constraint on
        // policies.stripe_subscription_id means only one INSERT wins; the
        // loser hits a 23505 unique violation here. Treat that as "policy
        // already exists" - fetch the winner's row and transition it instead
        // of creating a second active policy row for one subscription.
        if (isUniqueSubscriptionViolation(createErr)) {
          const racedPolicy = await storage.getPolicyByStripeSubscriptionId(stripeSubscriptionId);
          if (!racedPolicy) throw createErr; // genuinely unexpected - surface it
          boundPolicyId = racedPolicy.id;
          await transitionExistingPolicyToActive(racedPolicy, causedBy);
        } else {
          throw createErr;
        }
      }
    }
  } catch (policyErr) {
    console.error('[Integration] Failed to create/transition policy:', policyErr);
    throw policyErr;
  }

  // Pool-contribution seam (M4 Task 4): emit exactly once per successful
  // payment, after the policy bind/transition above has succeeded (including
  // the benign already-active no-op - money was still received). M3 doesn't
  // exist yet, so this only logs today - see server/lib/poolContribution.ts.
  // eventId is threaded through (I5 fix) so a future M3 consumer can dedupe a
  // double-emit caused by a retried delivery (see poolContribution.ts docs).
  if (boundPolicyId) {
    emitPoolContribution({
      userId: user.id,
      policyId: boundPolicyId,
      amountCents: amountPaidCents,
      source: 'stripe_payment_succeeded',
      eventId: stripeEventId,
      timestamp: new Date(),
    });
  }

  if (!user.firebaseUid) {
    console.warn(`[Integration] User ${user.id} has no firebaseUid - skipping Firestore pendingPayment write`);
    return;
  }

  // C2 fix: this Firestore write used to be wrapped in a try/catch that only
  // console.error'd the failure. By the time we reach here the Postgres
  // policy is already 'active' and audited - a swallowed failure would leave
  // a charged customer with an active DB policy but no Firestore mirror, ack
  // the webhook 200, and mark the stripe_events row processed, so Stripe's
  // redelivery-on-non-2xx would never fire and the gap would never be
  // retried (exactly the "charged customer, no cover" scenario the webhook
  // redesign exists to prevent). Rethrow instead: the outer webhook handler
  // 500s, Stripe redelivers, and the retry is safe because the policy bind
  // above hits the active -> active benign no-op path
  // (transitionExistingPolicyToActive) rather than re-creating anything -
  // only this Firestore write is actually retried.
  try {
    console.log(`[Integration] Payment succeeded for ${user.firebaseUid} - writing pendingPayment`, { quoteId });

    const adminLib = await import('../lib/firebase-admin');
    const adminApp = adminLib.getFirebaseAdmin();
    if (!adminApp) {
      console.warn('[Integration] Firebase Admin not initialised - cannot write pendingPayment');
      return;
    }

    // firebase-admin 14 dropped the `firestore` namespace re-export this line
    // used to destructure; the modular subpath exposes the same FieldValue.
    const { FieldValue } = await import('firebase-admin/firestore');
    const doc: Record<string, unknown> = {
      stripeSubscriptionId,
      stripeCustomerId,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    };
    if (quoteId) doc.quoteId = quoteId;

    await adminApp.firestore()
      .collection('users')
      .doc(user.firebaseUid)
      .collection('pendingPayments')
      .doc(stripeSubscriptionId)
      .set(doc);

    console.log(`[Integration] pendingPayment written for ${user.firebaseUid}`);
  } catch (err) {
    console.error("[Integration] handleStripePaymentSucceeded pendingPayment write failed - rethrowing so Stripe retries:", err);
    throw err;
  }
}

/**
 * Transition an existing policy to 'active' on payment success, treating the
 * active -> active case as a benign no-op: a redelivered event, a renewal
 * invoice on a still-active policy, or (after the C2/I3b fixes) a retry that
 * reaches handleStripePaymentSucceeded a second time after the first attempt
 * already bound the policy but failed later (e.g. at the Firestore write).
 * Any other rejected transition (e.g. cancelled -> active) is a genuine
 * reconciliation signal and is rethrown so the webhook still errors.
 */
async function transitionExistingPolicyToActive(policy: Policy, causedBy: string): Promise<Policy> {
  try {
    const { policy: updated } = await transitionPolicy({ policy, toStatus: 'active', causedBy });
    console.log(`[Integration] Policy ${updated.id} transitioned to active`);
    return updated;
  } catch (transitionErr) {
    if (
      transitionErr instanceof InvalidPolicyTransitionError &&
      transitionErr.from === 'active' &&
      transitionErr.to === 'active'
    ) {
      console.log(`[Integration] Policy ${policy.id} already ${policy.status} - no transition needed`, {
        attempted: `${transitionErr.from} -> ${transitionErr.to}`,
      });
      return policy;
    }
    throw transitionErr;
  }
}

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

/** Detects the policies.stripe_subscription_id unique-constraint violation (I3b). */
function isUniqueSubscriptionViolation(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  const message = err instanceof Error ? err.message : String(err ?? '');
  return code === POSTGRES_UNIQUE_VIOLATION_CODE && /stripe_subscription_id/i.test(message);
}

/**
 * Best-effort coverageType resolution from the Firestore quote doc
 * (functions/src/http/insurance.ts's getInsuranceQuote writes coverageType
 * there when a quote is generated). Not a critical side effect like the
 * premium amount (the amount guard above already fails loudly for that) - if
 * the quote can't be resolved (no quoteId, Admin not initialised, quote
 * missing/expired), default to 'standard' rather than blocking the policy
 * bind on a best-effort lookup.
 */
async function resolveCoverageTypeFromQuote(quoteId: string | undefined): Promise<string> {
  if (!quoteId) return 'standard';
  try {
    const adminLib = await import('../lib/firebase-admin');
    const adminApp = adminLib.getFirebaseAdmin();
    if (!adminApp) return 'standard';
    const quoteSnap = await adminApp.firestore().collection('quotes').doc(quoteId).get();
    if (!quoteSnap.exists) return 'standard';
    const data = quoteSnap.data() as { coverageType?: string } | undefined;
    return data?.coverageType ?? 'standard';
  } catch (err) {
    console.warn(`[Integration] Could not resolve coverageType from quote ${quoteId} - defaulting to standard:`, err);
    return 'standard';
  }
}

/**
 * Fallback expiration when Stripe's per-item current_period_end isn't
 * available (e.g. the subscriptions.retrieve call itself failed). Derives the
 * term from the actual billing period rather than assuming annual (C1 fix).
 */
function computeFallbackExpiration(from: Date, billingPeriod: 'monthly' | 'annual', stripeSubscriptionId: string): Date {
  console.warn(`[Integration] Stripe subscription ${stripeSubscriptionId} current_period_end unavailable - falling back to a computed ${billingPeriod} expiration`);
  const expiration = new Date(from);
  if (billingPeriod === 'annual') {
    expiration.setFullYear(expiration.getFullYear() + 1);
  } else {
    expiration.setMonth(expiration.getMonth() + 1);
  }
  return expiration;
}

/**
 * Resolve monthly vs annual from the Stripe subscription itself (C1 fix).
 * Prefers the billingPeriod set in subscription metadata at creation time
 * (create-subscription always sets it - see routes.ts ~916), falling back to
 * the actual Price/Plan recurring interval for subscriptions created without
 * that metadata (e.g. pre-M4 data). Defaults to 'monthly' - the shorter,
 * less-overcharging assumption - only when neither source is available.
 */
export function resolveSubscriptionBillingPeriod(sub: BillingPeriodSource | null | undefined): 'monthly' | 'annual' {
  if (sub?.metadata?.billingPeriod === 'annual') return 'annual';
  if (sub?.metadata?.billingPeriod === 'monthly') return 'monthly';
  const interval = sub?.items?.data?.[0]?.plan?.interval ?? sub?.items?.data?.[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'annual' : 'monthly';
}

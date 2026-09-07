/**
 * Payment routes: Stripe subscription creation, one-off checkout sessions and
 * the customer billing portal.
 *
 * Any Stripe Price a client names must be on the server-side allow-list; the
 * premium itself is computed server-side and passed as inline price_data, so
 * a request body can never pick a cheaper price than the one we intend to charge.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { getStripe, stripeIdempotencyKey } from "../lib/stripe";

/**
 * Server-side allow-list of Stripe Price IDs a client may reference directly.
 * Without this a user could substitute a cheaper Stripe Price in create-subscription's
 * legacy branch or in create-checkout. The list is sourced from server env only,
 * never from the request body. STRIPE_MONTHLY_PRICE_ID is always included when set;
 * STRIPE_ALLOWED_PRICE_IDS is an optional comma-separated list for any additional
 * prices (e.g. one-off add-on Prices used by create-checkout).
 */
function allowedStripePriceIds(): Set<string> {
  const ids = new Set<string>();
  const monthly = process.env.STRIPE_MONTHLY_PRICE_ID;
  if (monthly) ids.add(monthly);
  const extra = process.env.STRIPE_ALLOWED_PRICE_IDS;
  if (extra) {
    for (const id of extra.split(',').map(s => s.trim()).filter(Boolean)) {
      ids.add(id);
    }
  }
  return ids;
}

export function registerPaymentRoutes(app: Express): void {
  /**
   * Create (or retrieve) a Stripe Customer + Subscription.
   * Uses inline price_data so each user pays their individually-computed premium.
   *
   * Body:
   *   annualPremiumCents  - annual premium in pence (from client pricingEngine x 100)
   *   billingPeriod       - 'monthly' | 'annual'
   *   quoteId?            - Root Platform quoteId stored in subscription metadata
   *
   * If annualPremiumCents is missing, falls back to STRIPE_MONTHLY_PRICE_ID for
   * backwards compatibility with older clients.
   */
  app.post("/api/payments/create-subscription", requireAuth, async (req: AuthRequest, res) => {
    try {
      const stripe = getStripe();
      const uid = req.auth!.uid;
      const user = await storage.getUserByFirebaseUid(uid);
      if (!user) return res.status(404).json({ message: "User not found" });

      const quoteId: string | undefined = req.body.quoteId;
      const billingPeriod: 'monthly' | 'annual' = req.body.billingPeriod === 'annual' ? 'annual' : 'monthly';
      const annualPremiumCents: number | undefined = req.body.annualPremiumCents
        ? Number(req.body.annualPremiumCents)
        : undefined;

      // Validate annualPremiumCents when provided
      if (annualPremiumCents !== undefined) {
        if (!Number.isFinite(annualPremiumCents) || annualPremiumCents < 10000 || annualPremiumCents > 500000) {
          return res.status(400).json({ message: "annualPremiumCents must be between 10000 and 500000" });
        }
      }

      // Upsert Stripe customer
      let customerId = user.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          metadata: { firebaseUid: uid, driivUserId: String(user.id) },
        }, { idempotencyKey: stripeIdempotencyKey(uid, 'customer-create') });
        customerId = customer.id;
        await storage.updateStripeCustomerId(user.id, customerId);
      }

      // Build subscription metadata
      const subscriptionMeta: Record<string, string> = { firebaseUid: uid, billingPeriod };
      if (quoteId) subscriptionMeta.quoteId = quoteId;

      // Build subscription item: use price_data if we have a computed premium,
      // otherwise fall back to the pre-created monthly Price ID.
      let subscriptionItem: any;
      const productId = process.env.STRIPE_PRODUCT_ID;

      if (annualPremiumCents !== undefined && productId) {
        const unitAmount = billingPeriod === 'annual'
          ? annualPremiumCents
          : Math.round(annualPremiumCents / 12 * 1.07);

        subscriptionItem = {
          price_data: {
            currency: 'gbp',
            product: productId,
            recurring: { interval: billingPeriod === 'annual' ? 'year' : 'month' },
            unit_amount: unitAmount,
          },
        };
        subscriptionMeta.annualPremiumCents = String(annualPremiumCents);
      } else {
        // Legacy fallback: use the pre-created monthly Price ID. If the client
        // supplies a priceId it MUST be in the server allow-list, otherwise a user
        // could substitute a cheaper Stripe Price than the one we intend to charge.
        const requestedPriceId: string | undefined = req.body.priceId;
        if (requestedPriceId && !allowedStripePriceIds().has(requestedPriceId)) {
          return res.status(400).json({ message: "Invalid priceId" });
        }
        const priceId = requestedPriceId || process.env.STRIPE_MONTHLY_PRICE_ID;
        if (!priceId) {
          return res.status(400).json({ message: "STRIPE_PRODUCT_ID or STRIPE_MONTHLY_PRICE_ID is required" });
        }
        subscriptionItem = { price: priceId };
      }

      const idempotencyKey = stripeIdempotencyKey(
        uid,
        `subscription-${billingPeriod}-${annualPremiumCents ?? 'fixed'}-${quoteId ?? 'none'}`,
      );

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [subscriptionItem],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: subscriptionMeta,
      }, { idempotencyKey });

      const invoice = subscription.latest_invoice as any;
      const paymentIntent = invoice?.payment_intent;

      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent?.client_secret ?? null,
        status: subscription.status,
      });
    } catch (error: any) {
      if (error.message?.includes('STRIPE_SECRET_KEY')) {
        return res.status(503).json({ message: "Stripe is not configured on this environment" });
      }
      console.error("[Stripe] create-subscription error:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  /**
   * Create a one-time Stripe Checkout Session (for add-ons / one-off payments).
   * Body: { priceId: string, successUrl?: string, cancelUrl?: string }
   */
  app.post("/api/payments/create-checkout", requireAuth, async (req: AuthRequest, res) => {
    try {
      const stripe = getStripe();
      const uid = req.auth!.uid;
      const { priceId, successUrl, cancelUrl } = req.body;
      if (!priceId) return res.status(400).json({ message: "priceId is required" });
      // Allow-list the priceId server-side: a client must not be able to check out
      // against an arbitrary (cheaper) Stripe Price. Configure one-off add-on Prices
      // via STRIPE_ALLOWED_PRICE_IDS.
      if (!allowedStripePriceIds().has(priceId)) {
        return res.status(400).json({ message: "Invalid priceId" });
      }

      const user = await storage.getUserByFirebaseUid(uid);
      if (!user) return res.status(404).json({ message: "User not found" });

      let customerId = user.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { firebaseUid: uid },
        });
        customerId = customer.id;
        await storage.updateStripeCustomerId(user.id, customerId);
      }

      const origin = req.headers.origin || process.env.WEBAUTHN_ORIGIN || 'http://localhost:5000';
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl || `${origin}/dashboard?checkout=success`,
        cancel_url: cancelUrl || `${origin}/checkout?checkout=cancelled`,
        metadata: { firebaseUid: uid },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      if (error.message?.includes('STRIPE_SECRET_KEY')) {
        return res.status(503).json({ message: "Stripe is not configured on this environment" });
      }
      console.error("[Stripe] create-checkout error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  /**
   * Return a Stripe Customer Portal link so users can manage their subscription.
   */
  app.get("/api/payments/billing-portal", requireAuth, async (req: AuthRequest, res) => {
    try {
      const stripe = getStripe();
      const uid = req.auth!.uid;
      const user = await storage.getUserByFirebaseUid(uid);
      if (!user?.stripeCustomerId) {
        return res.status(404).json({ message: "No billing account found" });
      }

      const origin = req.headers.origin || process.env.WEBAUTHN_ORIGIN || 'http://localhost:5000';
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${origin}/settings`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      if (error.message?.includes('STRIPE_SECRET_KEY')) {
        return res.status(503).json({ message: "Stripe is not configured on this environment" });
      }
      console.error("[Stripe] billing-portal error:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });
}

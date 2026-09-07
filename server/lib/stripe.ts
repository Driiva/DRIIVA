/**
 * Stripe client singleton.
 *
 * Initialised lazily so that the server starts without STRIPE_SECRET_KEY present
 * (dev/staging without Stripe configured). Any route that calls getStripe() will
 * throw a 503 if the key is missing, rather than crashing the process at boot.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY       – sk_test_... (staging) / sk_live_... (prod)
 *   STRIPE_WEBHOOK_SECRET   – whsec_... from `stripe listen` or Stripe dashboard
 */

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  // Pinned deliberately: stripe-node's types track the newest API version, but
  // this app is written against the fields 2025-01-27.acacia returns.
  _stripe = new Stripe(key, {
    apiVersion: '2025-01-27.acacia' as Stripe.StripeConfig['apiVersion'],
  });
  return _stripe;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  return secret;
}

/** Idempotency key for a Stripe operation — deterministic from userId + operation + date. */
export function stripeIdempotencyKey(userId: string, operation: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `driiva-${operation}-${userId}-${date}`;
}

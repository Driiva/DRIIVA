/**
 * Server-side allow-list of Stripe Price IDs a client may reference directly.
 * Without this a user could substitute a cheaper Stripe Price in create-subscription's
 * legacy branch or in create-checkout. The list is sourced from server env only —
 * never from the request body. STRIPE_MONTHLY_PRICE_ID is always included when set;
 * STRIPE_ALLOWED_PRICE_IDS is an optional comma-separated list for any additional
 * prices (e.g. one-off add-on Prices used by create-checkout).
 */
export function allowedStripePriceIds(): Set<string> {
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

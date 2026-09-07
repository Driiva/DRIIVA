/**
 * How long to wait for the insurer's answer before telling the driver we do
 * not have one. Binding is a Stripe webhook plus a Cloud Function plus a Root
 * round trip, so seconds are normal and a stall is not.
 * Extracted verbatim from client/src/pages/checkout.tsx.
 */
export const COVER_CONFIRMATION_TIMEOUT_MS = 45_000;

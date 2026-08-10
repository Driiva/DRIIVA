import { z } from 'zod';

import { FirestoreTimestampSchema } from './timestamp';

export const PendingPaymentStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type PendingPaymentStatus = z.infer<typeof PendingPaymentStatusSchema>;

/**
 * Whether the driver has COVER, which is a different question from whether
 * the binding attempt finished.
 *
 * `status: 'completed'` only means the trigger ran to the end. A policy Root
 * returned in a pending state completes the attempt and leaves the driver
 * uninsured, and 'none' is the case where we hold the money and hold no cover
 * at all. Checkout reads this field, not `status`, to decide what to say.
 */
export const PendingPaymentPolicyStatusSchema = z.enum([
  'active',
  'pending',
  'expired',
  'cancelled',
  'suspended',
  'none',
]);
export type PendingPaymentPolicyStatus = z.infer<typeof PendingPaymentPolicyStatusSchema>;

/**
 * PENDING PAYMENT DOCUMENT
 * ========================
 * Collection: `users/{uid}/pendingPayments/{stripeSubscriptionId}`. Written
 * by the Express Stripe webhook handler (Admin SDK) after
 * `invoice.payment_succeeded`; this doc IS the idempotency ledger for binding
 * a Root policy - read and re-written by `onPendingPaymentWrite`
 * (functions/src/triggers/payments.ts:34-42). firestore.rules: owner read,
 * `write: if false` (anti-forge - a client cannot fabricate a payment doc to
 * trigger a policy bind without a real Stripe charge).
 */
export const PendingPaymentDocumentSchema = z.object({
  stripeSubscriptionId: z.string(),
  stripeCustomerId: z.string(),
  quoteId: z.string().optional(),
  status: PendingPaymentStatusSchema,
  /** Absent until the trigger has resolved the binding. */
  policyStatus: PendingPaymentPolicyStatusSchema.optional(),
  policyId: z.string().optional(),
  error: z.string().optional(),
  createdAt: FirestoreTimestampSchema,
  processedAt: FirestoreTimestampSchema.optional(),
});
export type PendingPaymentDocument = z.infer<typeof PendingPaymentDocumentSchema>;

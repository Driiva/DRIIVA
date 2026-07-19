import { z } from 'zod';

import { FirestoreTimestampSchema } from './timestamp';

export const PendingPaymentStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type PendingPaymentStatus = z.infer<typeof PendingPaymentStatusSchema>;

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
  error: z.string().optional(),
  createdAt: FirestoreTimestampSchema,
  processedAt: FirestoreTimestampSchema.optional(),
});
export type PendingPaymentDocument = z.infer<typeof PendingPaymentDocumentSchema>;

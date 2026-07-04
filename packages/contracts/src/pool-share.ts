import { z } from 'zod';

import { FirestoreTimestampSchema } from './timestamp';

export const PoolShareStatusSchema = z.enum(['active', 'finalized', 'paid_out']);
export type PoolShareStatus = z.infer<typeof PoolShareStatusSchema>;

/**
 * POOL SHARE SUMMARY
 * ==================
 * Denormalized pool share embedded on the user doc (`users/{uid}.poolShare`).
 * Source: shared/firestore-types.ts `PoolShareSummary` (~L93-98).
 */
export const PoolShareSummarySchema = z.object({
  currentShareCents: z.number().int(),
  contributionCents: z.number().int().min(0),
  // Source comment: "0-100 (2 decimal precision)".
  sharePercentage: z.number().min(0).max(100),
  lastUpdatedAt: FirestoreTimestampSchema,
});
export type PoolShareSummary = z.infer<typeof PoolShareSummarySchema>;

/**
 * POOL SHARE DOCUMENT
 * ===================
 * Collection: `poolShares/{poolPeriod}_{userId}`.
 * Source: shared/firestore-types.ts `PoolShareDocument` (~L474-503).
 *
 * Note: this doc's `sharePercentage` is documented as "4 decimals" (finer
 * precision than the 2dp `PoolShareSummary` embed above) and carries no
 * explicit 0-100 bound in source - left unconstrained rather than guessing.
 */
export const PoolShareDocumentSchema = z.object({
  shareId: z.string(),
  poolPeriod: z.string(),
  userId: z.string(),
  contributionCents: z.number().int().min(0),
  contributionCount: z.number().int().min(0),
  sharePercentage: z.number(),
  weightedScore: z.number(),
  baseRefundCents: z.number().int(),
  projectedRefundCents: z.number().int(),
  status: PoolShareStatusSchema,
  eligibleForRefund: z.boolean(),
  tripsIncluded: z.number().int().min(0),
  milesIncluded: z.number(),
  averageScore: z.number(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
  finalizedAt: FirestoreTimestampSchema.nullable(),
});
export type PoolShareDocument = z.infer<typeof PoolShareDocumentSchema>;

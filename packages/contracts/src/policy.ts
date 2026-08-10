import { z } from 'zod';

import { FirestoreTimestampSchema } from './timestamp';
import { VehicleInfoSchema } from './vehicle';

export const CoverageTypeSchema = z.enum(['basic', 'standard', 'premium']);
export type CoverageType = z.infer<typeof CoverageTypeSchema>;

export const PolicyStatusSchema = z.enum(['pending', 'active', 'expired', 'cancelled', 'suspended']);
export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;

export const BillingCycleSchema = z.enum(['monthly', 'quarterly', 'annual']);
export type BillingCycle = z.infer<typeof BillingCycleSchema>;

/**
 * ACTIVE POLICY SUMMARY
 * =====================
 * Denormalized policy summary embedded on the user doc (`users/{uid}.activePolicy`).
 * Source: shared/firestore-types.ts `ActivePolicySummary` (~L81-88).
 *
 * Quirk 6.6: `acceptInsuranceQuote`'s direct write of `activePolicy`
 * (functions/src/http/insurance.ts) is malformed - it omits
 * premiumCents/coverageType/renewalDate and adds a stray `startDate` - and is
 * silently corrected immediately after by the `onPolicyWrite` trigger. This
 * schema pins the CORRECTED/canonical shape the trigger produces, which is
 * what every real read of `users/{uid}.activePolicy` observes once the
 * trigger has run, not the transient malformed write.
 */
export const ActivePolicySummarySchema = z.object({
  policyId: z.string(),
  /** Null until the insurer issues one. Never invented. */
  policyNumber: z.string().nullable(),
  status: PolicyStatusSchema,
  premiumCents: z.number().int(),
  coverageType: CoverageTypeSchema,
  renewalDate: FirestoreTimestampSchema,
});
export type ActivePolicySummary = z.infer<typeof ActivePolicySummarySchema>;

export const CoverageDetailsSchema = z.object({
  liabilityLimitCents: z.number().int(),
  collisionDeductibleCents: z.number().int(),
  comprehensiveDeductibleCents: z.number().int(),
  includesRoadside: z.boolean(),
  includesRental: z.boolean(),
});

/**
 * POLICY DOCUMENT
 * ===============
 * Collection: `policies/{policyId}`.
 * Source: shared/firestore-types.ts `PolicyDocument` (~L390-423).
 */
export const PolicyDocumentSchema = z.object({
  policyId: z.string(),
  userId: z.string(),
  /** Null until the insurer issues one. Never invented. */
  policyNumber: z.string().nullable(),
  status: PolicyStatusSchema,
  coverageType: CoverageTypeSchema,
  // Null when nobody has underwritten the policy. See functions/src/types.ts.
  coverageDetails: CoverageDetailsSchema.nullable(),
  basePremiumCents: z.number().int(),
  currentPremiumCents: z.number().int(),
  // Source comment says "0-30 typically" - a guideline, not an enforced
  // invariant anywhere in the current code. Left unconstrained to avoid
  // rejecting real documents the "typically" already admits may exist.
  discountPercentage: z.number(),
  effectiveDate: FirestoreTimestampSchema,
  expirationDate: FirestoreTimestampSchema,
  renewalDate: FirestoreTimestampSchema.nullable(),
  vehicle: VehicleInfoSchema.nullable(),
  billingCycle: BillingCycleSchema,
  stripeSubscriptionId: z.string().nullable(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
  createdBy: z.string(),
  updatedBy: z.string(),
});
export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;

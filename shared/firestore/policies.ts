/**
 * The policies collection.
 * Extracted verbatim from shared/firestore-types.ts, which re-exports this
 * module so every existing import keeps working.
 */

import type { Timestamp } from './timestamp';
import type {
  BillingCycle,
  CoverageType,
  PolicyStatus,
} from './enums';

// ============================================================================
// POLICIES COLLECTION
// ============================================================================

/**
 * Coverage details for policy
 */
export interface CoverageDetails {
  liabilityLimitCents: number;
  collisionDeductibleCents: number;
  comprehensiveDeductibleCents: number;
  includesRoadside: boolean;
  includesRental: boolean;
}

/**
 * Vehicle information
 */
export interface VehicleInfo {
  vin: string | null;
  make: string;
  model: string;
  year: number;
  color: string | null;
}

/**
 * Policy document
 * Collection: policies/{policyId}
 * Document ID: Auto-generated or external policy number
 */
export interface PolicyDocument {
  policyId: string;
  userId: string;
  
  // Policy Details
  policyNumber: string;             // External reference
  status: PolicyStatus;
  
  coverageType: CoverageType;
  coverageDetails: CoverageDetails;
  
  // Financial
  basePremiumCents: number;         // Before telematics discount
  currentPremiumCents: number;      // After discount
  discountPercentage: number;       // 0-30 typically
  
  // Dates
  effectiveDate: Timestamp;
  expirationDate: Timestamp;
  renewalDate: Timestamp | null;
  
  // Vehicle (if applicable)
  vehicle: VehicleInfo | null;
  
  // Billing
  billingCycle: BillingCycle;
  stripeSubscriptionId: string | null;
  
  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

import { describe, it, expect } from 'vitest';

import { ActivePolicySummarySchema, PolicyDocumentSchema } from '../policy';
import { fakeTimestamp } from './fixtures';

describe('ActivePolicySummarySchema', () => {
  // The CORRECTED shape produced by the onPolicyWrite trigger (quirk 6.6),
  // not the malformed direct write acceptInsuranceQuote sends before it.
  const validFixture = {
    policyId: 'policy_abc123',
    policyNumber: 'DRV-2026-0042',
    status: 'active' as const,
    premiumCents: 4_500,
    coverageType: 'standard' as const,
    renewalDate: fakeTimestamp(),
  };

  it('parses the corrected/canonical activePolicy shape', () => {
    expect(ActivePolicySummarySchema.parse(validFixture)).toEqual(validFixture);
  });

  it('pins the current field set (drift guard: fails if a field is removed/renamed)', () => {
    expect(Object.keys(ActivePolicySummarySchema.shape)).toMatchSnapshot();
  });

  it('rejects the malformed direct-write shape (missing premiumCents/coverageType/renewalDate)', () => {
    const malformed = {
      policyId: 'policy_abc123',
      policyNumber: 'DRV-2026-0042',
      status: 'active',
      startDate: fakeTimestamp(), // stray field the malformed write adds
    };
    expect(() => ActivePolicySummarySchema.parse(malformed)).toThrow();
  });
});

describe('PolicyDocumentSchema', () => {
  const validFixture = {
    policyId: 'policy_abc123',
    userId: 'user_abc123',
    policyNumber: 'DRV-2026-0042',
    status: 'active' as const,
    coverageType: 'standard' as const,
    coverageDetails: {
      liabilityLimitCents: 10_000_000,
      collisionDeductibleCents: 50_000,
      comprehensiveDeductibleCents: 50_000,
      includesRoadside: true,
      includesRental: false,
    },
    basePremiumCents: 5_000,
    currentPremiumCents: 4_500,
    discountPercentage: 10,
    effectiveDate: fakeTimestamp(),
    expirationDate: fakeTimestamp(),
    renewalDate: fakeTimestamp(),
    vehicle: { vin: null, make: 'Ford', model: 'Focus', year: 2019, color: 'blue' },
    billingCycle: 'monthly' as const,
    stripeSubscriptionId: null,
    createdAt: fakeTimestamp(),
    updatedAt: fakeTimestamp(),
    createdBy: 'system',
    updatedBy: 'system',
  };

  it('parses a representative policies/{policyId} document', () => {
    expect(PolicyDocumentSchema.parse(validFixture)).toEqual(validFixture);
  });

  it('rejects an invalid coverageType', () => {
    expect(() => PolicyDocumentSchema.parse({ ...validFixture, coverageType: 'gold' })).toThrow();
  });
});

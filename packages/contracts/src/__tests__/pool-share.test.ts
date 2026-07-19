import { describe, it, expect } from 'vitest';

import { PoolShareSummarySchema, PoolShareDocumentSchema } from '../pool-share';
import { fakeTimestamp } from './fixtures';

describe('PoolShareSummarySchema', () => {
  const validFixture = {
    currentShareCents: 1_200,
    contributionCents: 4_500,
    sharePercentage: 2.5,
    lastUpdatedAt: fakeTimestamp(),
  };

  it('parses the embedded users/{uid}.poolShare shape', () => {
    expect(PoolShareSummarySchema.parse(validFixture)).toEqual(validFixture);
  });

  it('pins the current field set (drift guard: fails if a field is removed/renamed)', () => {
    expect(Object.keys(PoolShareSummarySchema.shape)).toMatchSnapshot();
  });

  it('rejects a sharePercentage above 100', () => {
    expect(() => PoolShareSummarySchema.parse({ ...validFixture, sharePercentage: 101 })).toThrow();
  });
});

describe('PoolShareDocumentSchema', () => {
  const validFixture = {
    shareId: '2026-02_user_abc123',
    poolPeriod: '2026-02',
    userId: 'user_abc123',
    contributionCents: 4_500,
    contributionCount: 3,
    sharePercentage: 0.0234,
    weightedScore: 88.5,
    baseRefundCents: 900,
    projectedRefundCents: 750,
    status: 'active' as const,
    eligibleForRefund: true,
    tripsIncluded: 12,
    milesIncluded: 340,
    averageScore: 84,
    createdAt: fakeTimestamp(),
    updatedAt: fakeTimestamp(),
    finalizedAt: null,
  };

  it('parses a representative poolShares/{poolPeriod_userId} document', () => {
    expect(PoolShareDocumentSchema.parse(validFixture)).toEqual(validFixture);
  });

  it('pins the current field set (drift guard: fails if a field is removed/renamed)', () => {
    expect(Object.keys(PoolShareDocumentSchema.shape)).toMatchSnapshot();
  });

  it('rejects an invalid status', () => {
    expect(() => PoolShareDocumentSchema.parse({ ...validFixture, status: 'refunded' })).toThrow();
  });
});

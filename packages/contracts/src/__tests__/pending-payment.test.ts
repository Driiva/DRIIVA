import { describe, it, expect } from 'vitest';

import { PendingPaymentDocumentSchema } from '../pending-payment';
import { fakeTimestamp } from './fixtures';

describe('PendingPaymentDocumentSchema', () => {
  const validFixture = {
    stripeSubscriptionId: 'sub_abc123',
    stripeCustomerId: 'cus_abc123',
    quoteId: 'qp_abc123',
    status: 'pending' as const,
    createdAt: fakeTimestamp(),
  };

  it('parses a representative users/{uid}/pendingPayments/{subscriptionId} document', () => {
    expect(PendingPaymentDocumentSchema.parse(validFixture)).toEqual(validFixture);
  });

  it('parses the failed-terminal shape with error + processedAt set', () => {
    const failed = {
      ...validFixture,
      status: 'failed' as const,
      error: 'Root API returned 500',
      processedAt: fakeTimestamp(),
    };
    expect(PendingPaymentDocumentSchema.parse(failed)).toEqual(failed);
  });

  it('parses without the optional quoteId (fallback path resolves it later)', () => {
    const { quoteId: _quoteId, ...withoutQuoteId } = validFixture;
    expect(PendingPaymentDocumentSchema.parse(withoutQuoteId)).toEqual(withoutQuoteId);
  });

  it('pins the current field set (drift guard: fails if a field is removed/renamed)', () => {
    expect(Object.keys(PendingPaymentDocumentSchema.shape)).toMatchSnapshot();
  });

  it('rejects an invalid status', () => {
    expect(() => PendingPaymentDocumentSchema.parse({ ...validFixture, status: 'cancelled' })).toThrow();
  });
});

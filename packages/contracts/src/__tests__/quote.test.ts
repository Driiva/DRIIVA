import { describe, it, expect } from 'vitest';

import { QuoteDocumentSchema } from '../quote';
import { fakeTimestamp } from './fixtures';

describe('QuoteDocumentSchema', () => {
  const validFixture = {
    quoteId: 'qp_abc123',
    userId: 'user_abc123',
    coverageType: 'standard' as const,
    premiumCents: 4_500,
    expiresAt: '2026-08-01T00:00:00.000Z',
    createdAt: fakeTimestamp(),
  };

  it('parses a representative quotes/{quoteId} document (getInsuranceQuote write shape)', () => {
    expect(QuoteDocumentSchema.parse(validFixture)).toEqual(validFixture);
  });

  it('pins the current field set (drift guard: fails if a field is removed/renamed)', () => {
    expect(Object.keys(QuoteDocumentSchema.shape)).toMatchSnapshot();
  });

  it('rejects expiresAt as a Firestore Timestamp (quirk: writer uses a raw ISO string, not Timestamp)', () => {
    expect(() => QuoteDocumentSchema.parse({ ...validFixture, expiresAt: fakeTimestamp() })).toThrow();
  });

  it('rejects an invalid coverageType', () => {
    expect(() => QuoteDocumentSchema.parse({ ...validFixture, coverageType: 'gold' })).toThrow();
  });
});

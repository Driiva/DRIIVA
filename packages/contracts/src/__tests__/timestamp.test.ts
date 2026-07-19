import { describe, it, expect } from 'vitest';

import { FirestoreTimestampSchema } from '../timestamp';

describe('FirestoreTimestampSchema', () => {
  it('parses a client-SDK-shaped Timestamp (seconds/nanoseconds/toDate)', () => {
    const fixture = { seconds: 1_772_000_000, nanoseconds: 0, toDate: () => new Date() };
    expect(FirestoreTimestampSchema.parse(fixture)).toBe(fixture);
  });

  it('parses an admin-SDK-shaped Timestamp without a toDate method', () => {
    const fixture = { seconds: 1_772_000_000, nanoseconds: 123 };
    expect(FirestoreTimestampSchema.parse(fixture)).toBe(fixture);
  });

  it('rejects a raw ISO string (the shape it is most often confused with)', () => {
    expect(() => FirestoreTimestampSchema.parse('2026-07-04T00:00:00.000Z')).toThrow();
  });

  it('rejects null', () => {
    expect(() => FirestoreTimestampSchema.parse(null)).toThrow();
  });
});

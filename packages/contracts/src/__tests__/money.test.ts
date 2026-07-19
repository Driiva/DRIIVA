import { describe, it, expect } from 'vitest';

import { MoneySchema, fromPence, toDisplay } from '../money';

describe('MoneySchema / fromPence', () => {
  it('parses a representative integer-pence fixture (premiumCents-style value)', () => {
    expect(fromPence(12_345)).toBe(12_345);
  });

  it('parses zero pence', () => {
    expect(fromPence(0)).toBe(0);
  });

  it('rejects a non-integer pence value (e.g. a pounds-decimal slipped through)', () => {
    expect(() => fromPence(123.45)).toThrow();
  });

  it('rejects a decimal-string amount (the PG premium_amount shape, e.g. "500.00")', () => {
    expect(() => MoneySchema.parse('500.00' as unknown as number)).toThrow();
  });
});

describe('toDisplay', () => {
  // Snapshot pins the ONE display-derivation function's output format. Money
  // is a branded scalar, not an object, so there is no `.shape` key set to
  // snapshot - this pins the derived-display format instead, which is the
  // actual drift this contract exists to prevent (a shown figure diverging
  // from the charged pence value).
  it('formats a representative amount as GBP currency (shape snapshot)', () => {
    expect(toDisplay(fromPence(12_345))).toMatchSnapshot();
  });

  it('formats zero pence as GBP currency', () => {
    expect(toDisplay(fromPence(0))).toBe('£0.00');
  });
});

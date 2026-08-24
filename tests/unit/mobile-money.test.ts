/**
 * Lives in the root test tree rather than beside the module: mobile/ has its
 * own Expo tsconfig and dependency set, which the root vitest run cannot
 * resolve. Same reason as tests/unit/mobile-waitlist.test.ts.
 *
 * mobile/lib/money.ts is the one place cents become pounds. Two properties
 * matter enough to pin:
 *
 *   1. Cents in, pounds at render. A premium held as 84000 must never reach a
 *      screen as "84000" or as "840" without the pence, and the rounding has
 *      to be the same everywhere so two surfaces reading one field cannot
 *      disagree by a penny.
 *   2. An ABSENT amount is not a zero amount. A formatter whose fallback is
 *      "0.00" turns "we have no premium for this driver yet" into "your
 *      premium is nothing", which is a fabricated number on an insurance
 *      screen. Absence has to render as words, so the empty state stays a
 *      state instead of quietly generating a figure.
 */
import { describe, it, expect } from 'vitest';
import {
  formatPounds,
  formatPoundsWhole,
  isValidCents,
  MONEY_PLACEHOLDER,
} from '../../mobile/lib/money';

describe('formatPounds: cents in, pounds at render', () => {
  it('renders integer cents as pounds and pence', () => {
    expect(formatPounds(123456)).toBe('£1,234.56');
  });

  it('renders a real zero as a real zero', () => {
    expect(formatPounds(0)).toBe('£0.00');
  });

  it('groups thousands', () => {
    expect(formatPounds(8400000)).toBe('£84,000.00');
  });

  it('keeps the sign on a negative amount', () => {
    expect(formatPounds(-500)).toBe('-£5.00');
  });

  it('rounds a fractional cent to the nearest cent', () => {
    expect(formatPounds(1234.5)).toBe('£12.35');
    expect(formatPounds(1234.4)).toBe('£12.34');
  });

  it('never renders NaN as a pound figure', () => {
    expect(formatPounds(Number.NaN)).not.toContain('NaN');
  });
});

describe('formatPounds: an absent amount is not a zero amount', () => {
  const absent = [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, '1234', {}];

  for (const value of absent) {
    it(`renders no digits for ${JSON.stringify(value) ?? String(value)}`, () => {
      // The load-bearing assertion. A fallback containing a digit reads as a
      // real amount to the driver, which is the fabricated-number failure this
      // module exists to make impossible.
      expect(formatPounds(value)).not.toMatch(/\d/);
    });
  }

  it('has a placeholder that carries no digits', () => {
    expect(MONEY_PLACEHOLDER).not.toMatch(/\d/);
  });

  it('honours an explicit placeholder from the caller', () => {
    expect(formatPounds(undefined, 'Not started')).toBe('Not started');
  });
});

describe('formatPoundsWhole: headline figures', () => {
  it('drops the pence and rounds', () => {
    expect(formatPoundsWhole(123456)).toBe('£1,235');
  });

  it('renders a real zero as a real zero', () => {
    expect(formatPoundsWhole(0)).toBe('£0');
  });

  it('renders no digits for an absent amount', () => {
    expect(formatPoundsWhole(undefined)).not.toMatch(/\d/);
    expect(formatPoundsWhole(null)).not.toMatch(/\d/);
  });
});

describe('isValidCents', () => {
  it('accepts finite numbers including zero and negatives', () => {
    expect(isValidCents(0)).toBe(true);
    expect(isValidCents(-1)).toBe(true);
    expect(isValidCents(84000)).toBe(true);
  });

  it('rejects everything that is not a finite number', () => {
    expect(isValidCents(undefined)).toBe(false);
    expect(isValidCents(null)).toBe(false);
    expect(isValidCents(Number.NaN)).toBe(false);
    expect(isValidCents(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidCents('84000')).toBe(false);
  });
});

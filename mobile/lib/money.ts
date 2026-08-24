/**
 * Money formatting for the mobile app. Cents in, pounds only at render.
 *
 * Every screen that shows a pound figure goes through here so the "cents vs
 * pounds" mistake (the dashboard once rendered a refund at 100x) cannot come
 * back one screen at a time. Inputs are integer pence/cents; anything that is
 * not a finite number renders as the placeholder rather than "£NaN".
 *
 * The placeholder carries NO digits, deliberately. An amount we do not have is
 * not an amount of zero: a driver with no premium bound yet has an unknown
 * refund, not a refund of nothing, and "£0.00" states the second. Absence
 * renders as words so the empty state stays a state instead of generating a
 * figure nobody computed. A real zero still renders as "£0.00", because that
 * one was actually calculated.
 */

const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const GBP_WHOLE = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const MONEY_PLACEHOLDER = 'Not started';

export function isValidCents(cents: unknown): cents is number {
  return typeof cents === 'number' && Number.isFinite(cents);
}

/** 123456 -> "£1,234.56". Non-finite input -> placeholder, never "£NaN". */
export function formatPounds(cents: unknown, placeholder: string = MONEY_PLACEHOLDER): string {
  if (!isValidCents(cents)) return placeholder;
  return GBP.format(Math.round(cents) / 100);
}

/** 123456 -> "£1,235" for headline figures where pence add noise. */
export function formatPoundsWhole(cents: unknown, placeholder: string = MONEY_PLACEHOLDER): string {
  if (!isValidCents(cents)) return placeholder;
  return GBP_WHOLE.format(Math.round(cents) / 100);
}

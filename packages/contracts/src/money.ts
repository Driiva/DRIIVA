import { z } from 'zod';

/**
 * MONEY
 * =====
 * Global constraint: money is integer pence end-to-end. `Money` is a branded
 * `number` so a raw, un-vetted `number` cannot be passed where a vetted pence
 * value is required - it must go through `fromPence` first.
 *
 * Migration note: `shared/schema.ts` `users.premium_amount` is a Postgres
 * DECIMAL column stored as a STRING, in POUNDS, e.g. `'500.00'` (the column's
 * own default). That is neither an integer nor pence. This schema
 * deliberately does NOT accept that shape - any future migration read of
 * `premium_amount` must explicitly parse the decimal string and multiply by
 * 100 (with rounding) before the result can be treated as `Money`. Do not
 * "helpfully" widen `MoneySchema` to accept decimal strings; that would
 * reintroduce the exact display/charge divergence this contract exists to
 * kill. Everywhere else in the codebase already uses integer pence
 * (`premiumCents`, `contributionCents`, `basePremiumCents`, ...).
 */
export const MoneySchema = z.number().int().brand<'Money'>();
export type Money = z.infer<typeof MoneySchema>;

/** Parses a raw integer-pence number into a vetted, branded `Money` value. */
export function fromPence(pence: number): Money {
  return MoneySchema.parse(pence);
}

/**
 * The ONE place a `Money` value becomes a display string. Every UI surface
 * must derive its displayed figure through this function so a shown amount
 * can never diverge from the pence value actually charged/stored.
 */
export function toDisplay(money: Money): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(money / 100);
}

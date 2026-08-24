/**
 * Input validation at the onboarding boundary.
 *
 * Onboarding asks two free-text questions whose answers go on to price a
 * policy: how old the driver is, and the postcode their rating area comes
 * from. Both come back from a TextInput, so both come back as strings, and a
 * string is not an age.
 *
 * The point of doing it here rather than on each screen is that the coercion
 * happens exactly once. Nothing downstream has to wonder whether it is holding
 * 25 or "25" or "" or NaN, and no screen gets to invent its own idea of which
 * postcodes are real.
 *
 * One trap worth naming, because a bare z.coerce.number() walks straight into
 * it: Number('') is 0. A blank age field coerced that way becomes an age of
 * zero, which then fails the range check and tells the driver they are too
 * young to insure. "Not answered" and "answered 0" are different states and
 * the parser keeps them different.
 */
import { z } from 'zod';

/** The insurable range Driiva quotes for. Both ends inclusive. */
export const MIN_AGE = 17;
export const MAX_AGE = 99;

const AGE_MESSAGE = `Enter an age between ${MIN_AGE} and ${MAX_AGE}.`;
const POSTCODE_MESSAGE = 'Enter a UK postcode, for example SW1A 1AA.';

/**
 * A UK outward code: the half before the space. One or two letters, a digit,
 * then an optional letter or digit. Covers every real shape: M1, M60, CR2,
 * DN55, W1A, EC1A.
 */
const OUTWARD_ONLY = /^[A-Z]{1,2}\d[A-Z\d]?$/;

/** The same outward code followed by an inward code (digit, two letters). */
const FULL_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\d[A-Z]{2}$/;

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Narrow a compacted, uppercased string to its outward code, or null if it is
 * not a UK postcode. Accepts the full postcode as well as the outward code
 * alone, because a driver asked for their postcode types all of it.
 */
function outwardOf(compact: string): string | null {
  const full = FULL_POSTCODE.exec(compact);
  if (full) return full[1];
  return OUTWARD_ONLY.test(compact) ? compact : null;
}

/**
 * Age as an integer inside the insurable range. Accepts the number or the
 * string a text field produces; rejects blanks, decimals, and anything that is
 * not a number rather than coercing it to one.
 */
export const ageSchema = z.preprocess((raw) => {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (trimmed === '') return Number.NaN;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}, z.number().int().min(MIN_AGE).max(MAX_AGE));

/**
 * Postcode normalised to its uppercase outward code. Whitespace anywhere is
 * dropped before matching, so "  sw1a 1aa  " and "SW1A1AA" both land on
 * "SW1A".
 */
export const postcodeOutwardSchema = z
  .string()
  .transform((raw) => raw.toUpperCase().replace(/\s+/g, ''))
  .refine((compact) => outwardOf(compact) !== null, { message: POSTCODE_MESSAGE })
  .transform((compact) => outwardOf(compact) as string);

/** Age, with a message a driver can read rather than a zod issue tree. */
export function parseAge(input: unknown): ParseResult<number> {
  const result = ageSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: AGE_MESSAGE };
}

/** Outward code, with a message a driver can read. */
export function parsePostcodeOutward(input: unknown): ParseResult<string> {
  const result = postcodeOutwardSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: POSTCODE_MESSAGE };
}

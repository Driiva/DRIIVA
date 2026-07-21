/**
 * Driiva — Deterministic client-side pricing engine.
 *
 * Calculates an annual premium in GBP from onboarding inputs.
 * Same inputs always produce the same price (no randomness, no external calls).
 *
 * Formula:
 *   annualPremium = BASE × vehicleFactor × ageFactor × ncbFactor × postcodeFactor
 *
 * Ranges: roughly £600–£2,400 / year before Driiva score refinement,
 *         which is realistic for UK car insurance (2024–2026 market).
 *
 * Monthly instalment adds a 7% loading (industry-standard UK practice).
 */

// scoreFactor / scoreDiscountPercent now live in the canonical @driiva/scoring
// package (M2 repoint). Imported here for calculateAnnualPremium and re-exported
// so existing consumers (checkout, characterisation tests) keep the same import.
import { scoreFactor, scoreDiscountPercent } from '@driiva/scoring';
export { scoreFactor, scoreDiscountPercent };

export interface PricingInputs {
  /** Vehicle registration year (e.g. 2021). Older/newer affects base rate. */
  vehicleYear?: number | null;
  /** Driver age in years. */
  age?: number | null;
  /** Years of no-claims bonus, 0–5 (values above 5 are capped at 5). */
  noClaimsYears?: number | null;
  /** UK postcode prefix e.g. "SW1A 1AA" → we use the outward code "SW1A". */
  postcode?: string | null;
  /** Optional Driiva driving score (0–100). Refines the premium by ±15%. */
  drivingScore?: number | null;
}

/** Annual base before any multipliers — mid-range UK standard. */
const BASE_ANNUAL_GBP = 1_200;

/** Rounding target (nearest £10). */
const ROUND_TO = 10;

// ---------------------------------------------------------------------------
// Vehicle age factor
// Newer cars (< 4 years) cost more to repair/replace → higher premium.
// Very old cars (> 12 years) are often lower-value but may lack safety tech.
// ---------------------------------------------------------------------------
function vehicleFactor(year: number | null | undefined): number {
  if (!year) return 1.0;
  const age = new Date().getFullYear() - year;
  if (age <= 3) return 1.28;   // brand new / nearly new
  if (age <= 7) return 1.10;   // modern
  if (age <= 12) return 1.00;  // standard
  return 0.88;                  // older, lower value
}

// ---------------------------------------------------------------------------
// Driver age factor
// Under-25s are statistically higher risk; 25–45 is standard;
// 45–65 moderate discount; 65+ slight uptick (reaction time).
// ---------------------------------------------------------------------------
function ageFactor(age: number | null | undefined): number {
  if (!age) return 1.0;
  if (age < 21) return 1.55;
  if (age < 25) return 1.35;
  if (age <= 45) return 1.00;
  if (age <= 65) return 0.92;
  return 0.98;
}

// ---------------------------------------------------------------------------
// No-claims bonus factor
// Each year of NCB reduces premium by 10%, capped at 50% (5 years).
// ---------------------------------------------------------------------------
function ncbFactor(ncbYears: number | null | undefined): number {
  const years = Math.min(Math.max(ncbYears ?? 0, 0), 5);
  return 1 - years * 0.10;
}

// ---------------------------------------------------------------------------
// Postcode area risk factor
// Uses the outward code prefix for broad UK region risk tiers.
// London/high-density urban: +20%; standard: 0%; rural: -10%.
// ---------------------------------------------------------------------------
const HIGH_RISK_PREFIXES = new Set([
  'E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC',  // Inner London
  'IG', 'RM', 'DA', 'CR', 'SM', 'TW', 'UB',       // Greater London
  'B', 'M', 'L', 'LS',                             // Birmingham, Manchester, Liverpool, Leeds
  'WS', 'WV', 'DY', 'ST',                          // West Midlands
  'S', 'DN',                                        // Sheffield, Doncaster
  'G', 'PA',                                        // Glasgow
]);

const LOW_RISK_PREFIXES = new Set([
  'TD', 'DG', 'KW', 'IV', 'PH', 'AB', 'DD', 'FK', 'KY', 'ZE', 'HS', // Scottish highlands
  'LL', 'SY', 'SA', 'LD',                                               // Rural Wales
  'TR', 'PL', 'EX', 'TQ', 'DT', 'BH',                                  // SW England
  'CA', 'LA', 'DL', 'HG',                                               // Cumbria/N Yorkshire
]);

function postcodeFactor(postcode: string | null | undefined): number {
  if (!postcode) return 1.0;
  // Extract outward code prefix (letters only, max 2 chars)
  const prefix = postcode.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  // Try longest match first (e.g. "SW1A" before "SW")
  for (let len = Math.min(prefix.length, 4); len >= 1; len--) {
    const code = prefix.slice(0, len);
    if (HIGH_RISK_PREFIXES.has(code)) return 1.20;
    if (LOW_RISK_PREFIXES.has(code)) return 0.90;
  }
  return 1.00;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the annual premium in GBP (not pence).
 * Returns a value rounded to the nearest £10.
 */
export function calculateAnnualPremium(inputs: PricingInputs): number {
  const raw =
    BASE_ANNUAL_GBP *
    vehicleFactor(inputs.vehicleYear) *
    ageFactor(inputs.age) *
    ncbFactor(inputs.noClaimsYears) *
    postcodeFactor(inputs.postcode) *
    scoreFactor(inputs.drivingScore);

  // Round to nearest £10, clamp to realistic UK range
  const rounded = Math.round(raw / ROUND_TO) * ROUND_TO;
  return Math.max(480, Math.min(2_400, rounded));
}

/**
 * Calculate the monthly instalment from an annual premium.
 * Adds a 7% loading (standard UK monthly payment surcharge).
 * Returns GBP with 2 decimal places.
 */
export function calculateMonthlyPremium(annualGbp: number): number {
  return Math.round((annualGbp / 12) * 1.07 * 100) / 100;
}

/**
 * Format a GBP amount for display: £1,200 (annual) or £107.00 (monthly).
 */
export function formatGbp(amount: number, showPence = false): string {
  if (showPence) {
    return `£${amount.toFixed(2)}`;
  }
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

/**
 * Demo profile — representative 28-year-old with 2 years NCB, 2022 VW Golf, London.
 * Produces a consistent illustrative premium for demo/unauthenticated states.
 */
export const DEMO_PRICING_INPUTS: PricingInputs = {
  vehicleYear: 2022,
  age: 28,
  noClaimsYears: 2,
  postcode: 'E1',
  drivingScore: 82,
};

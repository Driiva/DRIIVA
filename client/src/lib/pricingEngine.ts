/**
 * Driiva - Deterministic client-side pricing engine.
 *
 * ESTIMATE ONLY. This engine exists to render a responsive quote preview
 * while onboarding, before a server-side quote is available. It is never
 * authoritative: the server (Root Platform quote, or the price_data branch
 * of POST /api/payments/create-subscription) computes and binds the price
 * actually charged. Any UI that surfaces a figure from this module MUST
 * label it as an estimate - see checkout.tsx's "Estimated premium" copy.
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
// Postcode area risk factor (D7)
// Uses the UK postcode AREA - the 1-2 leading letters that precede the first
// digit of the outward code (e.g. "BA1 2AB" -> "BA", "B1 1AA" -> "B") - as
// the lookup key into a real area risk table.
//
// The previous implementation stripped all non-letter characters from the
// postcode before matching, which concatenated fragments across the digit
// boundary (e.g. "BA1 2AB" -> "BAAB") and, worse, had no dedicated "BA"
// entry at all - so Bath silently fell through to the single-letter "B"
// (Birmingham) entry and was overcharged as if it were an inner-city West
// Midlands postcode. The same fallthrough mispriced BD (Bradford), BL
// (Bolton), BN (Brighton) and SN (Swindon) against their unrelated
// single-letter neighbours (B, S).
//
// This is a deliberately real but non-exhaustive outward-code AREA table:
// enough coverage to separate the areas above, not a full 124-area Royal
// Mail dataset. Unlisted areas resolve to the standard 1.00 multiplier
// rather than silently borrowing a neighbouring area's risk tier.
// ---------------------------------------------------------------------------
const AREA_RISK_TABLE: Record<string, number> = {
  // Inner London - high density, high claims frequency
  E: 1.20, EC: 1.20, N: 1.20, NW: 1.20, SE: 1.20, SW: 1.20, W: 1.20, WC: 1.20,
  // Greater London
  IG: 1.20, RM: 1.20, DA: 1.20, CR: 1.20, SM: 1.20, TW: 1.20, UB: 1.20,
  // Major conurbations
  B: 1.20,   // Birmingham
  M: 1.20,   // Manchester
  L: 1.20,   // Liverpool
  S: 1.20,   // Sheffield
  G: 1.20,   // Glasgow
  // Secondary urban / industrial - elevated but below the major conurbations
  LS: 1.10,  // Leeds
  BD: 1.10,  // Bradford
  BL: 1.10,  // Bolton
  WS: 1.10, WV: 1.10, DY: 1.10, ST: 1.10, // West Midlands / Staffordshire
  DN: 1.10,  // Doncaster
  PA: 1.10,  // Paisley
  BN: 1.10,  // Brighton
  SN: 1.10,  // Swindon
  SG: 1.10,  // Stevenage
  // Rural / low-density
  TD: 0.90, DG: 0.90, KW: 0.90, IV: 0.90, PH: 0.90, AB: 0.90, DD: 0.90, FK: 0.90, KY: 0.90, ZE: 0.90, HS: 0.90, // Scottish highlands
  LL: 0.90, SY: 0.90, SA: 0.90, LD: 0.90,   // Rural Wales
  TR: 0.90, PL: 0.90, EX: 0.90, TQ: 0.90, DT: 0.90, BH: 0.90, // SW England
  CA: 0.90, LA: 0.90, DL: 0.90, HG: 0.90,   // Cumbria / N Yorkshire
  BA: 0.90,  // Bath - affluent, low-density; explicitly distinct from Birmingham (B)
};

/** Extract the UK postcode AREA (1-2 leading letters before the first digit). */
function extractPostcodeArea(postcode: string): string {
  const cleaned = postcode.trim().toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,2})\d/);
  return match ? match[1] : '';
}

function postcodeFactor(postcode: string | null | undefined): number {
  if (!postcode) return 1.0;
  const area = extractPostcodeArea(postcode);
  if (!area) return 1.0;
  return AREA_RISK_TABLE[area] ?? 1.00;
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

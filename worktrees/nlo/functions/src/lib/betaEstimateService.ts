/**
 * BETA ESTIMATE PRICING & REFUND CALCULATOR
 * ==========================================
 * Deterministic, non-binding premium and refund estimates for UX and learning.
 * Designed so internals can be swapped for Root/MGA API later without changing
 * the function signature or Firestore document shape.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_PREMIUM_GBP = 750;

const SCORE_BANDS: Array<{ max: number; factor: number }> = [
  { max: 40, factor: 1.2 },
  { max: 70, factor: 1.0 },
  { max: 85, factor: 0.8 },
  { max: 100, factor: 0.65 },
];

const AGE_BANDS: Array<{ min: number; max: number; factor: number }> = [
  { min: 0, max: 25, factor: 1.3 },
  { min: 25, max: 35, factor: 1.1 },
  { min: 35, max: 60, factor: 1.0 },
  { min: 60, max: 150, factor: 1.2 },
];

const POSTCODE_BANDS: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
  SW1: 'HIGH',
  SW3: 'HIGH',
  SW5: 'HIGH',
  SW7: 'HIGH',
  E1: 'HIGH',
  E14: 'HIGH',
  W1: 'HIGH',
  W2: 'HIGH',
  EC1: 'HIGH',
  EC2: 'HIGH',
  EC3: 'HIGH',
  EC4: 'HIGH',
  M1: 'MEDIUM',
  M2: 'MEDIUM',
  M3: 'MEDIUM',
  B1: 'MEDIUM',
  B2: 'MEDIUM',
  L1: 'MEDIUM',
  BS1: 'LOW',
  BS2: 'LOW',
  BS3: 'LOW',
  BS4: 'LOW',
  BS5: 'LOW',
  BA1: 'LOW',
  BA2: 'LOW',
  CV1: 'LOW',
  CV2: 'LOW',
  CV3: 'LOW',
};

const POSTCODE_FACTORS: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = {
  LOW: 0.9,
  MEDIUM: 1.0,
  HIGH: 1.15,
};

const REFUND_SCORE_THRESHOLD = 70;
const REFUND_PERSONAL_WEIGHT = 0.7;
const REFUND_COMMUNITY_WEIGHT = 0.3;
const REFUND_RATE_MIN = 0.05;
const REFUND_RATE_MAX = 0.15;
const REFUND_RATE_RANGE = 0.1; // 0.15 - 0.05

const PREMIUM_RANGE_MIN_MULTIPLIER = 0.9;
const PREMIUM_RANGE_MAX_MULTIPLIER = 1.1;

export const BETA_ESTIMATE_VERSION = 'beta-v1';

// ============================================================================
// TYPES
// ============================================================================

export interface BetaEstimateInput {
  personalScore: number | null | undefined;
  age: number | null | undefined;
  postcode: string | null | undefined;
  communityPoolSafety: number | null | undefined;
}

export interface BetaEstimateResult {
  estimatedPremium: number;
  minPremium: number;
  maxPremium: number;
  refundRate: number;
  estimatedRefund: number;
  estimatedNetCost: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function clamp(value: number, minVal: number, maxVal: number): number {
  return Math.max(minVal, Math.min(maxVal, value));
}

/**
 * Extract outward code from UK postcode (e.g. "SW1A 1AA" → "SW1").
 */
export function extractOutwardCode(postcode: string): string {
  const normalized = String(postcode || '').trim().toUpperCase().replace(/\s+/g, '');
  const match = normalized.match(/^([A-Z]{1,2}[0-9][0-9A-Z]?)/);
  return match ? match[1] : '';
}

function getScoreFactor(score: number): number {
  for (const band of SCORE_BANDS) {
    if (score <= band.max) return band.factor;
  }
  return SCORE_BANDS[SCORE_BANDS.length - 1].factor;
}

function getAgeFactor(age: number): number {
  for (const band of AGE_BANDS) {
    if (age >= band.min && age < band.max) return band.factor;
  }
  return 1.0;
}

function getPostcodeFactor(postcode: string): number {
  const outward = extractOutwardCode(postcode);
  const band = POSTCODE_BANDS[outward] ?? 'MEDIUM';
  return POSTCODE_FACTORS[band];
}

function roundToNearest10(value: number): number {
  return Math.round(value / 10) * 10;
}

function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Compute beta premium and refund estimate from user inputs.
 * Returns null if required fields are missing (no write to Firestore).
 */
export function calculateBetaEstimate(input: BetaEstimateInput): BetaEstimateResult | null {
  const personalScore = input.personalScore;
  const age = input.age;
  const postcode = input.postcode;
  const communityPoolSafety = input.communityPoolSafety;

  if (
    personalScore == null ||
    age == null ||
    postcode == null ||
    postcode.trim() === '' ||
    typeof personalScore !== 'number' ||
    typeof age !== 'number'
  ) {
    return null;
  }

  const scoreFactor = getScoreFactor(personalScore);
  const ageFactor = getAgeFactor(age);
  const postcodeFactor = getPostcodeFactor(postcode);

  const estimatedPremium = BASE_PREMIUM_GBP * scoreFactor * ageFactor * postcodeFactor;
  const roundedPremium = roundToNearest10(estimatedPremium);

  const minPremium = roundToNearest10(roundedPremium * PREMIUM_RANGE_MIN_MULTIPLIER);
  const maxPremium = roundToNearest10(roundedPremium * PREMIUM_RANGE_MAX_MULTIPLIER);

  let refundRate = 0;
  if (personalScore >= REFUND_SCORE_THRESHOLD) {
    const c = clamp(communityPoolSafety ?? 0.5, 0, 1);
    const p = personalScore / 100;
    const rawRefundRate = REFUND_PERSONAL_WEIGHT * p + REFUND_COMMUNITY_WEIGHT * c;
    refundRate = clamp(
      REFUND_RATE_MIN + rawRefundRate * REFUND_RATE_RANGE,
      REFUND_RATE_MIN,
      REFUND_RATE_MAX
    );
  }

  const estimatedRefund = roundToNearest5(roundedPremium * refundRate);
  const estimatedNetCost = roundToNearest5(roundedPremium - estimatedRefund);

  return {
    estimatedPremium: roundedPremium,
    minPremium,
    maxPremium,
    refundRate,
    estimatedRefund,
    estimatedNetCost,
  };
}

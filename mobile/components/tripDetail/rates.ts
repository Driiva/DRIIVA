/**
 * The three rate shapes the scoring engine actually uses, each returning null
 * rather than a fabricated zero when its denominator is missing. Extracted
 * verbatim from mobile/app/trips/[tripId].tsx.
 */
/**
 * The three rate shapes the scoring engine actually uses.
 *
 * Braking, acceleration and cornering are penalised per MILE; phone handling
 * is penalised per TEN MINUTES (see computePhoneUsageScore); speeding is a
 * share of the drive's duration. Showing all five as one unit would be tidier
 * and would misrepresent four of them.
 *
 * Each returns null rather than a zero or an Infinity when its denominator is
 * missing. A trip with no distance has no per-mile rate, and printing "0.0/mi"
 * for it is a fabricated reading.
 */
export function perMile(count: number, miles: number): string | null {
  if (!Number.isFinite(miles) || miles < 0.1) return null;
  return `${(count / miles).toFixed(1)} per mile`;
}

export function perTenMinutes(count: number, durationSeconds: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 60) return null;
  return `${((count / durationSeconds) * 600).toFixed(1)} per 10 min`;
}

export function shareOfDrive(seconds: number, durationSeconds: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return `${((seconds / durationSeconds) * 100).toFixed(1)}% of the drive`;
}


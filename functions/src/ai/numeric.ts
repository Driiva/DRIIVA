/**
 * Numeric and timing helpers shared by the trip-analyser steps.
 * Extracted verbatim from functions/src/ai/tripAnalysis.ts.
 */
// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return round2(sorted[lower]);
  return round2(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

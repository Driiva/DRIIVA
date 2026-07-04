import { z } from 'zod';

/** A single driving-behaviour component score, 0-100 inclusive. */
const scoreComponent = z.number().int().min(0).max(100);

/**
 * SCORE BREAKDOWN
 * ===============
 * Matches the literal shape returned by `computeDrivingScore` and its
 * `getDefaultMetrics` fallback in `functions/src/utils/helpers.ts`
 * (~L280-300, ~L481-487). The M0 scoring package (Task 2) must emit exactly
 * this shape - field names and order are canonical, not illustrative.
 */
export const ScoreBreakdownSchema = z.object({
  speedScore: scoreComponent,
  brakingScore: scoreComponent,
  accelerationScore: scoreComponent,
  corneringScore: scoreComponent,
  phoneUsageScore: scoreComponent,
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

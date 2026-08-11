/**
 * USE FEATURE FLAGS HOOK
 * ======================
 * Lightweight feature flag system driven by VITE_FEATURE_* env vars.
 *
 * Usage:
 * ```tsx
 * const { aiInsights } = useFeatureFlags();
 * if (aiInsights) { ... }
 * ```
 */

export interface FeatureFlags {
  /** Enable AI-powered trip analysis and insights (Claude Sonnet 4) */
  aiInsights: boolean;
}

/**
 * Read feature flags from Vite environment variables.
 *
 * Each flag maps to a VITE_FEATURE_* variable.  Variables are evaluated as
 * booleans: the string "true" (case-insensitive) enables the flag; any other
 * value (including undefined) disables it.
 */
export function useFeatureFlags(): FeatureFlags {
  return {
    aiInsights: import.meta.env.VITE_FEATURE_AI_INSIGHTS?.toLowerCase() === 'true',
  };
}

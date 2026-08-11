/**
 * FEATURE FLAG TESTS
 * ==================
 * Tests for the feature flag system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useFeatureFlags', () => {
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    // Restore original env
    Object.keys(import.meta.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete (import.meta.env as Record<string, string>)[key];
      }
    });
    Object.assign(import.meta.env, originalEnv);
  });

  it('reads VITE_FEATURE_AI_INSIGHTS as boolean', async () => {
    (import.meta.env as Record<string, string>).VITE_FEATURE_AI_INSIGHTS = 'true';
    const { useFeatureFlags } = await import('@/hooks/useFeatureFlags');
    const flags = useFeatureFlags();
    expect(flags.aiInsights).toBe(true);
  });

  it('treats "false" string as disabled', async () => {
    (import.meta.env as Record<string, string>).VITE_FEATURE_AI_INSIGHTS = 'false';
    const { useFeatureFlags } = await import('@/hooks/useFeatureFlags');
    const flags = useFeatureFlags();
    expect(flags.aiInsights).toBe(false);
  });

  it('treats undefined as disabled', async () => {
    delete (import.meta.env as Record<string, string>).VITE_FEATURE_AI_INSIGHTS;
    const { useFeatureFlags } = await import('@/hooks/useFeatureFlags');
    const flags = useFeatureFlags();
    expect(flags.aiInsights).toBe(false);
  });

  it('is case-insensitive', async () => {
    (import.meta.env as Record<string, string>).VITE_FEATURE_AI_INSIGHTS = 'TRUE';
    const { useFeatureFlags } = await import('@/hooks/useFeatureFlags');
    const flags = useFeatureFlags();
    expect(flags.aiInsights).toBe(true);
  });
});

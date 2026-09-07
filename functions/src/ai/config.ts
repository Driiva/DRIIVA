/**
 * Model, retry and cost configuration for the Claude trip analyser, plus the
 * lazily-initialised client. Extracted verbatim from
 * functions/src/ai/tripAnalysis.ts.
 */
import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
export const MAX_TOKENS = 1500;

/** Retry config */
export const MAX_RETRIES = 3;
export const INITIAL_BACKOFF_MS = 1000; // 1 s → 2 s → 4 s

/**
 * Estimated cost per token (USD) for claude-sonnet-4-20250514.
 * Input: $3/M tokens, Output: $15/M tokens.
 * Stored as USD cents per token × 100000 for integer math.
 */
export const COST_INPUT_PER_M = 300;   // $3.00 per million input tokens
export const COST_OUTPUT_PER_M = 1500; // $15.00 per million output tokens

/** Lazy-initialised Anthropic client (avoids crash when env var is missing). */
let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. ' +
        'Run: firebase functions:secrets:set ANTHROPIC_API_KEY'
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}


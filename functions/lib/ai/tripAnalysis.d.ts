/**
 * AI TRIP ANALYSIS - Claude Sonnet 4 Integration
 * ================================================
 * Advanced trip scoring using Anthropic's Claude API.
 *
 * Pipeline:
 *   1. Prepare a structured summary of the trip telemetry
 *   2. Call Claude with a carefully engineered prompt (with retry + backoff)
 *   3. Parse the structured JSON response
 *   4. Store full insight in tripAiInsights/{tripId}
 *   5. Embed analysis on trips/{tripId}.aiAnalysis for fast reads
 *   6. Track API usage/cost in aiUsageTracking collection
 *
 * The analysis is always **non-blocking**: the driver sees the basic
 * algorithmic score immediately, and AI insights are layered on
 * asynchronously (typically < 5 s).
 *
 * Error handling:
 *   - 3 retries with exponential backoff (1 s → 2 s → 4 s)
 *   - Falls back to algorithmic score on failure
 *   - All errors logged to Firebase + tracked in aiUsageTracking
 *
 * Cost control:
 *   - claude-sonnet-4-20250514 (cost-efficient reasoning model)
 *   - Trip data summarised/compressed (no raw GPS dump)
 *   - max_tokens capped at 1 500
 *   - Per-call cost tracked in Firestore for monitoring
 */
import { TripDocument, TripPoint, DrivingProfileData } from '../types';
/**
 * Analyse a completed trip with Claude Sonnet 4.
 *
 * @param tripId     Firestore document ID
 * @param trip       The completed trip document
 * @param points     Raw GPS points (used for speed/acceleration profiling)
 * @param profile    The driver's current profile (for historical comparison)
 * @returns          The stored insight document ID, or null if skipped/failed
 */
export declare function analyzeTrip(tripId: string, trip: TripDocument, points: TripPoint[], profile: DrivingProfileData): Promise<string | null>;
//# sourceMappingURL=tripAnalysis.d.ts.map
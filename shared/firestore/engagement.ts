/**
 * AI feedback events and reward milestones.
 * Extracted verbatim from shared/firestore-types.ts, which re-exports this
 * module so every existing import keeps working.
 */

import type { Timestamp } from './timestamp';

// ============================================================================
// AI FEEDBACK EVENTS COLLECTION
// ============================================================================

/**
 * Logged each time the AI driving coach widget fires.
 * Collection: ai_feedback_events/{eventId}
 */
export interface AIFeedbackEvent {
  eventId: string;
  tripId: string;
  userId: string;
  source: 'round_robin' | 'api';
  modelUsed: string | null;
  responseMs: number;
  commentIndex?: number;
  createdAt: Timestamp;
}

// ============================================================================
// REWARD MILESTONES COLLECTION
// ============================================================================

export type RewardStatus = 'locked' | 'unlocked' | 'claimed';

/**
 * Per-user reward milestone state.
 * Collection: users/{userId}/rewardMilestones/{rewardId}
 */
export interface RewardMilestoneDocument {
  rewardId: string;
  userId: string;
  status: RewardStatus;
  unlockedAt: Timestamp | null;
  claimedAt: Timestamp | null;
  redemptionCode: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

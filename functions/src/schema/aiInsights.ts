/**
 * The Claude trip-analysis documents and the AI usage ledger.
 * Extracted verbatim from functions/src/types.ts, which re-exports this module
 * so every existing import keeps working.
 */

import type { Timestamp } from './firestoreScalars';

// ============================================================================
// AI TRIP INSIGHTS (Claude Sonnet 4 Analysis)
// ============================================================================

/** Risk level assessed by AI */
export type AIRiskLevel = 'low' | 'medium' | 'high';

/** Category of a driving pattern identified by AI */
export type DrivingPatternCategory =
  | 'speed_management'
  | 'braking_behavior'
  | 'acceleration_pattern'
  | 'cornering_technique'
  | 'following_distance'
  | 'lane_discipline'
  | 'contextual_awareness'
  | 'fatigue_risk'
  | 'general';

/** Incident type detected by AI */
export type IncidentType =
  | 'harsh_braking'
  | 'speeding'
  | 'rapid_acceleration'
  | 'sharp_turn'
  | 'phone_usage'
  | 'tailgating'
  | 'erratic_driving';

/**
 * Individual AI-identified driving pattern
 */
export interface AIPattern {
  category: DrivingPatternCategory;
  title: string;
  description: string;
  severity: AIRiskLevel;
  /** Score impact: negative means penalty, positive means bonus */
  scoreImpact: number;
}

/**
 * Specific driving incident flagged by AI
 */
export interface AIIncident {
  /**
   * WAVE H: this carried a timestamp the model invented. The analysis prompt
   * is built from aggregate counts and percentiles, never a per-event
   * timeline, so nothing on this path knows when an incident occurred. The
   * field is gone rather than filled with "Unknown".
   */
  type: IncidentType;
  severity: AIRiskLevel;
  description: string;
}

/**
 * Personalized safety tip from AI
 */
export interface AISafetyTip {
  tip: string;
  priority: 'high' | 'medium' | 'low';
  relatedCategory: DrivingPatternCategory;
}

/**
 * AI scoring adjustment: the AI's recommended score delta and reasoning
 */
export interface AIScoreAdjustment {
  /** Original algorithmic score */
  originalScore: number;
  /** AI-recommended adjusted score */
  adjustedScore: number;
  /** Delta from original (can be positive or negative) */
  delta: number;
  /** AI's reasoning for the adjustment */
  reasoning: string;
  /** Confidence in the adjustment (0-1) */
  confidence: number;
}

/**
 * Complete AI analysis for a single trip.
 *
 * Stored in two places:
 *   1. Separate collection: tripAiInsights/{tripId} (full document)
 *   2. Embedded on trip document: trips/{tripId}.aiAnalysis (subset)
 */
export interface TripAIInsightDocument {
  tripId: string;
  userId: string;

  /** Overall AI-assessed score (0-100, 100 = perfect) */
  overallScore: number;

  /** Risk level */
  riskLevel: AIRiskLevel;

  /** AI-generated summary (2-3 sentences, driver-friendly) */
  summary: string;

  /** Good driving behaviors identified */
  strengths: string[];

  /** Areas that need improvement */
  improvements: string[];

  /** Specific incidents flagged during the trip */
  specificIncidents: AIIncident[];

  /** Identified driving patterns (detailed breakdown) */
  patterns: AIPattern[];

  /** Personalized safety tips */
  safetyTips: string[];

  /** Comparison to driver's personal average */
  comparisonToAverage: string;

  /** Score adjustment recommendation */
  scoreAdjustment: AIScoreAdjustment;

  /** Contextual factors the AI considered */
  contextFactors: {
    timeOfDay: string;
    dayOfWeek: string;
    isNightDriving: boolean;
    isRushHour: boolean;
    estimatedRoadType: string;
    weatherConsideration: string | null;
  };

  /** Comparison to driver's historical patterns */
  historicalComparison: {
    vsAverageScore: number; // delta from user's average
    trendDirection: 'improving' | 'stable' | 'declining';
    consistencyNote: string;
  };

  /** Model metadata */
  model: string;
  modelVersion: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;

  /** Timestamps */
  analyzedAt: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
}

/**
 * Embedded on trips/{tripId}.aiAnalysis after Claude analysis.
 * This is the subset stored directly on the trip document for fast reads.
 */
export interface TripAIAnalysisEmbed {
  score: number;
  riskLevel: AIRiskLevel;
  strengths: string[];
  improvements: string[];
  incidents: AIIncident[];
  tips: string[];
  comparisonToAverage: string;
  analyzedAt: Timestamp;
  modelUsed: string;
}

/**
 * API usage tracking document.
 * Collection: aiUsageTracking/{autoId}
 *
 * Tracks per-call cost and usage for monitoring Claude API spend.
 */
export interface AIUsageTrackingDocument {
  tripId: string;
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Estimated cost in USD cents (integer) */
  estimatedCostCents: number;
  latencyMs: number;
  success: boolean;
  error: string | null;
  calledAt: Timestamp;
}

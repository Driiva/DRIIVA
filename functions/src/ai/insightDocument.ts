/**
 * Step 4 of the trip analyser: turn Claude's response into the Firestore
 * insight document, with the validators that keep every enum inside its
 * declared union. Extracted verbatim from functions/src/ai/tripAnalysis.ts.
 */
import * as admin from 'firebase-admin';
import {
  TripDocument,
  TripAIInsightDocument,
  AIPattern,
  AIIncident,
  AIScoreAdjustment,
  AIRiskLevel,
  IncidentType,
  DrivingPatternCategory,
} from '../types';
import type { TripSummaryForAI, ClaudeAnalysisResponse } from './analysisTypes';
import { CLAUDE_MODEL } from './config';
import { clamp } from './numeric';

// ---------------------------------------------------------------------------
// STEP 4: BUILD FIRESTORE DOCUMENT
// ---------------------------------------------------------------------------

export function buildInsightDocument(
  tripId: string,
  trip: TripDocument,
  summary: TripSummaryForAI,
  analysis: ClaudeAnalysisResponse,
  promptTokens: number,
  completionTokens: number,
  latencyMs: number,
): TripAIInsightDocument {
  const now = admin.firestore.Timestamp.now();

  // Validate and clamp core fields
  const overallScore = clamp(analysis.overallScore ?? trip.score, 0, 100);
  const riskLevel = validateRiskLevel(analysis.riskLevel);
  const adjustedScore = clamp(analysis.scoreAdjustment?.adjustedScore ?? overallScore, 0, 100);

  // Strengths & improvements - simple string arrays
  const strengths = (analysis.strengths || [])
    .slice(0, 5)
    .map(s => String(s).trim())
    .filter(s => s.length > 0);

  const improvements = (analysis.improvements || [])
    .slice(0, 4)
    .map(s => String(s).trim())
    .filter(s => s.length > 0);

  // Specific incidents
  const specificIncidents: AIIncident[] = (analysis.specificIncidents || [])
    .slice(0, 10)
    .map(inc => ({
      // WAVE H: this carried a `timestamp` the model produced, e.g. "3 min
      // into trip". The prompt only ever supplied aggregate counts and
      // percentiles, never a per-event timeline, so the model could not know
      // when anything happened and was generating a plausible moment. The
      // incidents themselves are supported by the metrics; their timing was
      // not, so it is gone rather than shown as "Unknown".
      type: validateIncidentType(inc.type),
      severity: validateRiskLevel(inc.severity),
      description: String(inc.description || 'Incident detected'),
    }));

  // Patterns (detailed breakdown)
  const patterns: AIPattern[] = (analysis.patterns || []).slice(0, 5).map(p => ({
    category: validatePatternCategory(p.category),
    title: String(p.title || 'Pattern detected'),
    description: String(p.description || ''),
    severity: validateRiskLevel(p.severity),
    scoreImpact: clamp(p.scoreImpact ?? 0, -20, 20),
  }));

  // Safety tips - simple string array
  const safetyTips = (analysis.safetyTips || [])
    .slice(0, 5)
    .map(s => String(s).trim())
    .filter(s => s.length > 0);

  // Comparison to average
  const comparisonToAverage = String(analysis.comparisonToAverage || 'Similar to your average performance.');

  // Score adjustment
  const scoreAdjustment: AIScoreAdjustment = {
    originalScore: trip.score,
    adjustedScore,
    delta: adjustedScore - trip.score,
    reasoning: String(analysis.scoreAdjustment?.reasoning || 'Score within expected range.'),
    confidence: clamp(analysis.scoreAdjustment?.confidence ?? 0.7, 0, 1),
  };

  return {
    tripId,
    userId: trip.userId,
    overallScore,
    riskLevel,
    summary: comparisonToAverage, // Use comparisonToAverage as the summary
    strengths,
    improvements,
    specificIncidents,
    patterns,
    safetyTips,
    comparisonToAverage,
    scoreAdjustment,
    contextFactors: {
      timeOfDay: summary.context.timeOfDay,
      dayOfWeek: summary.context.dayOfWeek,
      isNightDriving: summary.context.isNightDriving,
      isRushHour: summary.context.isRushHour,
      estimatedRoadType: String(analysis.contextFactors?.estimatedRoadType || 'mixed'),
      weatherConsideration: analysis.contextFactors?.weatherConsideration || null,
    },
    historicalComparison: {
      vsAverageScore: analysis.historicalComparison?.vsAverageScore ?? 0,
      trendDirection: validateTrend(analysis.historicalComparison?.trendDirection),
      consistencyNote: String(
        analysis.historicalComparison?.consistencyNote || 'Insufficient data for comparison.'
      ),
    },
    model: CLAUDE_MODEL,
    modelVersion: CLAUDE_MODEL,
    promptTokens,
    completionTokens,
    latencyMs,
    analyzedAt: now,
    createdAt: now,
    createdBy: 'ai-analysis',
  };
}

// ---------------------------------------------------------------------------
// VALIDATORS
// ---------------------------------------------------------------------------

const RISK_LEVELS: AIRiskLevel[] = ['low', 'medium', 'high'];

function validateRiskLevel(value: string | undefined): AIRiskLevel {
  const lower = (value || '').toLowerCase() as AIRiskLevel;
  return RISK_LEVELS.includes(lower) ? lower : 'medium';
}

const INCIDENT_TYPES: IncidentType[] = [
  'harsh_braking', 'speeding', 'rapid_acceleration', 'sharp_turn',
  'phone_usage', 'tailgating', 'erratic_driving',
];

function validateIncidentType(value: string | undefined): IncidentType {
  const lower = (value || '').toLowerCase() as IncidentType;
  return INCIDENT_TYPES.includes(lower) ? lower : 'erratic_driving';
}

const PATTERN_CATEGORIES: DrivingPatternCategory[] = [
  'speed_management', 'braking_behavior', 'acceleration_pattern',
  'cornering_technique', 'following_distance', 'lane_discipline',
  'contextual_awareness', 'fatigue_risk', 'general',
];

function validatePatternCategory(value: string | undefined): DrivingPatternCategory {
  const lower = (value || '').toLowerCase() as DrivingPatternCategory;
  return PATTERN_CATEGORIES.includes(lower) ? lower : 'general';
}

function validateTrend(
  value: string | undefined
): 'improving' | 'stable' | 'declining' {
  const lower = (value || '').toLowerCase();
  if (lower === 'improving' || lower === 'stable' || lower === 'declining') return lower;
  return 'stable';
}


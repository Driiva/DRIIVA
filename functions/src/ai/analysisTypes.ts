/**
 * The internal shapes the trip analyser passes around: the compressed summary
 * sent to Claude, and the JSON shape Claude returns. Extracted verbatim from
 * functions/src/ai/tripAnalysis.ts.
 */

// ---------------------------------------------------------------------------
// TYPES (internal)
// ---------------------------------------------------------------------------

/** Compressed trip summary sent to Claude (much smaller than raw GPS). */
export interface TripSummaryForAI {
  tripId: string;
  distanceKm: number;
  durationMinutes: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  speedVarianceKmh: number;
  events: {
    hardBraking: number;
    hardAcceleration: number;
    speedingSeconds: number;
    sharpTurns: number;
    phonePickups: number;
  };
  algorithmicScore: number;
  scoreBreakdown: {
    speed: number;
    braking: number;
    acceleration: number;
    cornering: number;
    phoneUsage: number;
  };
  context: {
    timeOfDay: string;
    dayOfWeek: string;
    isNightDriving: boolean;
    isRushHour: boolean;
  };
  segmentation: {
    totalStops: number;
    totalSegments: number;
  } | null;
  driverHistory: {
    totalTrips: number;
    averageScore: number;
    totalMiles: number;
    riskTier: string;
    streakDays: number;
    recentTrend: 'improving' | 'stable' | 'declining';
  };
  /** Speed profile: sampled speed distribution (percentiles in km/h). */
  speedProfile: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  /** Acceleration profile: max decel / accel values. */
  accelerationProfile: {
    maxDecelMps2: number;
    maxAccelMps2: number;
    avgAbsAccelMps2: number;
  };
}

/** Shape that Claude returns (JSON mode). */
export interface ClaudeAnalysisResponse {
  overallScore: number;
  riskLevel: string;
  strengths: string[];
  improvements: string[];
  specificIncidents: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  safetyTips: string[];
  comparisonToAverage: string;
  // Extended fields
  patterns?: Array<{
    category: string;
    title: string;
    description: string;
    severity: string;
    scoreImpact: number;
  }>;
  scoreAdjustment?: {
    adjustedScore: number;
    delta: number;
    reasoning: string;
    confidence: number;
  };
  contextFactors?: {
    estimatedRoadType: string;
    weatherConsideration: string | null;
  };
  historicalComparison?: {
    vsAverageScore: number;
    trendDirection: string;
    consistencyNote: string;
  };
}


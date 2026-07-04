/**
 * SHARED TYPES FOR CLOUD FUNCTIONS
 * ================================
 * Mirrors the shared/firestore-types.ts from the main app.
 * Keep in sync with the client types.
 */
import * as admin from 'firebase-admin';
export type Timestamp = admin.firestore.Timestamp;
export type FieldValue = admin.firestore.FieldValue;
export declare const COLLECTION_NAMES: {
    readonly USERS: "users";
    readonly TRIPS: "trips";
    readonly TRIP_POINTS: "tripPoints";
    readonly TRIP_SEGMENTS: "tripSegments";
    readonly TRIP_AI_INSIGHTS: "tripAiInsights";
    readonly AI_USAGE_TRACKING: "aiUsageTracking";
    readonly POLICIES: "policies";
    readonly COMMUNITY_POOL: "communityPool";
    readonly POOL_SHARES: "poolShares";
    readonly LEADERBOARD: "leaderboard";
    readonly COUNTERS: "counters";
};
export type RiskTier = 'low' | 'medium' | 'high';
export type PolicyStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended';
export type CoverageType = 'basic' | 'standard' | 'premium';
export type TripStatus = 'recording' | 'processing' | 'completed' | 'failed' | 'disputed';
export type PoolShareStatus = 'active' | 'finalized' | 'paid_out';
export type LeaderboardPeriodType = 'weekly' | 'monthly' | 'all_time';
export interface ScoreBreakdown {
    speedScore: number;
    brakingScore: number;
    accelerationScore: number;
    corneringScore: number;
    phoneUsageScore: number;
}
export interface DrivingProfileData {
    currentScore: number;
    scoreBreakdown: ScoreBreakdown;
    totalTrips: number;
    totalMiles: number;
    totalDrivingMinutes: number;
    lastTripAt: Timestamp | null;
    streakDays: number;
    riskTier: RiskTier;
}
export interface TripLocation {
    lat: number;
    lng: number;
    address: string | null;
    placeType: 'home' | 'work' | 'other' | null;
}
export interface TripEvents {
    hardBrakingCount: number;
    hardAccelerationCount: number;
    speedingSeconds: number;
    sharpTurnCount: number;
    phonePickupCount: number;
}
export interface TripAnomalyFlags {
    hasGpsJumps: boolean;
    hasImpossibleSpeed: boolean;
    isDuplicate: boolean;
    flaggedForReview: boolean;
}
export interface TripContext {
    weatherCondition: string | null;
    isNightDriving: boolean;
    isRushHour: boolean;
}
export interface TripDocument {
    tripId: string;
    userId: string;
    startedAt: Timestamp;
    endedAt: Timestamp;
    durationSeconds: number;
    startLocation: TripLocation;
    endLocation: TripLocation;
    distanceMeters: number;
    score: number;
    scoreBreakdown: ScoreBreakdown;
    events: TripEvents;
    anomalies: TripAnomalyFlags;
    status: TripStatus;
    processedAt: Timestamp | null;
    context: TripContext | null;
    createdAt: Timestamp;
    createdBy: string;
    pointsCount: number;
    segmentation?: TripSegmentationSummary;
}
export interface RecentTripSummary {
    tripId: string;
    startedAt: Timestamp;
    endedAt: Timestamp;
    distanceMiles: number;
    durationMinutes: number;
    score: number;
    routeSummary: string;
}
export interface PoolShareSummary {
    currentShareCents: number;
    contributionCents: number;
    sharePercentage: number;
    lastUpdatedAt: Timestamp;
}
export interface ActivePolicySummary {
    policyId: string;
    policyNumber: string;
    status: PolicyStatus;
    premiumCents: number;
    coverageType: CoverageType;
    renewalDate: Timestamp;
}
export interface UserDocument {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    phoneNumber: string | null;
    age?: number;
    postcode?: string;
    vehicle?: {
        vin: string | null;
        make: string;
        model: string;
        year: number;
        color: string | null;
    } | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    drivingProfile: DrivingProfileData;
    activePolicy: ActivePolicySummary | null;
    poolShare: PoolShareSummary;
    recentTrips: RecentTripSummary[];
    fcmTokens: string[];
    settings: {
        notificationsEnabled: boolean;
        autoTripDetection: boolean;
        unitSystem: 'imperial' | 'metric';
    };
    createdBy: string;
    updatedBy: string;
}
export interface PolicyDocument {
    policyId: string;
    userId: string;
    policyNumber: string;
    status: PolicyStatus;
    coverageType: CoverageType;
    coverageDetails: {
        liabilityLimitCents: number;
        collisionDeductibleCents: number;
        comprehensiveDeductibleCents: number;
        includesRoadside: boolean;
        includesRental: boolean;
    };
    basePremiumCents: number;
    currentPremiumCents: number;
    discountPercentage: number;
    effectiveDate: Timestamp;
    expirationDate: Timestamp;
    renewalDate: Timestamp | null;
    vehicle: {
        vin: string | null;
        make: string;
        model: string;
        year: number;
        color: string | null;
    } | null;
    billingCycle: 'monthly' | 'quarterly' | 'annual';
    stripeSubscriptionId: string | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
    updatedBy: string;
}
export interface PoolShareDocument {
    shareId: string;
    poolPeriod: string;
    userId: string;
    contributionCents: number;
    contributionCount: number;
    sharePercentage: number;
    weightedScore: number;
    baseRefundCents: number;
    projectedRefundCents: number;
    status: PoolShareStatus;
    eligibleForRefund: boolean;
    tripsIncluded: number;
    milesIncluded: number;
    averageScore: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    finalizedAt: Timestamp | null;
}
export interface CommunityPoolDocument {
    poolId: string;
    totalPoolCents: number;
    totalContributionsCents: number;
    totalPayoutsCents: number;
    reserveCents: number;
    activeParticipants: number;
    totalParticipantsEver: number;
    averagePoolScore: number;
    safetyFactor: number;
    claimsThisPeriod: number;
    periodStart: Timestamp;
    periodEnd: Timestamp;
    periodType: 'monthly' | 'quarterly';
    projectedRefundRate: number;
    lastCalculatedAt: Timestamp;
    version: number;
}
export interface LeaderboardRanking {
    rank: number;
    userId: string;
    displayName: string;
    photoURL: string | null;
    score: number;
    totalMiles: number;
    totalTrips: number;
    change: number;
}
export interface LeaderboardDocument {
    leaderboardId: string;
    period: string;
    periodType: LeaderboardPeriodType;
    rankings: LeaderboardRanking[];
    totalParticipants: number;
    averageScore: number;
    medianScore: number;
    calculatedAt: Timestamp;
    nextCalculationAt: Timestamp;
}
/**
 * Single GPS/sensor data point (compressed format)
 */
export interface TripPoint {
    t: number;
    lat: number;
    lng: number;
    spd: number;
    hdg: number;
    acc: number;
    ax?: number;
    ay?: number;
    az?: number;
    gx?: number;
    gy?: number;
    gz?: number;
}
/**
 * Trip points document
 * Collection: tripPoints/{tripId}
 */
export interface TripPointsDocument {
    tripId: string;
    userId: string;
    points: TripPoint[];
    samplingRateHz: number;
    totalPoints: number;
    compressedSize: number;
    createdAt: Timestamp;
}
/**
 * Computed trip metrics from GPS points
 */
export interface ComputedTripMetrics {
    distanceMeters: number;
    durationSeconds: number;
    avgSpeedMps: number;
    maxSpeedMps: number;
    score: number;
    scoreBreakdown: ScoreBreakdown;
    events: TripEvents;
}
/**
 * Detected stop interval from GPS trajectory analysis
 */
export interface DetectedStop {
    startTime: number;
    endTime: number;
    durationSeconds: number;
    centerX: number;
    centerY: number;
    centerLat?: number;
    centerLng?: number;
}
/**
 * Detected trip segment from GPS trajectory analysis
 */
export interface DetectedTripSegment {
    startTime: number;
    endTime: number;
    durationSeconds: number;
}
/**
 * Classification summary
 */
export interface ClassificationSummary {
    totalPoints: number;
    totalStops: number;
    totalTrips: number;
    classificationSuccess: boolean;
    centerLat?: number;
    centerLng?: number;
    error?: string;
}
/**
 * Trip segmentation document
 * Collection: tripSegments/{tripId}
 */
export interface TripSegmentsDocument {
    tripId: string;
    userId: string;
    stops: DetectedStop[];
    trips: DetectedTripSegment[];
    summary: ClassificationSummary;
    classifiedAt: Timestamp;
    classifierVersion: string;
}
/**
 * Embedded segmentation summary on trip document
 */
export interface TripSegmentationSummary {
    totalStops: number;
    totalSegments: number;
    classifiedAt: Timestamp;
    hasSignificantStops: boolean;
}
/** Risk level assessed by AI */
export type AIRiskLevel = 'low' | 'medium' | 'high';
/** Category of a driving pattern identified by AI */
export type DrivingPatternCategory = 'speed_management' | 'braking_behavior' | 'acceleration_pattern' | 'cornering_technique' | 'following_distance' | 'lane_discipline' | 'contextual_awareness' | 'fatigue_risk' | 'general';
/** Incident type detected by AI */
export type IncidentType = 'harsh_braking' | 'speeding' | 'rapid_acceleration' | 'sharp_turn' | 'phone_usage' | 'tailgating' | 'erratic_driving';
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
    /** ISO 8601 timestamp or offset description */
    timestamp: string;
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
        vsAverageScore: number;
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
//# sourceMappingURL=types.d.ts.map
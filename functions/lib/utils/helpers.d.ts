/**
 * HELPER UTILITIES
 * ================
 * Shared helper functions for Cloud Functions.
 */
import * as admin from 'firebase-admin';
import { TripLocation } from '../types';
import { haversineMeters } from '../shared/tripProcessor';
/**
 * Get current pool period string (e.g., "2026-02")
 */
export declare function getCurrentPoolPeriod(): string;
/**
 * Get previous pool period string
 */
export declare function getPreviousPoolPeriod(): string;
/**
 * Get share ID for a user and period
 */
export declare function getShareId(userId: string, period: string): string;
/**
 * Get ISO week number
 */
export declare function getWeekNumber(date: Date): number;
/**
 * ISO week period ID, e.g. "2026-W06".
 *
 * Uses the ISO week-year (the calendar year of the week's Thursday), NOT the
 * calendar year of the date itself. 31 Dec 2026 belongs to 2026-W53; 1 Jan
 * 2027 also belongs to 2026-W53. Mirrored by getCurrentWeekPeriod in
 * client/src/hooks/useCommunityData.ts - change both or neither.
 */
export declare function getIsoWeekPeriod(date: Date): string;
/**
 * Get period string for leaderboard type
 */
export declare function getCurrentPeriodForType(periodType: string): string;
/**
 * Calculate weighted average
 */
export declare function weightedAverage(oldValue: number, newValue: number, oldWeight: number): number;
/**
 * Build route summary string
 */
export declare function buildRouteSummary(start: TripLocation, end: TripLocation): string;
/**
 * Truncate address for display
 */
export declare function truncateAddress(address: string | null): string;
/**
 * Calculate distance between two coordinates using Haversine formula.
 * Delegates to the canonical shared/tripProcessor.ts implementation.
 */
export declare const calculateDistance: typeof haversineMeters;
/**
 * Check if timestamp is during night hours (10 PM - 6 AM)
 */
export declare function isNightTime(timestamp: admin.firestore.Timestamp): boolean;
/**
 * Check if timestamp is during rush hour (7-9 AM or 4-7 PM on weekdays)
 */
export declare function isRushHour(timestamp: admin.firestore.Timestamp): boolean;
/**
 * Detect anomalies in trip data
 */
export declare function detectAnomalies(trip: {
    distanceMeters: number;
    durationSeconds: number;
    startLocation: TripLocation;
    endLocation: TripLocation;
}): {
    hasGpsJumps: boolean;
    hasImpossibleSpeed: boolean;
    isDuplicate: boolean;
    flaggedForReview: boolean;
};
/**
 * Calculate risk tier based on score
 */
export declare function calculateRiskTier(score: number): 'low' | 'medium' | 'high';
/**
 * Calculate projected refund based on score and contribution.
 * Delegates to shared/refundCalculator.ts - the single source of truth.
 */
export declare function calculateProjectedRefund(score: number, contributionCents: number, safetyFactor: number, _refundRate: number): number;
//# sourceMappingURL=helpers.d.ts.map
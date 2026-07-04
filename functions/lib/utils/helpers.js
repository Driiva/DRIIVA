"use strict";
/**
 * HELPER UTILITIES
 * ================
 * Shared helper functions for Cloud Functions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDistance = void 0;
exports.getCurrentPoolPeriod = getCurrentPoolPeriod;
exports.getPreviousPoolPeriod = getPreviousPoolPeriod;
exports.getShareId = getShareId;
exports.getWeekNumber = getWeekNumber;
exports.getCurrentPeriodForType = getCurrentPeriodForType;
exports.weightedAverage = weightedAverage;
exports.buildRouteSummary = buildRouteSummary;
exports.truncateAddress = truncateAddress;
exports.isNightTime = isNightTime;
exports.isRushHour = isRushHour;
exports.detectAnomalies = detectAnomalies;
exports.calculateRiskTier = calculateRiskTier;
exports.calculateProjectedRefund = calculateProjectedRefund;
const tripProcessor_1 = require("../shared/tripProcessor");
const refundCalculator_1 = require("../shared/refundCalculator");
/**
 * Get current pool period string (e.g., "2026-02")
 */
function getCurrentPoolPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
/**
 * Get previous pool period string
 */
function getPreviousPoolPeriod() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
}
/**
 * Get share ID for a user and period
 */
function getShareId(userId, period) {
    return `${period}_${userId}`;
}
/**
 * Get ISO week number
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
/**
 * Get period string for leaderboard type
 */
function getCurrentPeriodForType(periodType) {
    const now = new Date();
    switch (periodType) {
        case 'weekly':
            const weekNum = getWeekNumber(now);
            return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        case 'monthly':
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        case 'all_time':
            return 'all_time';
        default:
            return getCurrentPoolPeriod();
    }
}
/**
 * Calculate weighted average
 */
function weightedAverage(oldValue, newValue, oldWeight) {
    if (oldWeight === 0)
        return newValue;
    const result = (oldValue * oldWeight + newValue) / (oldWeight + 1);
    return Math.round(result * 100) / 100;
}
/**
 * Build route summary string
 */
function buildRouteSummary(start, end) {
    const startLabel = start.placeType
        ? start.placeType.charAt(0).toUpperCase() + start.placeType.slice(1)
        : truncateAddress(start.address);
    const endLabel = end.placeType
        ? end.placeType.charAt(0).toUpperCase() + end.placeType.slice(1)
        : truncateAddress(end.address);
    return `${startLabel} → ${endLabel}`;
}
/**
 * Truncate address for display
 */
function truncateAddress(address) {
    if (!address)
        return 'Unknown';
    const parts = address.split(',');
    const firstPart = parts[0].trim();
    return firstPart.length > 20 ? firstPart.substring(0, 17) + '...' : firstPart;
}
/**
 * Calculate distance between two coordinates using Haversine formula.
 * Delegates to the canonical shared/tripProcessor.ts implementation.
 */
exports.calculateDistance = tripProcessor_1.haversineMeters;
/**
 * Check if timestamp is during night hours (10 PM - 6 AM)
 */
function isNightTime(timestamp) {
    const date = timestamp.toDate();
    const hour = date.getHours();
    return hour >= 22 || hour < 6;
}
/**
 * Check if timestamp is during rush hour (7-9 AM or 4-7 PM on weekdays)
 */
function isRushHour(timestamp) {
    const date = timestamp.toDate();
    const day = date.getDay();
    const hour = date.getHours();
    // Weekdays only
    if (day === 0 || day === 6)
        return false;
    // Morning rush: 7-9 AM
    if (hour >= 7 && hour < 9)
        return true;
    // Evening rush: 4-7 PM
    if (hour >= 16 && hour < 19)
        return true;
    return false;
}
/**
 * Detect anomalies in trip data
 */
function detectAnomalies(trip) {
    const anomalies = {
        hasGpsJumps: false,
        hasImpossibleSpeed: false,
        isDuplicate: false,
        flaggedForReview: false,
    };
    // Check for impossible speed (> 200 mph average)
    if (trip.durationSeconds > 0) {
        const avgSpeedMph = (trip.distanceMeters / 1609.34) / (trip.durationSeconds / 3600);
        if (avgSpeedMph > 200) {
            anomalies.hasImpossibleSpeed = true;
            anomalies.flaggedForReview = true;
        }
    }
    // Check for GPS jumps (straight-line distance much less than route distance)
    const straightLineDistance = (0, exports.calculateDistance)(trip.startLocation.lat, trip.startLocation.lng, trip.endLocation.lat, trip.endLocation.lng);
    // If route is more than 5x the straight-line distance, might have GPS issues
    if (trip.distanceMeters > straightLineDistance * 5 && straightLineDistance > 100) {
        anomalies.hasGpsJumps = true;
        // Only flag for review if the discrepancy is extreme
        if (trip.distanceMeters > straightLineDistance * 10) {
            anomalies.flaggedForReview = true;
        }
    }
    return anomalies;
}
/**
 * Calculate risk tier based on score
 */
function calculateRiskTier(score) {
    if (score >= 80)
        return 'low';
    if (score >= 60)
        return 'medium';
    return 'high';
}
/**
 * Calculate projected refund based on score and contribution.
 * Delegates to shared/refundCalculator.ts - the single source of truth.
 */
function calculateProjectedRefund(score, contributionCents, safetyFactor, _refundRate) {
    const communityScore = 75;
    return (0, refundCalculator_1.calculateRefundCents)(score, communityScore, contributionCents, safetyFactor, contributionCents);
}
// Trip-metrics computation (computeTripMetrics + its private helpers) moved to
// @driiva/scoring - see functions/src/scoring/tripMetrics.ts (vendored copy,
// see that file's header) and functions/src/triggers/trips.ts's import.
//# sourceMappingURL=helpers.js.map
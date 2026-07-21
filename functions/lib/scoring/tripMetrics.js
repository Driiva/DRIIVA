"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORE_WEIGHTS = void 0;
exports.haversineMeters = haversineMeters;
exports.computeTripMetrics = computeTripMetrics;
/**
 * Composite score weights. Single source of truth for both the algorithm
 * (computeDrivingScore, below) and any UI that shows the weighting to a user
 * (trip-detail's score breakdown). Values are byte-identical to the previous
 * inline literals (25/25/20/20/10) - extracting them changes nothing about
 * the computed score, it just makes algorithm and display impossible to drift
 * apart. These must sum to 1.0.
 */
exports.SCORE_WEIGHTS = {
    speed: 0.25,
    braking: 0.25,
    acceleration: 0.2,
    cornering: 0.2,
    phoneUsage: 0.1,
};
/**
 * Haversine distance between two WGS84 points, in meters.
 * Ported verbatim from `shared/tripProcessor.ts`.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    // Near-antipodal pairs can round `a` fractionally above 1, making
    // Math.sqrt(1 - a) take the root of a negative number and return NaN. Clamp
    // to [0, 1] before the sqrt. Unreachable by sequential trip points (metres
    // apart), but cheap and correct.
    const aClamped = Math.min(1, Math.max(0, a));
    const c = 2 * Math.atan2(Math.sqrt(aClamped), Math.sqrt(1 - aClamped));
    return R * c;
}
/**
 * Calculate distance between two coordinates using Haversine formula.
 * Ported verbatim from `functions/src/utils/helpers.ts:109`.
 */
const calculateDistance = haversineMeters;
/**
 * Compute trip metrics from raw GPS points.
 * This is the core algorithm that processes GPS data to derive metrics and
 * scores. Frozen signature (M0 Task 2 brief).
 */
function computeTripMetrics(points) {
    if (points.length < 2) {
        return getDefaultMetrics();
    }
    // Sort points by timestamp
    const sortedPoints = [...points].sort((a, b) => a.t - b.t);
    // 1. Compute distance using Haversine between sequential points
    let totalDistanceMeters = 0;
    for (let i = 1; i < sortedPoints.length; i++) {
        const prev = sortedPoints[i - 1];
        const curr = sortedPoints[i];
        totalDistanceMeters += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    }
    // 2. Compute duration from first to last point
    const firstPoint = sortedPoints[0];
    const lastPoint = sortedPoints[sortedPoints.length - 1];
    const durationMs = lastPoint.t - firstPoint.t;
    const durationSeconds = Math.max(1, Math.round(durationMs / 1000)); // At least 1 second
    // 3. Compute speed statistics
    const { avgSpeedMps, maxSpeedMps, speedVariance } = computeSpeedStats(sortedPoints);
    // 4. Detect driving events
    const events = detectDrivingEvents(sortedPoints);
    // 5. Compute driving score
    const { score, scoreBreakdown } = computeDrivingScore(sortedPoints, events, speedVariance, avgSpeedMps, totalDistanceMeters, durationSeconds);
    return {
        distanceMeters: Math.round(totalDistanceMeters),
        durationSeconds,
        avgSpeedMps,
        maxSpeedMps,
        score,
        scoreBreakdown,
        events,
    };
}
/**
 * Default metrics for trips with insufficient data
 */
function getDefaultMetrics() {
    return {
        distanceMeters: 0,
        durationSeconds: 0,
        avgSpeedMps: 0,
        maxSpeedMps: 0,
        score: 70, // Default neutral score
        scoreBreakdown: {
            speedScore: 70,
            brakingScore: 70,
            accelerationScore: 70,
            corneringScore: 70,
            phoneUsageScore: 100,
        },
        events: {
            hardBrakingCount: 0,
            hardAccelerationCount: 0,
            speedingSeconds: 0,
            sharpTurnCount: 0,
            phonePickupCount: 0,
        },
    };
}
/**
 * Compute speed statistics from points
 */
function computeSpeedStats(points) {
    if (points.length === 0) {
        return { avgSpeedMps: 0, maxSpeedMps: 0, speedVariance: 0 };
    }
    // Convert spd from integer (m/s * 100) to m/s
    const speeds = points
        .map(p => p.spd / 100) // Convert to actual m/s
        .filter(s => s >= 0 && s < 100); // Filter unreasonable speeds (< 360 km/h)
    if (speeds.length === 0) {
        return { avgSpeedMps: 0, maxSpeedMps: 0, speedVariance: 0 };
    }
    const avgSpeedMps = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
    const maxSpeedMps = Math.max(...speeds);
    // Calculate variance
    const variance = speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeedMps, 2), 0) / speeds.length;
    const speedVariance = Math.sqrt(variance);
    return {
        avgSpeedMps: Math.round(avgSpeedMps * 100) / 100,
        maxSpeedMps: Math.round(maxSpeedMps * 100) / 100,
        speedVariance: Math.round(speedVariance * 100) / 100,
    };
}
/**
 * Detect driving events from GPS points
 */
function detectDrivingEvents(points) {
    const events = {
        hardBrakingCount: 0,
        hardAccelerationCount: 0,
        speedingSeconds: 0,
        sharpTurnCount: 0,
        phonePickupCount: 0,
    };
    if (points.length < 2) {
        return events;
    }
    // Thresholds
    const HARD_BRAKING_THRESHOLD = -3.5; // m/s² (deceleration)
    const HARD_ACCEL_THRESHOLD = 3.0; // m/s² (acceleration)
    const SHARP_TURN_THRESHOLD = 30; // degrees per second
    const SPEED_LIMIT_MPS = 31.3; // ~70 mph in m/s
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        // Time delta in seconds
        const dt = (curr.t - prev.t) / 1000;
        if (dt <= 0 || dt > 10)
            continue; // Skip invalid intervals
        // Speed values (convert from integer format)
        const prevSpeed = prev.spd / 100;
        const currSpeed = curr.spd / 100;
        // Calculate acceleration (m/s²)
        const acceleration = (currSpeed - prevSpeed) / dt;
        // Hard braking detection
        if (acceleration < HARD_BRAKING_THRESHOLD) {
            events.hardBrakingCount++;
        }
        // Hard acceleration detection
        if (acceleration > HARD_ACCEL_THRESHOLD) {
            events.hardAccelerationCount++;
        }
        // Speeding detection
        if (currSpeed > SPEED_LIMIT_MPS) {
            events.speedingSeconds += Math.round(dt);
        }
        // Sharp turn detection (heading change rate)
        const headingDelta = Math.abs(normalizeHeadingDelta(curr.hdg - prev.hdg));
        const headingRate = headingDelta / dt;
        if (headingRate > SHARP_TURN_THRESHOLD && currSpeed > 5) {
            events.sharpTurnCount++;
        }
    }
    return events;
}
/**
 * Compute phone usage score from pickup count and trip duration.
 * Rate = pickups per 10 minutes; score = max(20, 100 − rate × 16).
 * 0 pickups → 100 | 1/10 min → 84 | 5+/10 min → 20 (floor)
 */
function computePhoneUsageScore(phonePickupCount, durationSeconds) {
    if (durationSeconds <= 0 || phonePickupCount <= 0)
        return 100;
    const pickupsPerTenMin = (phonePickupCount / durationSeconds) * 600;
    return Math.max(20, Math.round(100 - pickupsPerTenMin * 16));
}
/**
 * Normalize heading delta to -180 to 180 range
 */
function normalizeHeadingDelta(delta) {
    while (delta > 180)
        delta -= 360;
    while (delta < -180)
        delta += 360;
    return delta;
}
/**
 * Compute driving score from metrics and events
 *
 * Score breakdown:
 * - Speed Score (25%): Based on speed variance and compliance
 * - Braking Score (25%): Penalizes hard braking events
 * - Acceleration Score (20%): Penalizes aggressive acceleration
 * - Cornering Score (20%): Penalizes sharp turns
 * - Phone Usage Score (10%): Placeholder (no phone detection yet)
 */
function computeDrivingScore(points, events, speedVariance, avgSpeedMps, distanceMeters, durationSeconds) {
    // Normalize metrics per mile for fair comparison
    const distanceMiles = Math.max(0.1, distanceMeters / 1609.34);
    // Speed Score (25%)
    // Lower variance = better score, also penalize excessive speeding
    const speedingPenalty = Math.min(30, (events.speedingSeconds / durationSeconds) * 100);
    const variancePenalty = Math.min(20, speedVariance * 2);
    const speedScore = Math.max(0, Math.min(100, 100 - speedingPenalty - variancePenalty));
    // Braking Score (25%)
    // Penalize hard braking events (up to -5 points per event, max -50)
    const brakingEventsPerMile = events.hardBrakingCount / distanceMiles;
    const brakingPenalty = Math.min(50, brakingEventsPerMile * 10);
    const brakingScore = Math.max(0, Math.min(100, 100 - brakingPenalty));
    // Acceleration Score (20%)
    // Penalize hard acceleration events
    const accelEventsPerMile = events.hardAccelerationCount / distanceMiles;
    const accelPenalty = Math.min(50, accelEventsPerMile * 8);
    const accelerationScore = Math.max(0, Math.min(100, 100 - accelPenalty));
    // Cornering Score (20%)
    // Penalize sharp turns
    const turnEventsPerMile = events.sharpTurnCount / distanceMiles;
    const turnPenalty = Math.min(50, turnEventsPerMile * 6);
    const corneringScore = Math.max(0, Math.min(100, 100 - turnPenalty));
    // Phone Usage Score (10%)
    // Rate-based: penalise app switches during the trip
    const phoneUsageScore = computePhoneUsageScore(events.phonePickupCount, durationSeconds);
    // Calculate weighted composite score
    const score = Math.round(speedScore * exports.SCORE_WEIGHTS.speed +
        brakingScore * exports.SCORE_WEIGHTS.braking +
        accelerationScore * exports.SCORE_WEIGHTS.acceleration +
        corneringScore * exports.SCORE_WEIGHTS.cornering +
        phoneUsageScore * exports.SCORE_WEIGHTS.phoneUsage);
    return {
        score: Math.max(0, Math.min(100, score)),
        scoreBreakdown: {
            speedScore: Math.round(speedScore),
            brakingScore: Math.round(brakingScore),
            accelerationScore: Math.round(accelerationScore),
            corneringScore: Math.round(corneringScore),
            phoneUsageScore: Math.round(phoneUsageScore),
        },
    };
}
//# sourceMappingURL=tripMetrics.js.map
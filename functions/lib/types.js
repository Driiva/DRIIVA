"use strict";
/**
 * SHARED TYPES FOR CLOUD FUNCTIONS
 * ================================
 * Mirrors the shared/firestore-types.ts from the main app.
 * Keep in sync with the client types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTION_NAMES = void 0;
// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================
exports.COLLECTION_NAMES = {
    USERS: 'users',
    TRIPS: 'trips',
    TRIP_POINTS: 'tripPoints',
    TRIP_SEGMENTS: 'tripSegments',
    TRIP_AI_INSIGHTS: 'tripAiInsights',
    AI_USAGE_TRACKING: 'aiUsageTracking',
    POLICIES: 'policies',
    COMMUNITY_POOL: 'communityPool',
    POOL_SHARES: 'poolShares',
    LEADERBOARD: 'leaderboard',
    COUNTERS: 'counters',
};
//# sourceMappingURL=types.js.map
/**
 * FIRESTORE DATA MODEL TYPES
 * ==========================
 * Complete TypeScript definitions for Driiva's Firestore schema.
 *
 * Collections:
 *   - users/{userId}           → Driver profile + dashboard data
 *   - trips/{tripId}           → Trip metadata + scores
 *   - tripPoints/{tripId}      → Raw GPS points
 *   - policies/{policyId}      → Insurance policy metadata
 *   - communityPool/{poolId}   → Global pool state (singleton)
 *   - poolShares/{shareId}     → Per-driver pool share snapshots
 *   - leaderboard/{period}     → Precomputed rankings
 *
 * The definitions live one module per collection group under shared/firestore;
 * this file is the barrel every caller already imports, so the exported
 * surface is unchanged.
 */

export * from './firestore/timestamp';
export * from './firestore/enums';
export * from './firestore/users';
export * from './firestore/trips';
export * from './firestore/policies';
export * from './firestore/pool';
export * from './firestore/defaults';
export * from './firestore/engagement';

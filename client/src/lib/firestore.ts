/**
 * FIRESTORE SERVICE LAYER
 * =======================
 * CRUD operations and queries for Driiva's Firestore data model.
 *
 * Features:
 *   - Type-safe document operations
 *   - Transactional updates for consistency
 *   - Optimized queries for dashboard reads
 *   - Audit trail support
 *
 * The implementations live in one sibling module per collection group; this
 * file is the barrel every caller already imports, so the public surface is
 * unchanged. `assertFirestore` stays internal to ./firestoreClient and is
 * deliberately not re-exported here.
 */

export * from './firestoreUsers';
export * from './firestoreTrips';
export * from './firestorePolicies';
export * from './firestorePool';
export * from './firestoreOperations';

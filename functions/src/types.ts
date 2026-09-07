/**
 * SHARED TYPES FOR CLOUD FUNCTIONS
 * ================================
 * Mirrors the shared/firestore-types.ts from the main app.
 * Keep in sync with the client types.
 *
 * The definitions live one module per collection group under
 * functions/src/schema; this file is the barrel every existing import already
 * points at, so the exported surface is unchanged.
 */

export * from './schema/firestoreScalars';
export * from './schema/enums';
export * from './schema/documents';
export * from './schema/tripPoints';
export * from './schema/segmentation';
export * from './schema/aiInsights';

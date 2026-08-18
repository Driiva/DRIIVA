import { z } from 'zod';

import { ScoreBreakdownSchema } from './score-breakdown';
import { FirestoreTimestampSchema } from './timestamp';

export const PlaceTypeSchema = z.enum(['home', 'work', 'other']).nullable();

export const TripLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  placeType: PlaceTypeSchema,
});

export const TripEventsSchema = z.object({
  hardBrakingCount: z.number().int().min(0),
  hardAccelerationCount: z.number().int().min(0),
  speedingSeconds: z.number().int().min(0),
  sharpTurnCount: z.number().int().min(0),
  phonePickupCount: z.number().int().min(0),
});

export const TripAnomalyFlagsSchema = z.object({
  hasGpsJumps: z.boolean(),
  hasImpossibleSpeed: z.boolean(),
  isDuplicate: z.boolean(),
  flaggedForReview: z.boolean(),
});

export const TripContextSchema = z.object({
  weatherCondition: z.string().nullable(),
  isNightDriving: z.boolean(),
  isRushHour: z.boolean(),
});

/**
 * Embedded segmentation summary set by the Stop-Go-Classifier
 * (`functions/src/types.ts` `TripSegmentationSummary`, ~L373-378). Present
 * only on the FUNCTIONS mirror of TripDocument, not on the client copy in
 * shared/firestore-types.ts - a genuine divergence between the two
 * hand-mirrored type files. Modelled here as optional so both real shapes
 * (with and without segmentation) parse.
 */
export const TripSegmentationSummarySchema = z.object({
  totalStops: z.number().int().min(0),
  totalSegments: z.number().int().min(0),
  classifiedAt: FirestoreTimestampSchema,
  hasSignificantStops: z.boolean(),
});

/**
 * Brief text lists 4 status values (recording/processing/completed/failed),
 * but the authoritative type (shared/firestore-types.ts AND
 * functions/src/types.ts `TripStatus`) declares a 5th: 'disputed'. A repo-wide
 * grep of firestore.rules, triggers and client callers finds zero writers of
 * 'disputed' today - it is a vestige value in the type union. Pinned here
 * anyway because the schema must reflect the REAL declared type, not the
 * narrower brief summary.
 */
export const TripStatusSchema = z.enum(['recording', 'processing', 'completed', 'failed', 'disputed']);
export type TripStatus = z.infer<typeof TripStatusSchema>;

/**
 * TRIP DOCUMENT
 * =============
 * Collection: `trips/{tripId}`. Immutable after completion (score/breakdown/
 * events/anomalies/context are Cloud-Function-only per firestore.rules).
 * Source: shared/firestore-types.ts `TripDocument` (~L250-285).
 */
export const TripDocumentSchema = z.object({
  tripId: z.string(),
  userId: z.string(),
  startedAt: FirestoreTimestampSchema,
  endedAt: FirestoreTimestampSchema,
  durationSeconds: z.number().int().min(0),
  startLocation: TripLocationSchema,
  endLocation: TripLocationSchema,
  distanceMeters: z.number().int().min(0),
  score: z.number().int().min(0).max(100),
  scoreBreakdown: ScoreBreakdownSchema,
  events: TripEventsSchema,
  anomalies: TripAnomalyFlagsSchema,
  status: TripStatusSchema,
  processedAt: FirestoreTimestampSchema.nullable(),
  context: TripContextSchema.nullable(),
  createdAt: FirestoreTimestampSchema,
  createdBy: z.string(),
  pointsCount: z.number().int().min(0),
  segmentation: TripSegmentationSummarySchema.optional(),
  /**
   * Client-reported phone-pickup count, written on the recording->processing
   * transition (M2-DEC-1 Option A, docs/rebuild/m2-dec-1-phone-usage.md).
   * Deliberately separate from `events` above: firestore.rules locks
   * `events` on a client update (Cloud-Function-only), and this field is not
   * locked, so a client can report a pickup count without needing write
   * access to the authoritative events map. The server treats it as
   * untrusted input - see `sanitizePhonePickupCount` in
   * packages/scoring/src/tripMetrics.ts - not as the score itself. Optional
   * because older trips and any client that predates this never write it.
   */
  clientReportedPhonePickupCount: z.number().int().min(0).optional(),
});
export type TripDocument = z.infer<typeof TripDocumentSchema>;

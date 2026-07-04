import { z } from 'zod';

import { FirestoreTimestampSchema } from './timestamp';

/**
 * TRIP POINT
 * ==========
 * Single compressed GPS/sensor sample. Source: shared/firestore-types.ts
 * `TripPoint` (~L312-327).
 *
 * Quirks pinned as-is: `t` is an epoch-ms OFFSET from trip start (not wall
 * clock), and `spd` is an INTEGER encoded as m/s * 100 (not m/s directly) -
 * see `computeSpeedStats` in functions/src/utils/helpers.ts, which divides by
 * 100 to recover actual m/s.
 */
export const TripPointSchema = z.object({
  t: z.number().int().min(0),
  lat: z.number(),
  lng: z.number(),
  spd: z.number().int(),
  hdg: z.number().min(0).max(360),
  acc: z.number(),
  ax: z.number().optional(),
  ay: z.number().optional(),
  az: z.number().optional(),
  gx: z.number().optional(),
  gy: z.number().optional(),
  gz: z.number().optional(),
});
export type TripPoint = z.infer<typeof TripPointSchema>;

/**
 * TRIP POINTS DOCUMENT
 * ====================
 * Collection: `tripPoints/{tripId}` (trips under ~30 min / ~1800 points).
 * Source: shared/firestore-types.ts `TripPointsDocument` (~L333-345).
 * firestore.rules: create-only, no update/delete ever.
 */
export const TripPointsDocumentSchema = z.object({
  tripId: z.string(),
  userId: z.string(),
  points: z.array(TripPointSchema),
  samplingRateHz: z.number().positive(),
  totalPoints: z.number().int().min(0),
  compressedSize: z.number().int().min(0),
  createdAt: FirestoreTimestampSchema,
});
export type TripPointsDocument = z.infer<typeof TripPointsDocumentSchema>;

/**
 * TRIP POINTS BATCH
 * =================
 * Collection: `tripPoints/{tripId}/batches/{batchIndex}` (longer trips).
 * Source: shared/firestore-types.ts `TripPointsBatch` (~L351-357).
 */
export const TripPointsBatchSchema = z.object({
  tripId: z.string(),
  batchIndex: z.number().int().min(0),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  points: z.array(TripPointSchema),
});
export type TripPointsBatch = z.infer<typeof TripPointsBatchSchema>;

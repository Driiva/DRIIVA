/**
 * Trip capture and trip reads for the mobile app.
 *
 * This is the mobile twin of client/src/lib/tripService.ts. It writes the same
 * documents, in the same shapes, through the same paths, so a trip recorded on
 * a phone is scored by the existing pipeline
 * (functions/src/triggers/trips.ts -> finalizeTripFromPoints) with no
 * server-side change at all.
 *
 * Three things here are load-bearing and were each a real bug before:
 *
 * 1. EXPO GO REFUSES. lib/firebase.ts hands back a mock in Expo Go whose writes
 *    resolve without persisting. A capture screen running against it would show
 *    a recording timer, a stop button and a "trip saved" state over nothing at
 *    all. Every write path here asserts a native build first and throws, the
 *    same stance lib/waitlist.ts takes.
 *
 * 2. POINTS GO IN THE BATCHES SUBCOLLECTION, at tripPoints/{tripId}/batches/{n},
 *    not the parent document's `points` array. readTripPoints in the trigger
 *    reads the parent array first and falls back to batches; the parent array is
 *    written empty at trip start and never appended to.
 *
 * 3. SCORE FIELDS ARE NOT WRITTEN BY THE CLIENT. firestore.rules locks score,
 *    scoreBreakdown, events, anomalies and context on a client
 *    recording -> processing update. Including any of them rejects the whole
 *    batch with permission-denied and strands the trip in 'recording' forever.
 */
import { firestore, isExpoGo } from './firebase';
import { track } from '@/lib/analytics';
import { haversineMeters } from '@shared/tripProcessor';
import { DEFAULT_PAGE_SIZE, decodeCursor, encodeCursor, pageLimit, splitPage } from '@shared/pagination';
import { encodePoint, type SampledLocation, type StoredTripPoint } from '@shared/trip-capture';
import {
  TelemetryGate,
  retainAfterFailedFlush,
  sanitizeClientPickupCount,
  type TelemetryGateStats,
} from './telemetryGuard';

// Re-exported so screens import capture types from one place. The encoding
// itself lives in shared/ so it can be tested against the scoring pipeline
// without a React Native runtime; see shared/trip-capture.ts.
export { encodePoint };
export type { SampledLocation, StoredTripPoint };

import {
  MIN_POINTS,
  TripCaptureError,
  assertNativeFirebase,
  type TripCaptureFailure,
  type TripLocationInput,
} from './tripCapture';
import { TripPointWriter } from './tripPointWriter';

// The capture fundamentals and the point writer live in sibling modules now;
// re-exported here because screens have always imported them from this file.
export { TripCaptureError, TripPointWriter };
export type { TripCaptureFailure, TripLocationInput };

/**
 * Creates the trip and its tripPoints parent in one batch.
 *
 * Both must exist together: the security rules gate every point write on
 * get(tripPoints/{tripId}).data.userId, so a trip whose parent write failed
 * would accept no points at all and could never be scored or cancelled.
 */
export async function startTrip(userId: string, start: TripLocationInput): Promise<string> {
  assertNativeFirebase();

  const db = firestore();
  const tripRef = db.collection('trips').doc();
  const tripId = tripRef.id;
  const now = firestore.Timestamp.now();
  const location = { lat: start.lat, lng: start.lng, address: null, placeType: null };

  const batch = db.batch();
  batch.set(tripRef, {
    tripId,
    userId,
    startedAt: now,
    endedAt: now,
    durationSeconds: 0,
    startLocation: location,
    endLocation: location,
    distanceMeters: 0,
    score: 0,
    scoreBreakdown: {
      speedScore: 100,
      brakingScore: 100,
      accelerationScore: 100,
      corneringScore: 100,
      phoneUsageScore: 100,
    },
    events: {
      hardBrakingCount: 0,
      hardAccelerationCount: 0,
      speedingSeconds: 0,
      sharpTurnCount: 0,
      phonePickupCount: 0,
    },
    anomalies: {
      hasGpsJumps: false,
      hasImpossibleSpeed: false,
      isDuplicate: false,
      flaggedForReview: false,
    },
    status: 'recording',
    processedAt: null,
    context: null,
    createdAt: now,
    createdBy: userId,
    pointsCount: 0,
  });
  batch.set(db.collection('tripPoints').doc(tripId), {
    tripId,
    userId,
    points: [],
    samplingRateHz: 1,
    totalPoints: 0,
    compressedSize: 0,
    createdAt: now,
  });

  try {
    await batch.commit();
  } catch (err) {
    console.error('[trips] startTrip failed', err);
    throw new TripCaptureError('write_failed', 'Could not start recording. Try again.');
  }

  // After the commit, never before: a trip_started recorded on an attempt that
  // failed to write would inflate the top of the funnel with drives that never
  // existed and make the completion rate look worse than it is.
  track('trip_started');

  return tripId;
}

/**
 * Submits a recorded trip for scoring: recording -> processing.
 *
 * The Cloud Function computes score, breakdown and events from the GPS points.
 * Nothing here writes them, see the note at the top of this file.
 *
 * The one exception is `phonePickupCount` (M2-DEC-1 Option A,
 * docs/rebuild/m2-dec-1-phone-usage.md): an on-device accelerometer heuristic
 * (lib/phonePickup.ts) counts phone pickups during the trip, and that count
 * is written here as `clientReportedPhonePickupCount` - a field separate
 * from `events`, not locked by firestore.rules the same way. It is client
 * input the server does not independently verify; finalizeTripFromPoints
 * sanitises and rate-caps it (see sanitizePhonePickupCount in
 * packages/scoring/src/tripMetrics.ts) before it can move the score.
 */
export async function submitTripForScoring(
  tripId: string,
  input: {
    end: TripLocationInput;
    distanceMeters: number;
    pointsCount: number;
    /** From PhonePickupDetector.stop(). Defaults to 0 if omitted. */
    phonePickupCount?: number;
    /**
     * Trip length as the stored trace measures it (TripPointWriter's
     * durationSeconds), used to apply the server's per-minute pickup cap
     * against the same duration the server will.
     */
    durationSeconds: number;
    /**
     * Whether automatic detection opened this trip or the driver did. Written
     * so a scored trip can always be traced back to how it began, which
     * matters the first time a driver disputes one. Not a scoring input; the
     * rules leave it writable by the client for the same reason distance is.
     */
    startedBy?: 'auto' | 'manual';
  },
): Promise<void> {
  assertNativeFirebase();

  if (input.pointsCount < MIN_POINTS) {
    throw new TripCaptureError(
      'too_short',
      'That trip was too short to score. Nothing has been saved.',
    );
  }

  const db = firestore();

  // Capped here with the server's own cap (see lib/telemetryGuard.ts). Writing
  // an uncapped count and letting sanitizePhonePickupCount shrink it during
  // scoring would leave the stored number and the number that moved the score
  // as two different values, with nothing on the document saying so.
  const clientReportedPhonePickupCount = sanitizeClientPickupCount(
    input.phonePickupCount,
    input.durationSeconds,
  );

  // ONE WRITE, AND IT MUST STAY ONE WRITE. This was a writeBatch that also set
  // { totalPoints, compressedSize } on tripPoints/{tripId}. firestore.rules
  // denies EVERY client update to that document (points are append-only once
  // written, and tests/rules/trip-points.test.ts has always pinned the
  // denial), and a batch is atomic, so the tripPoints half killed the trips
  // half with it: the trip never left 'recording', onTripStatusChange never
  // fired, no trip was ever scored, and the driver got "Could not save the
  // trip. Try again." on every single attempt. Confirmed against the real
  // rules in the emulator, see the submit-batch tests in that same file.
  //
  // Nothing is lost by dropping it. The point count already lives on the trip
  // document as pointsCount, which is what every reader uses, and the one
  // reader of the parent's totalPoints (functions/src/http/gdpr.ts) already
  // falls back to the actual length of the stored points.
  //
  // The same doomed batch is in the web twin, client/src/lib/tripService.ts
  // endTrip (its characterisation test pins the broken shape against a mocked
  // Firestore that has no rules to refuse it). Flagged for the web owner.
  try {
    await db.collection('trips').doc(tripId).update({
      endedAt: firestore.Timestamp.now(),
      endLocation: { lat: input.end.lat, lng: input.end.lng, address: null, placeType: null },
      distanceMeters: Math.round(input.distanceMeters),
      status: 'processing',
      pointsCount: input.pointsCount,
      clientReportedPhonePickupCount,
      startedBy: input.startedBy ?? 'manual',
    });
  } catch (err) {
    console.error('[trips] submitTripForScoring failed', err);
    throw new TripCaptureError('write_failed', 'Could not save the trip. Try again.');
  }

  // Distance and duration are rounded into buckets rather than reported raw:
  // a precise distance paired with a timestamp is close to a journey, and the
  // funnel only needs to know the shape of the drive.
  track('trip_completed', {
    distance_km: Math.round(input.distanceMeters / 1000),
    points: input.pointsCount,
  });
}

/**
 * Discards a recorded trip: recording -> failed. Used when the driver says the
 * journey was not them driving, when a recording is cancelled outright, and
 * when automatic detection opened a trip that never reached a real road speed
 * ('not_a_drive'). That last one is the important one: a cycle or a bus ride
 * that tripped the detector is discarded rather than scored, so it can never
 * reach the driver's profile or a premium.
 *
 * The trip's GPS batches stay behind. The rules forbid client deletes on
 * tripPoints and batches, and mobile has no callable-functions client, so the
 * web path's cancelTrip Cloud Function is not reachable from here. A failed
 * trip is never scored and never reaches the driver profile, so this is a
 * storage tidy-up owed rather than a correctness hole. Flagged in the Wave C
 * report.
 */
export async function discardTrip(
  tripId: string,
  reason: 'not_driving' | 'cancelled' | 'not_a_drive',
): Promise<void> {
  assertNativeFirebase();
  try {
    await firestore().collection('trips').doc(tripId).update({
      status: 'failed',
      discardReason: reason,
    });
  } catch (err) {
    console.error('[trips] discardTrip failed', err);
    throw new TripCaptureError('write_failed', 'Could not discard the trip.');
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface TripPageResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * One page of a driver's completed trips, oldest-continuing from `cursor`.
 * Fetches one document more than the page holds to learn `hasMore` without a
 * second query; see shared/pagination.ts.
 */
export async function fetchTripPage<T>(
  userId: string,
  cursor: string | null,
  mapDoc: (id: string, data: Record<string, unknown>) => T,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<TripPageResult<T>> {
  const db = firestore();
  let query = db
    .collection('trips')
    .where('userId', '==', userId)
    .where('status', '==', 'completed')
    .orderBy('startedAt', 'desc')
    .limit(pageLimit(pageSize));

  const cursorPath = decodeCursor(cursor);
  if (cursorPath) {
    const cursorDoc = await db.doc(cursorPath).get();
    // A cursor pointing at a since-deleted trip falls back to the first page
    // rather than stranding the list on a spinner.
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();
  const page = splitPage(
    snapshot.docs as { id: string; ref: { path: string }; data: () => Record<string, unknown> }[],
    pageSize,
    (d) => d.ref.path,
  );

  return {
    items: page.items.map((d) => mapDoc(d.id, d.data())),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

/** Cursor for continuing after a trip already on screen. */
export function tripCursor(tripId: string): string {
  return encodeCursor(`trips/${tripId}`);
}

/**
 * Every GPS point of a trip, in order, for the detail map.
 *
 * Reads the same two places the Cloud Function's readTripPoints does: the
 * parent document's `points` array if it was ever populated, otherwise the
 * batches subcollection in batchIndex order. Reading only one of them is how
 * the web map ended up permanently empty before Wave 0.
 */
export async function getTripPoints(tripId: string): Promise<StoredTripPoint[]> {
  const db = firestore();
  const parent = await db.collection('tripPoints').doc(tripId).get();
  if (!parent.exists) return [];

  const parentData = parent.data() as { points?: StoredTripPoint[] } | undefined;
  if (parentData?.points && parentData.points.length > 0) {
    return parentData.points;
  }

  const batches = await db
    .collection('tripPoints')
    .doc(tripId)
    .collection('batches')
    .orderBy('batchIndex')
    .get();

  const points: StoredTripPoint[] = [];
  batches.docs.forEach((doc: { data: () => Record<string, unknown> }) => {
    const data = doc.data() as { points?: StoredTripPoint[] };
    if (Array.isArray(data.points)) points.push(...data.points);
  });
  return points;
}


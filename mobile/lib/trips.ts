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
import { haversineMeters } from '@shared/tripProcessor';
import { DEFAULT_PAGE_SIZE, decodeCursor, encodeCursor, pageLimit, splitPage } from '@shared/pagination';
import { encodePoint, type SampledLocation, type StoredTripPoint } from '@shared/trip-capture';

// Re-exported so screens import capture types from one place. The encoding
// itself lives in shared/ so it can be tested against the scoring pipeline
// without a React Native runtime; see shared/trip-capture.ts.
export { encodePoint };
export type { SampledLocation, StoredTripPoint };

/** Maximum points held in memory before a flush. Mirrors the web streamer. */
const BATCH_SIZE = 100;

/** How often buffered points are written out, in ms. Mirrors the web streamer. */
const FLUSH_INTERVAL_MS = 10_000;

/**
 * A trip needs at least two points to have any distance or duration.
 * finalizeTripFromPoints marks anything shorter as failed, so refuse locally
 * and tell the driver, rather than submitting a trip that dies server-side.
 */
const MIN_POINTS = 2;

export type TripCaptureFailure =
  | 'preview_build'
  | 'permission_denied'
  | 'too_short'
  | 'write_failed';

export class TripCaptureError extends Error {
  readonly reason: TripCaptureFailure;

  constructor(reason: TripCaptureFailure, message: string) {
    super(message);
    this.name = 'TripCaptureError';
    this.reason = reason;
  }
}

export interface TripLocationInput {
  lat: number;
  lng: number;
}

function assertNativeFirebase(): void {
  if (isExpoGo) {
    throw new TripCaptureError(
      'preview_build',
      'Trip recording needs a full build. This is a preview.',
    );
  }
}

/**
 * Buffers GPS points and writes them to tripPoints/{tripId}/batches/{n}.
 *
 * Flushes are serialised behind one in-flight promise and the batch index is
 * reserved synchronously before any await. Without both, a buffer-full flush
 * and the interval flush can capture the same index, and the second write
 * silently overwrites a full window of the driver's GPS trace. That exact bug
 * was found in the web streamer during the logic-gap sweep.
 */
export class TripPointWriter {
  private readonly tripId: string;
  private readonly userId: string;
  private readonly tripStartMs: number;
  private buffer: StoredTripPoint[] = [];
  private batchIndex = 0;
  private totalPoints = 0;
  private distanceMeters = 0;
  private lastPoint: StoredTripPoint | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private flushInFlight: Promise<void> = Promise.resolve();
  private readonly onError?: (error: Error) => void;

  constructor(tripId: string, userId: string, tripStartMs: number, onError?: (error: Error) => void) {
    this.tripId = tripId;
    this.userId = userId;
    this.tripStartMs = tripStartMs;
    this.onError = onError;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.timer = setInterval(() => {
      this.flush().catch((err) => this.onError?.(err as Error));
    }, FLUSH_INTERVAL_MS);
  }

  add(sample: SampledLocation): void {
    if (!this.active) return;
    const point = encodePoint(sample, this.tripStartMs);

    if (this.lastPoint) {
      this.distanceMeters += haversineMeters(
        this.lastPoint.lat,
        this.lastPoint.lng,
        point.lat,
        point.lng,
      );
    }
    this.lastPoint = point;

    this.buffer.push(point);
    this.totalPoints++;

    if (this.buffer.length >= BATCH_SIZE) {
      this.flush().catch((err) => this.onError?.(err as Error));
    }
  }

  /** Total points handed to the writer, including any still buffered. */
  get pointsCount(): number {
    return this.totalPoints;
  }

  /** Haversine distance over accepted points, in metres. */
  get distance(): number {
    return this.distanceMeters;
  }

  get lastKnownPoint(): StoredTripPoint | null {
    return this.lastPoint;
  }

  async stop(): Promise<{ pointsCount: number; distanceMeters: number }> {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
    return { pointsCount: this.totalPoints, distanceMeters: this.distanceMeters };
  }

  private flush(): Promise<void> {
    const next = this.flushInFlight.then(() => this.flushOnce());
    // Keep the chain alive after a rejection so one failed write does not block
    // every later flush. The error still reaches this call's own caller.
    this.flushInFlight = next.catch(() => undefined);
    return next;
  }

  private async flushOnce(): Promise<void> {
    if (this.buffer.length === 0) return;
    assertNativeFirebase();

    const pending = this.buffer;
    this.buffer = [];
    // Reserved before the await, so two overlapping writes can never land on
    // the same batches/{index} document.
    const index = this.batchIndex++;

    try {
      await firestore()
        .collection('tripPoints')
        .doc(this.tripId)
        .collection('batches')
        .doc(String(index))
        .set({
          tripId: this.tripId,
          userId: this.userId,
          batchIndex: index,
          startOffset: pending[0].t,
          endOffset: pending[pending.length - 1].t,
          points: pending,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
      // Put the points back so the next flush retries them rather than dropping
      // a window of the trace on a transient network failure.
      this.buffer = [...pending, ...this.buffer];
      throw err;
    }
  }
}

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
  const batch = db.batch();

  const rawPickupCount = input.phonePickupCount;
  const clientReportedPhonePickupCount = Number.isFinite(rawPickupCount)
    ? Math.max(0, Math.round(rawPickupCount as number))
    : 0;

  batch.update(db.collection('trips').doc(tripId), {
    endedAt: firestore.Timestamp.now(),
    endLocation: { lat: input.end.lat, lng: input.end.lng, address: null, placeType: null },
    distanceMeters: Math.round(input.distanceMeters),
    status: 'processing',
    pointsCount: input.pointsCount,
    clientReportedPhonePickupCount,
  });
  batch.update(db.collection('tripPoints').doc(tripId), {
    totalPoints: input.pointsCount,
    compressedSize: input.pointsCount * 50,
  });

  try {
    await batch.commit();
  } catch (err) {
    console.error('[trips] submitTripForScoring failed', err);
    throw new TripCaptureError('write_failed', 'Could not save the trip. Try again.');
  }
}

/**
 * Discards a recorded trip: recording -> failed. Used when the driver says the
 * journey was not them driving, and when a recording is cancelled outright.
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
  reason: 'not_driving' | 'cancelled',
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

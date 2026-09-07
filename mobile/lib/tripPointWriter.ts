/**
 * The one point buffer: batches sampled fixes, flushes them to
 * tripPoints/{tripId}, and keeps a malformed fix out of pointsCount rather
 * than repairing it. Extracted verbatim from mobile/lib/trips.ts.
 */
import { firestore } from './firebase';
import { haversineMeters } from '@shared/tripProcessor';
import { encodePoint, type SampledLocation, type StoredTripPoint } from '@shared/trip-capture';
import {
  TelemetryGate,
  retainAfterFailedFlush,
  type TelemetryGateStats,
} from './telemetryGuard';
import { BATCH_SIZE, FLUSH_INTERVAL_MS, TripCaptureError, assertNativeFirebase } from './tripCapture';

/**
 * Buffers GPS points and writes them to tripPoints/{tripId}/batches/{n}.
 *
 * Flushes are serialised behind one in-flight promise and the batch index is
 * reserved synchronously before any await. Without both, a buffer-full flush
 * and the interval flush can capture the same index, and the second write
 * silently overwrites a full window of the driver's GPS trace. That exact bug
 * was found in the web streamer during the logic-gap sweep.
 *
 * Every fix passes lib/telemetryGuard.ts's TelemetryGate before it is encoded.
 * A malformed fix is counted by reason and dropped, never repaired, and never
 * counted toward pointsCount, so the number written to the trip document is
 * the number of points that actually exist to score. See that file for why the
 * gate refuses only structurally invalid fixes and keeps the extreme ones.
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
  private readonly gate = new TelemetryGate();
  private droppedPoints = 0;
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
    // Validate before encoding, not after: encodePoint's Math.round and
    // subtraction would turn a NaN coordinate into a NaN point that then
    // poisons the running haversine total below and every distance the
    // scoring pipeline derives from the trace.
    if (!this.gate.admit(sample)) return;
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

  /**
   * Points the writer accepted and still holds or has written. Excludes fixes
   * the gate rejected and points the buffer cap evicted, both of which are
   * reported separately: a pointsCount that counted them would tell the
   * scoring pipeline the trip has points that were never stored.
   */
  get pointsCount(): number {
    return this.totalPoints - this.droppedPoints;
  }

  /** Haversine distance over accepted points, in metres. */
  get distance(): number {
    return this.distanceMeters;
  }

  /**
   * Trip length as the SCORING PIPELINE will measure it: the last stored
   * offset, in seconds. Wall-clock elapsed time on the record screen can
   * differ (a permission prompt, a late first fix), and the phone-pickup cap
   * has to be derived from the same duration the server derives it from or
   * the client and the server cap at different numbers.
   */
  get durationSeconds(): number {
    return this.lastPoint ? Math.round(this.lastPoint.t / 1000) : 0;
  }

  /** Fixes refused at the boundary, per reason. Never repaired, never faked. */
  get rejected(): TelemetryGateStats {
    return this.gate.stats;
  }

  /**
   * The last fix accepted by ANY capture path, raw as the platform reported
   * it. The record screen's live readout reads this rather than its own
   * foreground callback, because once "Always" location is granted iOS
   * delivers a trip's fixes to the background task, which appends here and
   * never touches the screen's state.
   */
  get lastAcceptedSample(): SampledLocation | null {
    return this.gate.lastAccepted;
  }

  /** Points the bounded retry buffer evicted after repeated failed writes. */
  get dropped(): number {
    return this.droppedPoints;
  }

  get lastKnownPoint(): StoredTripPoint | null {
    return this.lastPoint;
  }

  async stop(): Promise<{
    pointsCount: number;
    distanceMeters: number;
    durationSeconds: number;
    rejectedPoints: number;
    droppedPoints: number;
  }> {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
    return {
      pointsCount: this.pointsCount,
      distanceMeters: this.distanceMeters,
      durationSeconds: this.durationSeconds,
      rejectedPoints: this.gate.stats.rejected,
      droppedPoints: this.droppedPoints,
    };
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
      // a window of the trace on a transient network failure. Bounded: a long
      // signal blackspot would otherwise grow this buffer for the length of
      // the outage on a phone already running the GPS radio. What the cap
      // evicts is counted and kept out of pointsCount rather than lost
      // quietly, so the trip never claims points it does not have.
      const retained = retainAfterFailedFlush(pending, this.buffer);
      this.buffer = retained.buffer;
      this.droppedPoints += retained.dropped;
      throw err;
    }
  }
}

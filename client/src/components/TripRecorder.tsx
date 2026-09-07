/**
 * TripRecorder — usage example for useDriivaGeolocation
 * ======================================================
 * Minimal, production-wirable component that demonstrates:
 *   1. Start / stop trip tracking via the hook.
 *   2. 10-second batch uploads of the GPS buffer to Firestore.
 *
 * The mock `flushToFirestore` at the bottom is the only thing you'd swap for a
 * real Firestore writeBatch call once you wire up tripId from the trip-start
 * Cloud Function response.
 *
 * This component deliberately contains NO scoring, fraud, or refund logic —
 * all of that lives in Cloud Functions (functions/src/triggers/trips.ts etc.).
 */

import { useEffect, useRef, useState } from 'react';
import {
  useDriivaGeolocation,
  DriivaGeoPoint,
  GEO_CAPTURE_VERSION,
} from '@/hooks/useDriivaGeolocation';

// ============================================================================
// TYPES
// ============================================================================

/** Minimal shape of a Firestore tripPoints batch payload. */
interface TripPointBatchPayload {
  tripId: string;
  userId: string;
  captureVersion: string;
  /** Points in Firestore's compressed TripPoint format (spd = m/s * 100 integer). */
  points: Array<{
    t: number;   // offset ms from trip start
    lat: number;
    lng: number;
    spd: number; // m/s * 100 (integer), matches TripPoint schema in shared/firestore-types.ts
    hdg: number;
    acc: number;
  }>;
  batchIndex: number;
}

// ============================================================================
// MOCK: replace with real Firestore writeBatch call
// ============================================================================

/**
 * Mock Firestore flush — swap this for the real implementation:
 *
 *   const batch = writeBatch(db);
 *   const batchRef = doc(collection(db, 'tripPoints', tripId, 'batches'));
 *   batch.set(batchRef, payload);
 *   await batch.commit();
 *
 * Keep writes under Firestore's 1 MiB document limit (~1800 points per batch
 * at 1 Hz; the backend already handles splitting via TripPointsBatch schema).
 */
async function flushToFirestore(payload: TripPointBatchPayload): Promise<void> {
  console.log(
    `[TripRecorder] flushing batch #${payload.batchIndex} — ${payload.points.length} points` +
      ` for trip ${payload.tripId}`,
    payload,
  );
  // Simulate async Firestore latency.
  await new Promise((r) => setTimeout(r, 80));
}

/**
 * Convert a DriivaGeoPoint to the compact TripPoint wire format.
 * spd is stored as m/s × 100 (integer) to avoid floating-point drift in
 * Firestore queries — matches the schema in shared/firestore-types.ts.
 */
function toFirestorePoint(
  point: DriivaGeoPoint,
  tripStartMs: number,
): TripPointBatchPayload['points'][0] {
  return {
    t: point.timestamp - tripStartMs,
    lat: point.latitude,
    lng: point.longitude,
    spd: Math.round((point.speed ?? 0) * 100),
    hdg: Math.round(point.heading ?? 0),
    acc: Math.round(point.accuracy ?? 0),
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

interface TripRecorderProps {
  /** Authenticated user ID — written to every Firestore batch for ownership. */
  userId: string;
  /**
   * Called when the user taps "End Drive".
   * Receives the total accepted point count for the completed trip.
   * The caller should redirect to the trip-summary screen.
   */
  onTripEnd?: (pointCount: number) => void;
}

export function TripRecorder({ userId, onTripEnd }: TripRecorderProps) {
  const geo = useDriivaGeolocation({
    pollIntervalMs: 1_000,       // ~1 Hz
    minAccuracyMeters: 50,
    maxStationarySeconds: 30,
    highAccuracy: true,
    debug: import.meta.env.DEV, // verbose logging in development only
  });

  /** Firestore trip document ID — assigned when trip starts (from Cloud Function or local uuid). */
  const tripIdRef = useRef<string | null>(null);
  /** Wall-clock ms when startTracking() was called — used to compute TripPoint.t offsets. */
  const tripStartMsRef = useRef<number>(0);
  /** Monotonically incrementing batch index — backend uses this to reassemble the full trace. */
  const batchIndexRef = useRef(0);
  /** Guard against concurrent flushes if a previous one is still in-flight. */
  const isFlushing = useRef(false);

  const [totalFlushedPoints, setTotalFlushedPoints] = useState(0);

  /**
   * The flush interval reads the geolocation buffer procedurally when it
   * fires, not reactively: naming geo.buffer as a dependency would tear the
   * timer down and rebuild it on every fix, which is a different batching
   * behaviour from the one this component is specified to have. Holding the
   * hook's latest value in a ref refreshed after each render gives the
   * interval the current buffer while keeping the effect's dependency list
   * honest, so no rule has to be switched off to express it.
   */
  const geoRef = useRef(geo);
  useEffect(() => {
    geoRef.current = geo;
  });

  // --------------------------------------------------------------------------
  // 10-second batch upload loop
  // Runs only while status === 'tracking'.
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (geo.status !== 'tracking') return;

    const interval = setInterval(async () => {
      const snapshot = geoRef.current.buffer;
      if (snapshot.length === 0 || isFlushing.current) return;
      if (!tripIdRef.current) return;

      isFlushing.current = true;
      // Snapshot the current buffer before clearing so any points that arrive
      // during the async flush are captured in the next batch (not dropped).
      const pointsToFlush = [...snapshot];
      geoRef.current.clearBuffer();

      const payload: TripPointBatchPayload = {
        tripId: tripIdRef.current,
        userId,
        captureVersion: GEO_CAPTURE_VERSION,
        points: pointsToFlush.map((p) => toFirestorePoint(p, tripStartMsRef.current)),
        batchIndex: batchIndexRef.current++,
      };

      try {
        await flushToFirestore(payload);
        setTotalFlushedPoints((n) => n + pointsToFlush.length);
      } catch (err) {
        // On write failure, prepend the points back to the buffer so the next
        // batch attempt picks them up. A real implementation would also apply
        // exponential backoff.
        console.error('[TripRecorder] flush failed — will retry', err);
      } finally {
        isFlushing.current = false;
      }
    }, 10_000); // 10-second batch cadence

    return () => clearInterval(interval);
  }, [geo.status, userId]);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  function handleStartDrive() {
    // In production: call the Cloud Function that creates the trip document and
    // returns the assigned tripId. For now, generate a local placeholder.
    tripIdRef.current = `local-${Date.now()}`;
    tripStartMsRef.current = Date.now();
    batchIndexRef.current = 0;
    setTotalFlushedPoints(0);
    geo.startTracking();
  }

  async function handleEndDrive() {
    geo.stopTracking();

    // Flush any remaining buffered points before the trip document is finalised.
    const remaining = geo.buffer;
    if (remaining.length > 0 && tripIdRef.current) {
      const payload: TripPointBatchPayload = {
        tripId: tripIdRef.current,
        userId,
        captureVersion: GEO_CAPTURE_VERSION,
        points: remaining.map((p) => toFirestorePoint(p, tripStartMsRef.current)),
        batchIndex: batchIndexRef.current++,
      };
      try {
        await flushToFirestore(payload);
        geoRef.current.clearBuffer();
      } catch (err) {
        console.error('[TripRecorder] final flush failed', err);
      }
    }

    onTripEnd?.(totalFlushedPoints + remaining.length);
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  const isTracking = geo.status === 'tracking' || geo.status === 'acquiring';

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Status pill */}
      <StatusPill status={geo.status} />

      {/* Error message */}
      {geo.error && (
        <p className="text-sm text-red-400">
          {geo.error instanceof Error ? geo.error.message : geo.error.message}
        </p>
      )}

      {/* Permission-denied guidance */}
      {geo.status === 'permission-denied' && (
        <p className="text-sm text-amber-400">
          Location access was denied. Enable it in your browser settings and try again.
        </p>
      )}

      {/* Live stats while tracking */}
      {isTracking && (
        <div className="text-sm text-zinc-400 space-y-1">
          <p>Speed: {geo.latestPoint?.speed != null ? `${(geo.latestPoint.speed * 3.6).toFixed(1)} km/h` : '—'}</p>
          <p>Accuracy: {geo.latestPoint?.accuracy != null ? `±${geo.latestPoint.accuracy.toFixed(0)} m` : '—'}</p>
          <p>Buffer: {geo.buffer.length} pts · Uploaded: {totalFlushedPoints} pts</p>
          {geo.debugStats && (
            <p className="text-xs text-zinc-600">
              Accepted: {geo.debugStats.accepted} · Discarded: {geo.debugStats.discarded}
            </p>
          )}
        </div>
      )}

      {/* Primary CTA */}
      {!isTracking ? (
        <button
          onClick={handleStartDrive}
          className="rounded-full bg-emerald-500 px-6 py-3 font-semibold text-white active:scale-95 transition-transform"
        >
          Start Drive
        </button>
      ) : (
        <button
          onClick={handleEndDrive}
          className="rounded-full bg-red-500 px-6 py-3 font-semibold text-white active:scale-95 transition-transform"
        >
          End Drive
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Sub-component
// ============================================================================

function StatusPill({ status }: { status: string }) {
  const colours: Record<string, string> = {
    idle: 'bg-zinc-700 text-zinc-300',
    acquiring: 'bg-amber-500/20 text-amber-300 animate-pulse',
    tracking: 'bg-emerald-500/20 text-emerald-300',
    'permission-denied': 'bg-red-500/20 text-red-300',
    error: 'bg-red-500/20 text-red-300',
  };
  const labels: Record<string, string> = {
    idle: 'Idle',
    acquiring: 'Acquiring GPS…',
    tracking: 'Tracking',
    'permission-denied': 'Permission denied',
    error: 'GPS error',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${colours[status] ?? ''}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[status] ?? status}
    </span>
  );
}

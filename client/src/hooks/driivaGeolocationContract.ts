/**
 * The capture tuning and the shapes useDriivaGeolocation reads and returns.
 * Extracted verbatim from client/src/hooks/useDriivaGeolocation.ts, which
 * re-exports them so callers are unaffected.
 */
// ============================================================================
// CONSTANTS
// ============================================================================

/** Tag embedded in every point so downstream models can partition data regimes. */
export const GEO_CAPTURE_VERSION = 'v1-continuous-telemetry';

// Plausibility thresholds
/** ~200 mph — physically impossible on any public road. */
export const MAX_VALID_SPEED_MS = 89.4;
/**
 * Derived speed (Haversine) above which we treat the GPS reading as a jump
 * (urban canyon tunnel exit, cell-tower handoff artefact, etc.).
 */
export const MAX_TELEPORT_SPEED_MS = 100; // m/s

/** Earth mean radius for Haversine. */

/**
 * When in stationary mode, fire a lightweight getCurrentPosition this often.
 * Keeps the trip "alive" so we catch the first motion event quickly, without
 * running high-accuracy GPS at full rate while parked or in a drive-through.
 */
export const STATIONARY_POLL_MS = 12_000;

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * A single validated GPS point emitted by the hook.
 * Immutable — consumers must not mutate points after receiving them.
 */
export type DriivaGeoPoint = {
  latitude: number;
  longitude: number;
  /** m/s derived from device API or Haversine fallback; null only if first point and device omits speed. */
  speed: number | null;
  /** Degrees 0-360; null when device cannot determine heading. */
  heading: number | null;
  /** GPS accuracy radius in metres (smaller = better). */
  accuracy: number | null;
  /** Unix epoch ms — GPS timestamp, not wall-clock. */
  timestamp: number;
  /** Data-regime tag for ML pipeline versioning. */
  captureVersion: string;
};

export type GeoStatus =
  | 'idle'             // Not yet started, or explicitly stopped.
  | 'permission-denied' // User rejected the permission prompt.
  | 'acquiring'        // watchPosition registered; waiting for first fix.
  | 'tracking'         // Actively receiving and accepting GPS fixes.
  | 'error';           // Non-permission geolocation error (unavailable, timeout).

export type UseDriivaGeolocationOptions = {
  /**
   * Minimum time gap between accepted points.
   * Implements the ~1 Hz target: watchPosition fires when the OS has data;
   * we throttle to this interval. Default 1000 ms.
   * Raise to 2000-3000 ms for an "eco mode" A/B test.
   */
  pollIntervalMs?: number;
  /**
   * Discard readings whose accuracy radius exceeds this value.
   * 25 m balances urban canyon filtering with signal availability.
   * Raise to ~50 m in low-signal rural areas if needed.
   */
  minAccuracyMeters?: number;
  /**
   * Consecutive seconds of near-zero speed (< 1 m/s) before entering
   * stationary mode. 30 s tolerates long red lights without triggering
   * prematurely on slow urban traffic.
   */
  maxStationarySeconds?: number;
  /**
   * Request GNSS-quality accuracy vs WiFi/cell fallback.
   * True by default; set false for the eco-mode experiment.
   */
  highAccuracy?: boolean;
  /** Emit diagnostic console.log output and populate debugStats. */
  debug?: boolean;
};

export type UseDriivaGeolocationResult = {
  status: GeoStatus;
  /** Most recently accepted point. Null until first fix arrives. */
  latestPoint: DriivaGeoPoint | null;
  /**
   * Points accumulated since the last clearBuffer() call.
   * The caller should batch-upload this every ~10 s to Firestore's
   * tripPoints/{tripId} collection, then call clearBuffer().
   */
  buffer: DriivaGeoPoint[];
  startTracking: () => void;
  stopTracking: () => void;
  /** Empty the buffer after a successful Firestore write. */
  clearBuffer: () => void;
  error: GeolocationPositionError | Error | null;
  /**
   * Only populated when debug: true.
   * Useful for QA to understand filtering effectiveness.
   */
  debugStats: { accepted: number; discarded: number } | null;
};

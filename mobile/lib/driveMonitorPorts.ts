/**
 * The ports the DriveMonitor is written against, and the bound it keeps on the
 * pre-trip buffer. Declared apart from the monitor so the native adapters can
 * import the contract without importing the machine. Extracted verbatim from
 * mobile/lib/driveMonitor.ts, which re-exports them.
 */
import type { SampledLocation } from '@shared/trip-capture';

/**
 * Fixes held while waiting for detection to be sure.
 *
 * At the capture rate the app uses (one per second) this is ten minutes, which
 * is far more than the twenty second start hold needs. It is generous because
 * the cost of a spare fix is a few bytes and the cost of a short buffer is a
 * trip that starts late, but it is BOUNDED because the monitor is armed all
 * day and this is the one structure here that could otherwise grow forever.
 */
export const MAX_PRETRIP_SAMPLES = 600;

export interface TripSubmission {
  end: { lat: number; lng: number };
  distanceMeters: number;
  pointsCount: number;
  durationSeconds: number;
  phonePickupCount: number;
  /** Whether detection opened this trip or the driver did. */
  startedBy: 'auto' | 'manual';
}

/** The writer half of lib/trips.ts TripPointWriter, as this file needs it. */
export interface PointWriterPort {
  start(): void;
  add(sample: SampledLocation): void;
  stop(): Promise<{
    pointsCount: number;
    distanceMeters: number;
    durationSeconds: number;
    rejectedPoints: number;
    droppedPoints: number;
  }>;
  readonly pointsCount: number;
  readonly distance: number;
  /** Duration of the stored trace, still known when the final flush fails. */
  readonly durationSeconds: number;
  readonly lastAcceptedSample: SampledLocation | null;
}

export interface TripPort {
  startTrip(start: { lat: number; lng: number }): Promise<string>;
  createWriter(tripId: string, tripStartMs: number): PointWriterPort;
  submit(tripId: string, input: TripSubmission): Promise<void>;
  discard(tripId: string, reason: 'not_driving' | 'cancelled' | 'not_a_drive'): Promise<void>;
}

/** What happened to the last journey, for the screen to state plainly. */
export type MonitorOutcome =
  | null
  | 'submitted'
  | 'not_a_drive'
  | 'submit_failed'
  | 'start_failed'
  /** A trip opened but no fix was ever accepted, so there is nothing to score. */
  | 'nothing_captured';

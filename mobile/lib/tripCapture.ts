/**
 * Trip-capture fundamentals: the batch sizing the writer flushes on, the
 * failure taxonomy screens surface, and the native-Firebase guard every write
 * path runs first. Extracted verbatim from mobile/lib/trips.ts, which
 * re-exports the public names so existing imports are unaffected.
 */
import { isExpoGo } from './firebase';

/** Maximum points held in memory before a flush. Mirrors the web streamer. */
export const BATCH_SIZE = 100;

/** How often buffered points are written out, in ms. Mirrors the web streamer. */
export const FLUSH_INTERVAL_MS = 10_000;

/**
 * A trip needs at least two points to have any distance or duration.
 * finalizeTripFromPoints marks anything shorter as failed, so refuse locally
 * and tell the driver, rather than submitting a trip that dies server-side.
 */
export const MIN_POINTS = 2;

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

export function assertNativeFirebase(): void {
  if (isExpoGo) {
    throw new TripCaptureError(
      'preview_build',
      'Trip recording needs a full build. This is a preview.',
    );
  }
}

/**
 * PHONE-PICKUP DETECTION (mobile)
 * ================================
 * On-device heuristic that counts phone pickups during an active trip, so
 * the phone-usage 10% of the driving score (SCORE_WEIGHTS.phoneUsage in
 * packages/scoring/src/tripMetrics.ts) has a real signal to work from
 * instead of the permanent, undisclosed neutral 100 it defaulted to before
 * M2-DEC-1 Option A (docs/rebuild/m2-dec-1-phone-usage.md).
 *
 * WHAT THIS IS: a deterministic threshold on the phone's accelerometer
 * magnitude, via expo-sensors' `Accelerometer` (already disclosed in
 * mobile/app/trust.tsx). A phone resting in a dashboard/vent mount reads
 * close to 1g regardless of mount angle, because the accelerometer reports
 * total specific force (gravity plus any vehicle acceleration) and gravity
 * dominates that reading when the phone itself is not being handled. Picking
 * the phone up - lifting it off the mount, turning it face-up, unlocking it
 * - moves it through space under a human hand, which produces a materially
 * larger and, critically, SUSTAINED deviation from that 1g magnitude than
 * road vibration, braking or cornering do on their own (those show up as
 * brief spikes, not a held deviation).
 *
 * WHAT THIS IS NOT: a claim of accurate gesture recognition. A firm pothole
 * or a kerb strike held over a rough patch could false-positive; a very
 * gentle, deliberate pickup could fall under the threshold and go uncounted.
 * There is no ground-truth label for any of this on-device, so nothing here
 * is "verified" - it is a documented, auditable, same-input-same-output
 * heuristic, in the spirit of docs/HOW_WE_DETECT_REAL_DRIVING_VS_WALKING.md.
 * The server does not (and cannot, without its own sensor stream) verify
 * this count independently; it only sanity-checks and rate-caps it - see
 * `sanitizePhonePickupCount` in packages/scoring/src/tripMetrics.ts.
 *
 * UNVERIFIED ON DEVICE at the time this was written: this has not been run
 * against a real accelerometer in a moving car. The thresholds below are a
 * reasoned starting point, not a calibrated one - expect them to need
 * tuning once there is real trip data to check them against.
 */
import { Accelerometer } from 'expo-sensors';

/**
 * Sample rate for the accelerometer while a trip is recording. 5 Hz is
 * enough to resolve a pickup's shape (rise, hold, fall over roughly a
 * second) without meaningfully affecting battery life over a typical trip.
 */
const UPDATE_INTERVAL_MS = 200;

/**
 * Gravity reads as ~1g when the phone is resting in a mount. A deviation in
 * total accelerometer magnitude beyond this (in g) is treated as candidate
 * handling. Chosen well above the noise floor of ordinary road vibration and
 * normal braking/cornering, which read as brief spikes rather than a
 * sustained shift - this threshold only matters in combination with
 * MIN_SUSTAINED_MS below.
 */
const DISTURBANCE_THRESHOLD_G = 0.4;

/**
 * A candidate disturbance must hold at or above the threshold for at least
 * this long to count as a pickup rather than a single bump or pothole.
 */
const MIN_SUSTAINED_MS = 600;

/**
 * Minimum gap between counted pickups, so one continuous handling episode
 * (lift, check, put back) is not counted many times over. A continued hold
 * past this window - e.g. the phone stays in hand - is counted again, on the
 * view that extended handling is a distinct, additional instance of usage
 * worth another penalty, not a single indefinite event.
 */
const DEBOUNCE_MS = 3000;

type AccelerometerReading = { x: number; y: number; z: number };
type AccelerometerSubscription = { remove: () => void };

/**
 * Counts phone-pickup events for one trip. Call `start()` when recording
 * begins and `stop()` when it ends; `stop()` returns the count and releases
 * the sensor subscription. Safe to call `stop()` more than once (idempotent)
 * and safe on a device/simulator with no accelerometer - the listener simply
 * never fires, so the count stays 0 rather than throwing.
 */
export class PhonePickupDetector {
  private subscription: AccelerometerSubscription | null = null;
  private count_ = 0;
  private disturbanceStartedAt: number | null = null;
  private lastCountedAt = 0;

  start(): void {
    this.count_ = 0;
    this.disturbanceStartedAt = null;
    this.lastCountedAt = 0;

    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
    this.subscription = Accelerometer.addListener(({ x, y, z }: AccelerometerReading) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const disturbance = Math.abs(magnitude - 1);
      const now = Date.now();

      if (disturbance < DISTURBANCE_THRESHOLD_G) {
        // Below threshold: no candidate disturbance in progress.
        this.disturbanceStartedAt = null;
        return;
      }

      if (this.disturbanceStartedAt === null) {
        this.disturbanceStartedAt = now;
        return;
      }

      const sustainedFor = now - this.disturbanceStartedAt;
      const sinceLastCount = now - this.lastCountedAt;
      if (sustainedFor >= MIN_SUSTAINED_MS && sinceLastCount >= DEBOUNCE_MS) {
        this.count_ += 1;
        this.lastCountedAt = now;
        // Restart the sustain clock rather than leaving it running, so a
        // continued single hold is metered roughly every DEBOUNCE_MS rather
        // than firing again on the very next sample.
        this.disturbanceStartedAt = now;
      }
    });
  }

  /**
   * The running count, without stopping. Read live by lib/driveMonitor.ts,
   * which rebases it at the start of each trip: the detector runs for as long
   * as detection is armed, not for the length of one trip.
   */
  get count(): number {
    return this.count_;
  }

  /** Stops listening and returns the pickup count for this trip. */
  stop(): number {
    this.subscription?.remove();
    this.subscription = null;
    return this.count_;
  }
}

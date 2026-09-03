/**
 * AUTOMATIC DRIVE DETECTION (pure)
 * =================================
 * Decides, from a stream of timestamped sensor samples, when a drive has
 * started, paused, resumed, ended, or turned out not to be a drive at all.
 * Zero expo imports, zero Firestore, zero React: the root vitest run exercises
 * it directly, and lib/driveMonitor.ts is the only thing that knows about
 * sensors or trips.
 *
 * WHY A STATE MACHINE AND NOT A MODEL. A phone has to run this all day on a
 * battery; an insurer has to be told exactly why a journey was or was not
 * counted; and the same drive has to produce the same trip every time. A
 * threshold machine gives all three. It is the same posture as
 * lib/phonePickup.ts, and it comes with the same warning: THESE NUMBERS ARE
 * REASONED, NOT CALIBRATED. There is no labelled corpus of real Driiva drives
 * yet, so nothing here is "accurate" or "tuned"; it is documented, auditable
 * and deterministic, and it will need revisiting against real traces.
 *
 * WHAT THIS IS NOT. docs/HOW_WE_DETECT_REAL_DRIVING_VS_WALKING.md describes
 * the SERVER-SIDE stop-go classifier, which runs over a finished recording and
 * splits it into driving segments after the fact. That is a different job and
 * it stays exactly as it is. It cannot start a trip, because by the time it
 * runs the trip is already over. This is the on-device half that opens one.
 *
 * THE ASYMMETRY THAT SHAPES EVERY THRESHOLD HERE. Failing to start a drive
 * costs a driver some unscored miles. Starting one for a walk, a bus or a
 * train writes a journey the driver did not drive into an insurance record and
 * scores them on it. Those are not equally bad, so every threshold leans
 * toward refusing, and a journey that never reaches a real road speed is
 * discarded rather than scored.
 */

/**
 * Every tunable in one exported object, so a threshold can never be retyped
 * into a second place and quietly disagree with itself.
 */
export const DETECTION = {
  /**
   * Sustained speed that makes a journey a candidate drive. 4.5 m/s is about
   * 10 mph: above a run, below any road speed limit. Held rather than
   * instantaneous, so a bad GPS sample cannot start a trip on its own.
   */
  START_SPEED_MPS: 4.5,

  /** How long START_SPEED_MPS must hold on GPS alone before a drive is declared. */
  START_HOLD_MS: 20_000,

  /**
   * The hold when the accelerometer agrees this is not a person moving under
   * their own power. Shorter because two independent signals agreeing is
   * stronger evidence than one held for longer, and every second saved here is
   * a second of real driving that does not need backfilling.
   */
  START_HOLD_CORROBORATED_MS: 10_000,

  /**
   * Variance of accelerometer magnitude, in g squared, above which the motion
   * looks like a human gait rather than a vehicle. Walking and running plant a
   * foot roughly twice a second and produce a large, rhythmic deviation; a
   * phone in a car sees road vibration, which is much smaller. So the
   * corroboration test is variance BELOW this, not above it: high variance at
   * road speed is a reason to keep waiting, not to hurry.
   */
  GAIT_VARIANCE_G2: 0.05,

  /**
   * Below this the vehicle is treated as stationary rather than moving.
   *
   * ONE THRESHOLD, TWO JOBS, DELIBERATELY. It clears the stationary clock and
   * it resumes a paused drive, because both are the same question: is this
   * vehicle moving. Two numbers used to answer it - the clock cleared here at
   * 1.0 while resuming needed START_SPEED_MPS at 4.5 - and a car crawling
   * between the two was moving, was not accumulating toward the end of the
   * trip, and still read as paused, so the Drive screen sat on "Stopped. Still
   * recording." through a whole queue.
   *
   * START_SPEED_MPS is not the same question and is not used here. It decides
   * whether a journey is a DRIVE at all, once, from cold, and leans toward
   * refusing for the reason set out at the top of this file. That decision has
   * already been made and paid for by the time anything can pause.
   *
   * NO HYSTERESIS BAND, because PAUSE_HOLD_MS already is one. Resuming is
   * immediate but pausing again costs a full minute of no movement, so a
   * junction cannot flap the state more than once a minute however the traffic
   * behaves.
   */
  MOVING_SPEED_MPS: 1.0,

  /** Stationary this long pauses the drive. Recording continues throughout. */
  PAUSE_HOLD_MS: 60_000,

  /** Stationary this long ends the drive. Three minutes is a car park, not a light. */
  STOP_HOLD_MS: 180_000,

  /**
   * A drive has to reach a real road speed. 8 m/s is about 18 mph, which a
   * cyclist can touch briefly and a bus passenger will exceed, hence the
   * window below rather than a single sample.
   */
  MIN_PEAK_SPEED_MPS: 8,

  /** How long a declared drive has to prove it reaches MIN_PEAK_SPEED_MPS. */
  PEAK_WINDOW_MS: 120_000,

  /**
   * Horizontal accuracy beyond which a fix is ignored entirely. A 100 m fix in
   * a city centre can read as any speed at all. Ignored means ignored: it does
   * not advance a hold, does not break one, and is never repaired or guessed.
   */
  MAX_ACCURACY_M: 50,
} as const;

export type DriveState = 'idle' | 'candidate' | 'driving' | 'paused' | 'ended';

export interface DetectionSample {
  /** Epoch milliseconds. */
  t: number;
  /** Metres per second, or null when the fix carries no speed. */
  speedMps: number | null;
  /** Horizontal accuracy in metres, or null when unknown. */
  accuracyM: number | null;
  /**
   * Variance of accelerometer magnitude in g squared over a short window, or
   * null when there is no motion permission or no sensor. Corroboration only:
   * a drive can always start on GPS alone.
   */
  accelVariance: number | null;
}

export type DriveEvent =
  | { type: 'none' }
  /** `since` is when the candidate began, so the monitor can backfill. */
  | { type: 'drive_started'; since: number }
  | { type: 'drive_paused' }
  | { type: 'drive_resumed' }
  | { type: 'drive_ended'; reason: 'stopped' }
  | { type: 'drive_discarded'; reason: 'not_a_drive' };

const NOTHING: DriveEvent = { type: 'none' };

/**
 * Feed it samples with `push`, act on what it returns.
 *
 * Deliberately holds no timers of its own: it only ever reasons about the
 * timestamps it is given. A machine that woke itself up would behave
 * differently in a test, on a stationary phone, and in a tunnel, which is
 * exactly the kind of thing nobody would notice until a trip went missing.
 */
export class DriveDetector {
  private current: DriveState = 'idle';
  /** When the present run of at-or-above-start-speed samples began. */
  private candidateSince: number | null = null;
  /**
   * When anything last actually MOVED, at or above MOVING_SPEED_MPS.
   *
   * The stationary clock runs from here rather than from "when stationary
   * samples started arriving", because a parked car eventually stops producing
   * fixes at all. Timing from the last sample RECEIVED means a trip stays open
   * forever once the fixes dry up; timing from the last MOVEMENT is true
   * whether the samples keep coming or not.
   */
  private lastMovingAt: number | null = null;
  /** When the drive was declared, for the peak-speed window. */
  private drivingSince: number | null = null;
  private peak = 0;
  /** True once the peak-speed window has been judged, so it is judged once. */
  private peakJudged = false;

  get state(): DriveState {
    return this.current;
  }

  /** Highest speed seen since the drive was declared. */
  get peakSpeedMps(): number {
    return this.peak;
  }

  reset(): void {
    this.current = 'idle';
    this.candidateSince = null;
    this.lastMovingAt = null;
    this.drivingSince = null;
    this.peak = 0;
    this.peakJudged = false;
  }

  push(sample: DetectionSample): DriveEvent {
    if (this.current === 'ended') return NOTHING;

    // A fix the platform is unsure of tells us nothing, so it changes nothing.
    // Returning early rather than treating it as "not moving" is the whole
    // point: a run of poor fixes in a tunnel must not end a drive.
    if (!this.isUsable(sample)) return NOTHING;

    const speed = sample.speedMps as number;
    if (this.current === 'driving' || this.current === 'paused') {
      this.peak = Math.max(this.peak, speed);
    }

    // One clock for both pause and end, and it measures time since the last
    // real movement. Creeping in traffic keeps resetting it, so a slow crawl
    // can never accumulate toward ending the drive.
    if (speed >= DETECTION.MOVING_SPEED_MPS) {
      this.lastMovingAt = sample.t;
    }

    switch (this.current) {
      case 'idle':
        return this.fromIdle(sample, speed);
      case 'candidate':
        return this.fromCandidate(sample, speed);
      case 'driving':
        return this.fromDriving(sample);
      case 'paused':
        return this.fromPaused(sample, speed);
      default:
        return NOTHING;
    }
  }

  /**
   * Advance wall-clock time WITHOUT a sample.
   *
   * A parked car stops moving, and a location service with nothing new to say
   * eventually says nothing, so a machine that only reasons about samples it
   * receives can never notice a drive has finished. The absence of movement is
   * real information and this is how it is acted on.
   *
   * It invents nothing. No speed is assumed, no position is guessed, no sample
   * is synthesised. It asks only how long it has been since something moved,
   * and it can only ever END a drive, never begin one.
   */
  tick(now: number): DriveEvent {
    if (this.current !== 'driving' && this.current !== 'paused') return NOTHING;

    const discarded = this.judgePeak({ t: now, speedMps: null, accuracyM: null, accelVariance: null });
    if (discarded) return discarded;

    const stationary = this.stationaryFor(now);
    if (this.current === 'driving' && stationary >= DETECTION.PAUSE_HOLD_MS) {
      this.current = 'paused';
      return { type: 'drive_paused' };
    }
    if (this.current === 'paused' && stationary >= DETECTION.STOP_HOLD_MS) {
      this.current = 'ended';
      return { type: 'drive_ended', reason: 'stopped' };
    }
    return NOTHING;
  }

  /** A fix is usable when it carries a real speed and the phone trusts it. */
  private isUsable(sample: DetectionSample): boolean {
    if (sample.speedMps === null || !Number.isFinite(sample.speedMps)) return false;
    if (sample.speedMps < 0) return false;
    if (sample.accuracyM !== null && Number.isFinite(sample.accuracyM)) {
      if (sample.accuracyM > DETECTION.MAX_ACCURACY_M) return false;
    }
    return true;
  }

  /**
   * The accelerometer agrees only when it is present AND reads below a human
   * gait. Absent is not agreement, which is why a drive on GPS alone takes the
   * full hold rather than the short one.
   */
  private corroborated(sample: DetectionSample): boolean {
    const variance = sample.accelVariance;
    if (variance === null || !Number.isFinite(variance)) return false;
    return variance < DETECTION.GAIT_VARIANCE_G2;
  }

  private fromIdle(sample: DetectionSample, speed: number): DriveEvent {
    if (speed >= DETECTION.START_SPEED_MPS) {
      this.current = 'candidate';
      this.candidateSince = sample.t;
    }
    return NOTHING;
  }

  private fromCandidate(sample: DetectionSample, speed: number): DriveEvent {
    if (speed < DETECTION.START_SPEED_MPS) {
      // Dropping below start speed abandons the candidate entirely. The next
      // run starts a fresh hold rather than resuming a part-served one: a
      // journey that keeps dipping under 10 mph is exactly the journey this
      // is meant to refuse.
      this.current = 'idle';
      this.candidateSince = null;
      return NOTHING;
    }

    const hold = this.corroborated(sample)
      ? DETECTION.START_HOLD_CORROBORATED_MS
      : DETECTION.START_HOLD_MS;

    if (this.candidateSince !== null && sample.t - this.candidateSince >= hold) {
      const since = this.candidateSince;
      this.current = 'driving';
      this.drivingSince = sample.t;
      this.lastMovingAt = sample.t;
      this.peak = speed;
      // The points from `since` onward are already driving and were captured
      // before anyone knew it. The monitor backfills them.
      return { type: 'drive_started', since };
    }
    return NOTHING;
  }

  private fromDriving(sample: DetectionSample): DriveEvent {
    const discarded = this.judgePeak(sample);
    if (discarded) return discarded;

    if (this.stationaryFor(sample.t) >= DETECTION.PAUSE_HOLD_MS) {
      this.current = 'paused';
      return { type: 'drive_paused' };
    }
    return NOTHING;
  }

  private fromPaused(sample: DetectionSample, speed: number): DriveEvent {
    const discarded = this.judgePeak(sample);
    if (discarded) return discarded;

    // Moving at all resumes, on the same threshold that just cleared the
    // stationary clock above. Anything higher leaves a band in which the car
    // is moving and the screen says it is stopped.
    if (speed >= DETECTION.MOVING_SPEED_MPS) {
      this.current = 'driving';
      return { type: 'drive_resumed' };
    }

    if (this.stationaryFor(sample.t) >= DETECTION.STOP_HOLD_MS) {
      this.current = 'ended';
      return { type: 'drive_ended', reason: 'stopped' };
    }
    return NOTHING;
  }

  /** How long since anything moved. Zero when nothing has ever moved. */
  private stationaryFor(now: number): number {
    if (this.lastMovingAt === null) return 0;
    return now - this.lastMovingAt;
  }

  /**
   * Once, at the end of the peak window: did this journey ever reach a real
   * road speed? If not it was a cycle, a bus, or a very slow potter, and it is
   * discarded rather than scored. Judged once and never revisited, so a drive
   * that proved itself cannot be taken away later by a long crawl home.
   */
  private judgePeak(sample: DetectionSample): DriveEvent | null {
    if (this.peakJudged || this.drivingSince === null) return null;
    if (sample.t - this.drivingSince < DETECTION.PEAK_WINDOW_MS) return null;

    this.peakJudged = true;
    if (this.peak < DETECTION.MIN_PEAK_SPEED_MPS) {
      this.current = 'ended';
      return { type: 'drive_discarded', reason: 'not_a_drive' };
    }
    return null;
  }
}

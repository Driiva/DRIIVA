/**
 * DRIVE MONITOR
 * =============
 * Turns a DriveDetector decision into a real trip, and owns the awkward part
 * of automatic detection: by the time the machine is confident, the driver has
 * already been driving for ten to twenty seconds. Those seconds are real
 * driving and they are already captured, so they are held in a bounded buffer
 * and backfilled into the trip the moment it opens. Without that, every
 * automatic trip would begin mid-road with the pull-away missing, and the
 * score would be computed over a journey that never happened that way.
 *
 * PORTS, NOT IMPORTS. This file has no expo and no Firestore import. Trip
 * creation, point writing and submission arrive as a TripPort, so the
 * orchestration here is unit-tested for real against the root vitest run and
 * the native wiring stays a thin adapter with no decisions in it. That split
 * is the same one lib/backgroundLocationBuffer.ts already makes, for the same
 * reason: CI never installs mobile's dependency tree.
 *
 * WHAT IT REFUSES TO DO. It never opens a second trip over an open one, never
 * submits a journey the detector discarded, and never throws out of a sensor
 * callback. A monitor that dies on one offline moment stops noticing drives
 * for the rest of the day, and the driver would have no way of knowing.
 */
import type { SampledLocation } from '@shared/trip-capture';
import { DriveDetector, type DetectionSample } from './driveDetection';
import {
  MAX_PRETRIP_SAMPLES,
  type MonitorOutcome,
  type PointWriterPort,
  type TripPort,
  type TripSubmission,
} from './driveMonitorPorts';

// The ports and the buffer bound live in ./driveMonitorPorts; re-exported here
// because callers have always imported them from this module.
export { MAX_PRETRIP_SAMPLES } from './driveMonitorPorts';
export type {
  MonitorOutcome,
  PointWriterPort,
  TripPort,
  TripSubmission,
} from './driveMonitorPorts';

export class DriveMonitor {
  private readonly port: TripPort;
  private readonly detector = new DriveDetector();
  private armed = false;
  private buffer: SampledLocation[] = [];
  private writer: PointWriterPort | null = null;
  private openTripId: string | null = null;
  private startedBy: 'auto' | 'manual' = 'auto';
  private accelVariance: number | null = null;
  private outcome: MonitorOutcome = null;
  private readPickups: (() => number) | null = null;
  /** Source reading at the moment the open trip began, so counts do not carry over. */
  private pickupBaseline = 0;
  /**
   * Set synchronously the instant an open begins, and cleared only when it
   * finishes. The queue orders the work; this closes the await gap INSIDE it,
   * where two callers could otherwise both see openTripId still null while
   * port.startTrip was in flight and open two trips for one drive.
   */
  private opening = false;
  private openedAt: number | null = null;
  private queue: Promise<void> = Promise.resolve();
  private motionSink: ((needed: boolean) => void) | null = null;
  /** Last value reported to the sink, so a fix a second cannot restart a sensor. */
  private motionReported = false;

  constructor(port: TripPort) {
    this.port = port;
  }

  get tripId(): string | null {
    return this.openTripId;
  }

  get isArmed(): boolean {
    return this.armed;
  }

  get bufferedSampleCount(): number {
    return this.buffer.length;
  }

  get lastOutcome(): MonitorOutcome {
    return this.outcome;
  }

  /** State of the drive in progress, for the instrument to render. */
  get driveState() {
    return this.detector.state;
  }

  /**
   * The readout the Drive screen renders, taken from the WRITER rather than
   * from any one sensor callback. Once "Always" location is granted, iOS
   * delivers a trip's fixes to the background task, which never touches React
   * state; a screen reading its own callback froze on the first fix while
   * capture carried on correctly underneath it.
   */
  get lastSample(): SampledLocation | null {
    return this.writer?.lastAcceptedSample ?? null;
  }

  get distanceMeters(): number {
    return this.writer?.distance ?? 0;
  }

  get pointsCount(): number {
    return this.writer?.pointsCount ?? 0;
  }

  /** Phone pickups during the OPEN trip. Zero when nothing is open. */
  get pickupCount(): number {
    if (this.openTripId === null || this.readPickups === null) return 0;
    // Clamped: a source reset underneath us must never read as a negative
    // count, which would flatter the driver rather than merely be wrong.
    return Math.max(0, this.readPickups() - this.pickupBaseline);
  }

  /**
   * When the OPEN trip actually began, in epoch ms, which for an automatic
   * trip is when the candidate started rather than when detection became sure.
   *
   * The screen must read elapsed from here. Timing from the moment a screen
   * happened to mount showed "0:05 / 0.9 mi" on a trip that had been running a
   * minute: two real numbers side by side saying something impossible.
   */
  get tripStartedAt(): number | null {
    return this.openedAt;
  }

  /**
   * Whether the accelerometer is currently earning its battery.
   *
   * It is worth running for exactly two jobs, and neither of them exists
   * between drives. The gait check only shortens the start hold once a
   * candidate has appeared, and the phone-pickup count is rebased when a trip
   * opens, so every pickup counted before that is discarded. Left on from
   * arming to disarming it therefore ran at 5 Hz all day to produce nothing
   * anybody reads.
   *
   * A TRIP OPEN COUNTS, NOT JUST A DETECTOR OUT OF IDLE. A manually started
   * trip deliberately bypasses detection, so the detector sits at 'idle' for
   * its whole length; gating on the detector's state alone would mean a driver
   * who pressed start got no pickup counting at all, which is the fabricated
   * zero `cd35366` fixed, reintroduced by a different door.
   */
  get needsMotionSensing(): boolean {
    return this.openTripId !== null || this.opening || this.detector.state !== 'idle';
  }

  /**
   * Where the "run the accelerometer now" instruction goes.
   *
   * The decision lives here because this file is unit-tested and the native
   * wiring in lib/driveMonitorInstance.ts is proved on a simulator. Called
   * only on a CHANGE, and called once on registration so a sink attached
   * mid-trip is told what is already true rather than assuming a sensor it
   * cannot see is off.
   */
  setMotionSensingSink(sink: ((needed: boolean) => void) | null): void {
    this.motionSink = sink;
    this.motionReported = false;
    if (sink) this.syncMotionSensing();
  }

  /**
   * Never throws. This runs off the same path as a location fix, and a monitor
   * that dies because a sensor could not be started stops noticing drives for
   * the rest of the day with nothing telling the driver.
   */
  private syncMotionSensing(): void {
    const needed = this.needsMotionSensing;
    if (needed === this.motionReported) return;
    this.motionReported = needed;
    try {
      this.motionSink?.(needed);
    } catch {
      // A sensor that will not start is not a reason to lose the drive.
    }
  }

  arm(): void {
    this.armed = true;
  }

  /** Stops watching for NEW drives. A trip already open is left alone. */
  disarm(): void {
    this.armed = false;
    this.buffer = [];
    if (this.openTripId === null) this.detector.reset();
    this.syncMotionSensing();
  }

  /** Latest accelerometer variance, used only to corroborate a start. */
  onAccelVariance(variance: number | null): void {
    this.accelVariance = variance;
  }

  /**
   * Where the running phone-pickup count comes from.
   *
   * A SOURCE rather than a pushed number, because the previous shape
   * (onPhonePickupCount) was never called by any app code: every trip Driiva
   * has ever submitted carried a fabricated zero, and phone usage, which is
   * 10% of the driving score, silently scored a perfect 100 every time. A
   * source the monitor pulls from cannot be forgotten by a caller, and the
   * absence of one is visible here rather than indistinguishable from a real
   * zero.
   *
   * The detector runs for as long as detection is armed, not for as long as a
   * screen is mounted, so the count is rebased when a trip opens.
   */
  setPickupSource(read: (() => number) | null): void {
    this.readPickups = read;
  }

  /**
   * The SYNCHRONOUS door, so the monitor can be handed straight to the
   * background location task as a PointBuffer.
   *
   * Work is serialised behind one chain rather than fired off per fix: fixes
   * arrive faster than a trip can be created over the network, and two of them
   * deciding to open a trip in parallel is how one drive becomes two half
   * trips. Never throws, because this is called from a sensor callback.
   */
  add(sample: SampledLocation): void {
    this.queue = this.queue.then(() => this.onLocation(sample)).catch(() => undefined);
  }

  /** Resolves once every queued fix has been handled. For tests and teardown. */
  async drained(): Promise<void> {
    await this.queue;
  }

  /**
   * Advance wall-clock time without a fix, so a drive can end when the fixes
   * stop arriving at all. A parked car stops moving, and a location service
   * with nothing new to say eventually says nothing; without this the trip
   * stays open until somebody notices. Invents no sample and can only end a
   * drive, never open one.
   */
  async tick(now: number): Promise<void> {
    try {
      if (this.openTripId === null) return;
      // A manual trip is the driver's to end.
      if (this.startedBy === 'manual') return;

      const event = this.detector.tick(now);
      if (event.type === 'drive_ended') await this.closeTrip();
      else if (event.type === 'drive_discarded') await this.discardTrip();
    } finally {
      this.syncMotionSensing();
    }
  }

  async onLocation(sample: SampledLocation): Promise<void> {
    try {
      await this.handleLocation(sample);
    } finally {
      this.syncMotionSensing();
    }
  }

  private async handleLocation(sample: SampledLocation): Promise<void> {
    // A trip in progress always gets the fix, whether detection opened it or
    // the driver did. The writer's own gate decides whether to keep it.
    if (this.writer) this.writer.add(sample);

    if (!this.armed && this.openTripId === null) return;

    // A manually started trip is the driver's to end. Running detection over
    // it could discard a slow drive they explicitly asked to record.
    if (this.openTripId !== null && this.startedBy === 'manual') return;

    if (this.openTripId === null) this.remember(sample);

    const event = this.detector.push(this.toDetectionSample(sample));

    switch (event.type) {
      case 'drive_started':
        await this.openTrip(event.since);
        return;
      case 'drive_ended':
        await this.closeTrip();
        return;
      case 'drive_discarded':
        await this.discardTrip();
        return;
      default:
        return;
    }
  }

  /**
   * The driver pressed start. Opens a trip now, without waiting for detection.
   *
   * Routed through the SAME queue as add(), so a tap cannot interleave with a
   * queued fix that is already partway through opening a trip. Without this a
   * driver who tapped at the wrong moment got two trips for one drive, and the
   * loser was stranded in 'recording' with nothing able to close it.
   */
  async startManually(at: SampledLocation): Promise<void> {
    const work = this.queue.then(() => this.doStartManually(at)).catch(() => undefined);
    this.queue = work;
    await work;
  }

  private async doStartManually(at: SampledLocation): Promise<void> {
    try {
      if (this.openTripId !== null || this.opening) return;
      const opened = await this.open(at, 'manual', at.timestamp);
      if (opened) this.writer?.add(at);
    } finally {
      this.syncMotionSensing();
    }
  }

  /** The driver pressed stop. */
  async stopManually(): Promise<void> {
    try {
      if (this.openTripId === null) return;
      await this.closeTrip();
    } finally {
      this.syncMotionSensing();
    }
  }

  private toDetectionSample(sample: SampledLocation): DetectionSample {
    return {
      t: sample.timestamp,
      speedMps: sample.speed,
      accuracyM: sample.accuracy,
      accelVariance: this.accelVariance,
    };
  }

  /** Bounded ring: the oldest fix falls off rather than the newest. */
  private remember(sample: SampledLocation): void {
    this.buffer.push(sample);
    if (this.buffer.length > MAX_PRETRIP_SAMPLES) {
      this.buffer.splice(0, this.buffer.length - MAX_PRETRIP_SAMPLES);
    }
  }

  private async openTrip(since: number): Promise<void> {
    // Never a second trip over an open one, or over one being opened.
    if (this.openTripId !== null || this.opening) return;

    const backfill = this.buffer.filter((s) => s.timestamp >= since);
    const first = backfill[0] ?? this.buffer[this.buffer.length - 1];
    if (!first) return;

    const opened = await this.open(first, 'auto', first.timestamp);
    if (!opened) return;

    for (const sample of backfill) {
      this.writer?.add(sample);
    }
    this.buffer = [];
  }

  private async open(
    at: SampledLocation,
    startedBy: 'auto' | 'manual',
    tripStartMs: number,
  ): Promise<boolean> {
    this.opening = true;
    try {
      const tripId = await this.port.startTrip({ lat: at.latitude, lng: at.longitude });
      this.openTripId = tripId;
      this.openedAt = tripStartMs;
      this.startedBy = startedBy;
      this.outcome = null;
      this.pickupBaseline = this.readPickups?.() ?? 0;
      const writer = this.port.createWriter(tripId, tripStartMs);
      writer.start();
      this.writer = writer;
      return true;
    } catch {
      // Offline, or rules refused. Do not throw out of a sensor callback: a
      // monitor that dies here stops noticing drives for the rest of the day
      // and nothing tells the driver.
      this.outcome = 'start_failed';
      this.resetForNextDrive();
      return false;
    } finally {
      this.opening = false;
    }
  }

  private async closeTrip(): Promise<void> {
    const tripId = this.openTripId;
    const writer = this.writer;
    const startedBy = this.startedBy;
    const pickups = this.pickupCount;
    if (!tripId || !writer) {
      this.resetForNextDrive();
      return;
    }

    const last = writer.lastAcceptedSample;
    let totals;
    try {
      totals = await writer.stop();
    } catch {
      // The flush failed, not the measurement. The writer still knows how long
      // its trace covers, and filling in a zero here would describe a trip that
      // covered real ground in no time at all.
      totals = {
        pointsCount: writer.pointsCount,
        distanceMeters: writer.distance,
        durationSeconds: writer.durationSeconds,
        rejectedPoints: 0,
        droppedPoints: 0,
      };
    }

    // No accepted fix means no end position and nothing to score. The previous
    // code wrote 0,0, which is a real place in the Gulf of Guinea and which the
    // server cannot tell apart from a measurement.
    if (!last) {
      await this.port.discard(tripId, 'cancelled').catch(() => undefined);
      this.outcome = 'nothing_captured';
      this.resetForNextDrive();
      return;
    }

    try {
      await this.port.submit(tripId, {
        end: { lat: last.latitude, lng: last.longitude },
        distanceMeters: totals.distanceMeters,
        pointsCount: totals.pointsCount,
        durationSeconds: totals.durationSeconds,
        phonePickupCount: pickups,
        startedBy,
      });
      this.outcome = 'submitted';
    } catch {
      // The points are already written; only the status flip failed. Say so
      // rather than pretending the trip landed.
      this.outcome = 'submit_failed';
    }
    this.resetForNextDrive();
  }

  private async discardTrip(): Promise<void> {
    const tripId = this.openTripId;
    const writer = this.writer;
    if (tripId && writer) {
      await writer.stop().catch(() => undefined);
      await this.port.discard(tripId, 'not_a_drive').catch(() => undefined);
    }
    this.outcome = 'not_a_drive';
    this.resetForNextDrive();
  }

  private resetForNextDrive(): void {
    this.openTripId = null;
    this.openedAt = null;
    this.writer = null;
    this.buffer = [];
    this.startedBy = 'auto';
    this.pickupBaseline = 0;
    this.detector.reset();
  }
}


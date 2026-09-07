/**
 * DRIVE MONITOR: motion sensing
 * =============================
 * Split out of tests/unit/mobile-drive-monitor.test.ts, which had grown past
 * the 500-line ceiling. These two suites cover the accelerometer duty cycle
 * and what a cold sensor does to the corroboration window. The harness they
 * run against is shared with the other DriveMonitor suites in
 * helpers/driveMonitorHarness.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DETECTION } from '../../mobile/lib/driveDetection';
import { DriveMonitor, MAX_PRETRIP_SAMPLES } from '../../mobile/lib/driveMonitor';
import type { SampledLocation } from '../../shared/trip-capture';
import { T0, feed, fix, makePort, makeWriter } from './helpers/driveMonitorHarness';

let port: ReturnType<typeof makePort>;
let monitor: DriveMonitor;

beforeEach(() => {
  port = makePort();
  monitor = new DriveMonitor(port);
});

/**
 * MOTION SENSING DUTY CYCLE
 * ==========================
 * Review finding 7. Two accelerometer listeners were started the moment
 * detection was armed and left running until it was disarmed, which is all
 * day, at 5 Hz. Between drives neither of them does any work that is ever
 * read: the gait check exists only to shorten the start hold from 20 s to
 * 10 s once a candidate appears, and the pickup count is rebased when a trip
 * opens, so everything it counted beforehand is thrown away. An all-day
 * sensor paying for that is a poor trade against a phone battery.
 *
 * The monitor is the only thing that knows when the sensors are worth their
 * cost, so it says so, and the native wiring in lib/driveMonitorInstance.ts
 * does as it is told. That keeps the decision here, where it is tested,
 * rather than in the adapter, which is proved on a simulator.
 *
 * THE TRAP THIS PINS. Gating on the detector's state alone would be wrong.
 * A manually started trip deliberately bypasses detection, so the detector
 * sits at 'idle' for its whole length - and gating on state alone would mean
 * a driver who pressed start had no phone-pickup counting at all. That is
 * exactly the shape of the bug `cd35366` fixed, where every trip submitted a
 * fabricated zero and phone usage scored a perfect 100.
 */
describe('DriveMonitor: motion sensing duty cycle', () => {
  function withSink() {
    const changes: boolean[] = [];
    monitor.setMotionSensingSink((on) => changes.push(on));
    return changes;
  }

  it('does not ask for the accelerometer while it is idle', () => {
    const changes = withSink();
    monitor.arm();

    expect(monitor.needsMotionSensing).toBe(false);
    expect(changes).toEqual([]);
  });

  it('asks for the accelerometer as soon as a candidate drive appears', async () => {
    const changes = withSink();
    monitor.arm();
    await feed(monitor, T0, 2, 20);

    expect(monitor.needsMotionSensing).toBe(true);
    expect(changes).toEqual([true]);
  });

  it('lets it go again when the candidate turns out to be nothing', async () => {
    const changes = withSink();
    monitor.arm();
    await feed(monitor, T0, 2, 20);
    await feed(monitor, T0 + 2000, 2, 0);

    expect(monitor.needsMotionSensing).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('holds it for the whole trip and releases it once the trip is submitted', async () => {
    const changes = withSink();
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    expect(monitor.needsMotionSensing).toBe(true);

    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.submit).toHaveBeenCalledTimes(1);
    expect(monitor.needsMotionSensing).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('asks for it on a manual start, where detection never leaves idle', async () => {
    const changes = withSink();
    monitor.arm();
    await monitor.startManually(fix(T0, 0));

    expect(monitor.driveState).toBe('idle');
    expect(monitor.needsMotionSensing).toBe(true);
    expect(changes).toEqual([true]);
  });

  it('releases it when the driver ends a manual trip', async () => {
    const changes = withSink();
    monitor.arm();
    await monitor.startManually(fix(T0, 0));
    await monitor.stopManually();

    expect(monitor.needsMotionSensing).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('reports only changes, so a fix a second does not restart the sensor', async () => {
    const changes = withSink();
    monitor.arm();
    await feed(monitor, T0, 25, 20);

    expect(changes).toEqual([true]);
  });

  it('keeps asking while a trip is open even after detection is disarmed', async () => {
    const changes = withSink();
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    monitor.disarm();

    expect(monitor.needsMotionSensing).toBe(true);
    expect(changes).toEqual([true]);
  });

  it('lets it go when disarmed with no trip open', async () => {
    const changes = withSink();
    monitor.arm();
    await feed(monitor, T0, 2, 20);
    monitor.disarm();

    expect(monitor.needsMotionSensing).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('tells a sink registered mid-trip what is already true', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);

    const changes = withSink();

    expect(changes).toEqual([true]);
  });

  it('survives a sink that throws, because it is called from a sensor path', async () => {
    monitor.setMotionSensingSink(() => { throw new Error('sensor unavailable'); });
    monitor.arm();

    await expect(feed(monitor, T0, 25, 20)).resolves.not.toThrow();
    expect(port.startTrip).toHaveBeenCalledTimes(1);
  });
});

/**
 * The corroboration window has to survive the sensor being off until a
 * candidate appears: variance is null for the first few seconds of every
 * candidate now, because the window needs filling before it means anything.
 * A drive still has to open on the short hold once it arrives, or the duty
 * cycle would have quietly cost every driver ten seconds of every trip.
 */
describe('DriveMonitor: corroboration with a cold accelerometer', () => {
  it('still opens on the short hold when variance arrives part way through', async () => {
    monitor.arm();
    await feed(monitor, T0, 5, 20);
    expect(port.startTrip).not.toHaveBeenCalled();

    monitor.onAccelVariance(DETECTION.GAIT_VARIANCE_G2 / 2);
    await feed(monitor, T0 + 5000, 7, 20);

    expect(port.startTrip).toHaveBeenCalledTimes(1);
  });
});

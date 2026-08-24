/**
 * DRIVE MONITOR
 * =============
 * The thing that turns a DriveDetector decision into a real trip. It owns the
 * awkward part: the driver is already driving by the time detection is
 * confident, so the points captured BEFORE the decision have to survive.
 *
 * Written against injected ports rather than expo and Firestore directly, so
 * the orchestration is exercised here for real (this file mocks the ports, not
 * the monitor) and the native wiring stays a thin adapter with no logic in it.
 *
 * The failure modes these pin:
 *
 *  - Losing the start of every automatic trip. Detection takes 10 to 20
 *    seconds to be sure. Without a backfill, every auto trip begins with the
 *    driver already at speed, the trace starts mid-road, and the trip is
 *    scored on a journey that is missing its pull-away.
 *  - An unbounded pre-trip buffer. The monitor is armed all day, so the buffer
 *    it keeps "just in case" is the one thing here that could grow forever.
 *  - Scoring a journey that was never a drive. A discarded candidate must
 *    reach `discard`, never `submit`, or a cyclist gets a driving score.
 *  - A monitor that dies on a network error. startTrip can fail; the monitor
 *    has to return to a state where the NEXT drive still opens.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DETECTION } from '../../mobile/lib/driveDetection';
import {
  DriveMonitor,
  MAX_PRETRIP_SAMPLES,
  type PointWriterPort,
  type TripPort,
} from '../../mobile/lib/driveMonitor';
import type { SampledLocation } from '../../shared/trip-capture';

const T0 = 1_700_000_000_000;

function fix(t: number, speedMps: number | null, accuracyM = 5): SampledLocation {
  return { latitude: 51.5 + t * 1e-7, longitude: -0.12, speed: speedMps, heading: 90, accuracy: accuracyM, timestamp: t };
}

function makeWriter(): PointWriterPort & { added: SampledLocation[] } {
  const added: SampledLocation[] = [];
  return {
    added,
    start: vi.fn(),
    add: vi.fn((s: SampledLocation) => { added.push(s); }),
    stop: vi.fn(async () => ({
      pointsCount: added.length,
      distanceMeters: 1234,
      durationSeconds: 120,
      rejectedPoints: 0,
      droppedPoints: 0,
    })),
    get pointsCount() { return added.length; },
    get distance() { return 1234; },
    get lastAcceptedSample() { return added[added.length - 1] ?? null; },
  };
}

function makePort(writer = makeWriter()) {
  const port: TripPort & { writer: typeof writer } = {
    writer,
    startTrip: vi.fn(async () => 'trip-1'),
    createWriter: vi.fn(() => writer),
    submit: vi.fn(async () => undefined),
    discard: vi.fn(async () => undefined),
  };
  return port;
}

/** Feed GPS fixes a second apart. */
async function feed(m: DriveMonitor, from: number, seconds: number, speedMps: number | null, accuracyM = 5) {
  for (let i = 0; i < seconds; i++) {
    await m.onLocation(fix(from + i * 1000, speedMps, accuracyM));
  }
}

let port: ReturnType<typeof makePort>;
let monitor: DriveMonitor;

beforeEach(() => {
  port = makePort();
  monitor = new DriveMonitor(port);
});

describe('DriveMonitor: arming', () => {
  it('does not watch for drives until it is armed', async () => {
    await feed(monitor, T0, 40, 20);

    expect(port.startTrip).not.toHaveBeenCalled();
  });

  it('opens a trip by itself once armed and a drive is detected', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);

    expect(port.startTrip).toHaveBeenCalledTimes(1);
    expect(monitor.tripId).toBe('trip-1');
  });

  it('stops watching when disarmed, without touching a trip already running', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    monitor.disarm();

    expect(monitor.tripId).toBe('trip-1');
    expect(port.discard).not.toHaveBeenCalled();
  });
});

describe('DriveMonitor: not losing the start of the drive', () => {
  it('backfills every point from the moment the candidate began', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);

    // 21 fixes span T0 to T0+20s, which is when the drive was declared, and
    // all of them are already driving.
    const timestamps = port.writer.added.map((s) => s.timestamp);
    expect(timestamps[0]).toBe(T0);
    expect(timestamps).toHaveLength(25);
  });

  it('backfills in chronological order', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);

    const timestamps = port.writer.added.map((s) => s.timestamp);
    expect([...timestamps].sort((a, b) => a - b)).toEqual(timestamps);
  });

  it('does not backfill fixes from before the candidate began', async () => {
    monitor.arm();
    await feed(monitor, T0, 30, 0.5);           // parked, then
    await feed(monitor, T0 + 30_000, 25, 20);   // pulls away

    expect(port.writer.added[0].timestamp).toBe(T0 + 30_000);
  });

  it('keeps feeding the writer live once the trip is open', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    const afterOpen = port.writer.added.length;
    await feed(monitor, T0 + 25_000, 10, 20);

    expect(port.writer.added.length).toBe(afterOpen + 10);
  });

  it('bounds the pre-trip buffer rather than growing all day', async () => {
    monitor.arm();
    await feed(monitor, T0, MAX_PRETRIP_SAMPLES + 200, 0.5);

    expect(monitor.bufferedSampleCount).toBe(MAX_PRETRIP_SAMPLES);
  });
});

describe('DriveMonitor: ending a drive', () => {
  it('submits the trip for scoring when the drive ends', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.submit).toHaveBeenCalledTimes(1);
    expect(port.discard).not.toHaveBeenCalled();
  });

  it('records that the trip was started automatically', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.submit).toHaveBeenCalledWith('trip-1', expect.objectContaining({ startedBy: 'auto' }));
  });

  it('stops the writer before submitting, so the last batch is flushed', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.writer.stop).toHaveBeenCalled();
  });

  it('is ready for the next drive after one ends', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);
    await feed(monitor, T0 + 400_000, 25, 20);

    expect(port.startTrip).toHaveBeenCalledTimes(2);
  });
});

describe('DriveMonitor: a journey that was not a drive', () => {
  it('discards rather than submits', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 5);
    await feed(monitor, T0 + 25_000, 130, 5);

    expect(port.discard).toHaveBeenCalledTimes(1);
    expect(port.submit).not.toHaveBeenCalled();
  });

  it('gives the honest reason, not a generic cancel', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 5);
    await feed(monitor, T0 + 25_000, 130, 5);

    expect(port.discard).toHaveBeenCalledWith('trip-1', 'not_a_drive');
  });

  it('leaves a note the screen can show, rather than vanishing silently', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 5);
    await feed(monitor, T0 + 25_000, 130, 5);

    expect(monitor.lastOutcome).toBe('not_a_drive');
  });
});

describe('DriveMonitor: manual override', () => {
  it('starts a trip immediately when the driver asks, without waiting for detection', async () => {
    monitor.arm();
    await monitor.startManually(fix(T0, 0));

    expect(port.startTrip).toHaveBeenCalledTimes(1);
    expect(monitor.tripId).toBe('trip-1');
  });

  it('records that the trip was started by hand', async () => {
    monitor.arm();
    await monitor.startManually(fix(T0, 0));
    await feed(monitor, T0 + 1000, 5, 15);
    await monitor.stopManually();

    expect(port.submit).toHaveBeenCalledWith('trip-1', expect.objectContaining({ startedBy: 'manual' }));
  });

  it('does not open a second trip when detection fires during a manual one', async () => {
    monitor.arm();
    await monitor.startManually(fix(T0, 0));
    await feed(monitor, T0 + 1000, 40, 20);

    expect(port.startTrip).toHaveBeenCalledTimes(1);
  });

  it('does not discard a manually started trip for being slow', async () => {
    monitor.arm();
    await monitor.startManually(fix(T0, 0));
    await feed(monitor, T0 + 1000, 200, 2);

    expect(port.discard).not.toHaveBeenCalled();
  });
});

describe('DriveMonitor: it must survive a bad day', () => {
  it('does not throw when the trip cannot be created', async () => {
    port.startTrip = vi.fn(async () => { throw new Error('offline'); });
    monitor.arm();

    await expect(feed(monitor, T0, 25, 20)).resolves.not.toThrow();
    expect(monitor.tripId).toBeNull();
  });

  it('can still open the next drive after a failed start', async () => {
    let calls = 0;
    port.startTrip = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('offline');
      return 'trip-2';
    });
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 100_000, 30, 0.2);
    await feed(monitor, T0 + 200_000, 25, 20);

    expect(monitor.tripId).toBe('trip-2');
  });

  it('does not throw when submitting fails, and says so', async () => {
    port.submit = vi.fn(async () => { throw new Error('offline'); });
    monitor.arm();
    await feed(monitor, T0, 25, 20);

    await expect(feed(monitor, T0 + 25_000, 190, 0)).resolves.not.toThrow();
    expect(monitor.lastOutcome).toBe('submit_failed');
  });

  it('ignores a fix with no usable speed rather than feeding it to detection as a zero', async () => {
    monitor.arm();
    await feed(monitor, T0, 40, null);

    expect(port.startTrip).not.toHaveBeenCalled();
  });
});

describe('DriveMonitor: accelerometer corroboration', () => {
  it('opens the trip sooner when motion agrees it is not a gait', async () => {
    monitor.arm();
    monitor.onAccelVariance(DETECTION.GAIT_VARIANCE_G2 / 2);
    await feed(monitor, T0, 12, 20);

    expect(port.startTrip).toHaveBeenCalledTimes(1);
  });

  it('does not hurry when motion reads like walking', async () => {
    monitor.arm();
    monitor.onAccelVariance(DETECTION.GAIT_VARIANCE_G2 * 3);
    await feed(monitor, T0, 12, 20);

    expect(port.startTrip).not.toHaveBeenCalled();
  });
});

/**
 * The background location task hands fixes to a PointBuffer, which is a
 * synchronous `add`. The monitor's work is asynchronous (it creates trips), so
 * it exposes `add` as the sync door and drains behind one promise chain.
 *
 * Serialised deliberately: two fixes arriving while startTrip is still in
 * flight must not both decide to open a trip, which is how a driver ends up
 * with two half-trips for one drive.
 */
describe('DriveMonitor: as the background task sink', () => {
  it('accepts fixes synchronously and drains them in order', async () => {
    monitor.arm();
    for (let i = 0; i < 25; i++) monitor.add(fix(T0 + i * 1000, 20));
    await monitor.drained();

    expect(port.startTrip).toHaveBeenCalledTimes(1);
    expect(port.writer.added.map((s) => s.timestamp)).toEqual(
      [...port.writer.added].map((s) => s.timestamp).sort((a, b) => a - b),
    );
  });

  it('opens exactly one trip even when fixes arrive faster than the trip can be created', async () => {
    let resolveStart: ((id: string) => void) | null = null;
    port.startTrip = vi.fn(
      () => new Promise<string>((resolve) => { resolveStart = resolve; }),
    );
    monitor.arm();
    for (let i = 0; i < 40; i++) monitor.add(fix(T0 + i * 1000, 20));

    // The queue is a microtask chain, so let it run until it actually reaches
    // startTrip before unblocking it. Resolving before that would be resolving
    // a promise that does not exist yet, which is what made the first version
    // of this test hang rather than fail.
    while (resolveStart === null) await new Promise((r) => setTimeout(r, 1));
    (resolveStart as (id: string) => void)('trip-1');
    await monitor.drained();

    expect(port.startTrip).toHaveBeenCalledTimes(1);
  });

  it('never throws out of the synchronous door, whatever the port does', async () => {
    port.startTrip = vi.fn(async () => { throw new Error('offline'); });
    monitor.arm();

    expect(() => {
      for (let i = 0; i < 25; i++) monitor.add(fix(T0 + i * 1000, 20));
    }).not.toThrow();
    await expect(monitor.drained()).resolves.toBeUndefined();
  });
});

describe('DriveMonitor: the readout the screen renders', () => {
  it('reads nothing before a trip is open, rather than a stale or invented number', () => {
    expect(monitor.lastSample).toBeNull();
    expect(monitor.distanceMeters).toBe(0);
    expect(monitor.pointsCount).toBe(0);
  });

  it('reads through to the writer once a trip is open, whichever path delivered the fix', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);

    expect(monitor.lastSample?.timestamp).toBe(T0 + 24_000);
    expect(monitor.distanceMeters).toBe(1234);
    expect(monitor.pointsCount).toBe(25);
  });

  it('returns to nothing after the trip closes', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(monitor.lastSample).toBeNull();
    expect(monitor.distanceMeters).toBe(0);
  });

  it('carries the phone pickup count through to submission', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    monitor.onPhonePickupCount(3);
    expect(monitor.pickupCount).toBe(3);
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.submit).toHaveBeenCalledWith('trip-1', expect.objectContaining({ phonePickupCount: 3 }));
  });
});

describe('DriveMonitor: elapsed is measured from the drive, not from the screen', () => {
  it('reports nothing before a trip opens', () => {
    expect(monitor.tripStartedAt).toBeNull();
  });

  it('reports when the drive actually began, not when detection became sure', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);

    // Detection is confident at T0+20s, but the driver set off at T0 and the
    // backfilled points prove it. Timing from the decision would under-report
    // every automatic trip by the length of the start hold.
    expect(monitor.tripStartedAt).toBe(T0);
  });

  it('reports the moment of the press for a manual trip', async () => {
    monitor.arm();
    await monitor.startManually(fix(T0 + 5_000, 0));

    expect(monitor.tripStartedAt).toBe(T0 + 5_000);
  });

  it('clears when the trip closes', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(monitor.tripStartedAt).toBeNull();
  });
});

describe('DriveMonitor: ending when the fixes stop', () => {
  it('submits the trip when nothing has moved for the stop hold, with no further fixes', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);

    await monitor.tick(T0 + 24_000 + DETECTION.PAUSE_HOLD_MS);
    await monitor.tick(T0 + 24_000 + DETECTION.STOP_HOLD_MS);

    expect(port.submit).toHaveBeenCalledTimes(1);
    expect(monitor.tripId).toBeNull();
  });

  it('does nothing when no trip is open', async () => {
    monitor.arm();
    await monitor.tick(T0 + 10_000_000);

    expect(port.submit).not.toHaveBeenCalled();
    expect(port.startTrip).not.toHaveBeenCalled();
  });

  it('never ends a manually started trip on a tick, because that is the driver decision', async () => {
    monitor.arm();
    await monitor.startManually(fix(T0, 0));
    await monitor.tick(T0 + 999_000_000);

    expect(port.submit).not.toHaveBeenCalled();
    expect(monitor.tripId).toBe('trip-1');
  });
});

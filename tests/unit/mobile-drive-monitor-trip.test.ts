/**
 * DRIVE MONITOR: what reaches the trip
 * ====================================
 * Split out of tests/unit/mobile-drive-monitor.test.ts, which had grown past
 * the 500-line ceiling. These three suites are the fabricated-input findings:
 * a pickup count nothing ever wrote, two trips opened for one drive, and the
 * two invented numbers in closeTrip. The harness they run against is shared
 * with the other DriveMonitor suites in helpers/driveMonitorHarness.ts.
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
 * PHONE PICKUPS WERE ALWAYS ZERO
 * ===============================
 * Caught in review, and it is the worst kind of bug this codebase has a name
 * for: a FABRICATED INPUT. onPhonePickupCount existed, was covered by a test,
 * and was never called by any app code. Every trip therefore submitted
 * clientReportedPhonePickupCount 0, the server sanitised that honest-looking
 * zero, and phone usage (10% of the driving score, SCORE_WEIGHTS.phoneUsage)
 * silently contributed a perfect 100 to every score Driiva has ever produced.
 *
 * It hid because the detector was owned by the Drive SCREEN, and an
 * automatically detected drive is exactly the case where that screen is not
 * mounted. It hid a second time because the simulator has no accelerometer, so
 * a real zero on the simulator looked like the right answer and I reported it
 * as one.
 *
 * The fix moves the counter to where the trip lives. The monitor takes a
 * pickup SOURCE, reads it live, and rebases at the start of each trip so one
 * drive never inherits the previous drive's pickups.
 */
describe('DriveMonitor: phone pickups reach the trip', () => {
  it('submits zero when there is no pickup source at all, rather than pretending', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.submit).toHaveBeenCalledWith('trip-1', expect.objectContaining({ phonePickupCount: 0 }));
  });

  it('submits what the source actually counted during the trip', async () => {
    let counted = 0;
    monitor.setPickupSource(() => counted);
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    counted = 4;
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.submit).toHaveBeenCalledWith('trip-1', expect.objectContaining({ phonePickupCount: 4 }));
  });

  it('submits zero when the source ran and genuinely saw nothing', async () => {
    monitor.setPickupSource(() => 0);
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.submit).toHaveBeenCalledWith('trip-1', expect.objectContaining({ phonePickupCount: 0 }));
  });

  it('rebases at the start of a trip so one drive never inherits the last one', async () => {
    let counted = 7; // the source has been running all day
    monitor.setPickupSource(() => counted);
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    counted = 9; // two pickups during THIS drive
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.submit).toHaveBeenCalledWith('trip-1', expect.objectContaining({ phonePickupCount: 2 }));
  });

  it('reads the live count while the trip is open, for the screen', async () => {
    let counted = 3;
    monitor.setPickupSource(() => counted);
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    counted = 6;

    expect(monitor.pickupCount).toBe(3);
  });

  it('never reports a negative count if the source is reset under it', async () => {
    let counted = 5;
    monitor.setPickupSource(() => counted);
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    counted = 0;

    expect(monitor.pickupCount).toBe(0);
  });

  it('reports nothing when no trip is open', () => {
    monitor.setPickupSource(() => 12);

    expect(monitor.pickupCount).toBe(0);
  });
});

/**
 * TWO TRIPS FOR ONE DRIVE
 * ========================
 * Review finding. startManually checked openTripId and then awaited
 * port.startTrip, but it did not go through the same serialisation queue that
 * add() uses. So a driver tapping "start a drive now" at the moment a queued
 * fix was already inside openTrip's awaited startTrip saw both pass the
 * openTripId === null check, and two trips opened for one drive. The loser is
 * stranded in 'recording' forever, because only one of them can ever be
 * closed.
 *
 * The same window exists between two queued fixes, which is why open() also
 * carries a synchronous flag: the queue orders the work, the flag closes the
 * await gap inside it.
 */
describe('DriveMonitor: one drive is one trip', () => {
  it('does not open a second trip when a manual start races a queued fix', async () => {
    let resolveStart: ((id: string) => void) | null = null;
    port.startTrip = vi.fn(() => new Promise<string>((resolve) => { resolveStart = resolve; }));
    monitor.arm();

    for (let i = 0; i < 25; i++) monitor.add(fix(T0 + i * 1000, 20));
    while (resolveStart === null) await new Promise((r) => setTimeout(r, 1));

    // The tap lands while the automatic open is still awaiting the network.
    const tap = monitor.startManually(fix(T0 + 25_000, 0));
    (resolveStart as (id: string) => void)('trip-1');
    await tap;
    await monitor.drained();

    expect(port.startTrip).toHaveBeenCalledTimes(1);
  });

  it('does not open a second trip when two manual starts race each other', async () => {
    let resolveStart: ((id: string) => void) | null = null;
    port.startTrip = vi.fn(() => new Promise<string>((resolve) => { resolveStart = resolve; }));
    monitor.arm();

    const first = monitor.startManually(fix(T0, 0));
    const second = monitor.startManually(fix(T0 + 500, 0));
    while (resolveStart === null) await new Promise((r) => setTimeout(r, 1));
    (resolveStart as (id: string) => void)('trip-1');
    await Promise.all([first, second]);

    expect(port.startTrip).toHaveBeenCalledTimes(1);
  });

  it('still opens a manual trip normally when nothing is racing it', async () => {
    monitor.arm();
    await monitor.startManually(fix(T0, 0));

    expect(port.startTrip).toHaveBeenCalledTimes(1);
    expect(monitor.tripId).toBe('trip-1');
  });
});

/**
 * TWO MORE FABRICATED NUMBERS IN closeTrip
 * =========================================
 * Both review findings, both the same sin as the pickup count.
 *
 * `end: { lat: last?.latitude ?? 0, lng: last?.longitude ?? 0 }` wrote 0,0 as
 * a MEASURED end position when no fix had ever been accepted. Null Island is a
 * real coordinate in the Gulf of Guinea, and a trip claiming to end there is
 * worse than one that admits it does not know: the server cannot tell the
 * difference. A trip with no accepted points has nothing to score anyway, so
 * it is discarded rather than submitted with an invented ending.
 *
 * And the writer.stop() failure path filled in durationSeconds 0 while passing
 * a real distanceMeters through beside it, which describes a trip that covered
 * ground in no time at all. The writer still knows its own duration when the
 * flush fails, so the fallback asks it.
 */
describe('DriveMonitor: closeTrip invents nothing', () => {
  it('discards rather than submitting a trip that never accepted a fix', async () => {
    const emptyWriter = makeWriter();
    emptyWriter.stop = vi.fn(async () => ({
      pointsCount: 0, distanceMeters: 0, durationSeconds: 0, rejectedPoints: 0, droppedPoints: 0,
    }));
    Object.defineProperty(emptyWriter, 'lastAcceptedSample', { get: () => null });
    port.createWriter = vi.fn(() => emptyWriter);

    monitor.arm();
    await monitor.startManually(fix(T0, 0));
    await monitor.stopManually();

    expect(port.submit).not.toHaveBeenCalled();
    expect(port.discard).toHaveBeenCalledWith('trip-1', 'cancelled');
  });

  it('says plainly that nothing was captured, rather than claiming success', async () => {
    const emptyWriter = makeWriter();
    Object.defineProperty(emptyWriter, 'lastAcceptedSample', { get: () => null });
    port.createWriter = vi.fn(() => emptyWriter);

    monitor.arm();
    await monitor.startManually(fix(T0, 0));
    await monitor.stopManually();

    expect(monitor.lastOutcome).toBe('nothing_captured');
  });

  it('never writes 0,0 as a measured end position', async () => {
    const emptyWriter = makeWriter();
    Object.defineProperty(emptyWriter, 'lastAcceptedSample', { get: () => null });
    port.createWriter = vi.fn(() => emptyWriter);

    monitor.arm();
    await monitor.startManually(fix(T0, 0));
    await monitor.stopManually();

    const submitted = (port.submit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(submitted).toBeUndefined();
  });

  it('uses the writer own duration when the final flush fails, not zero', async () => {
    const failing = makeWriter();
    failing.stop = vi.fn(async () => { throw new Error('offline'); });
    Object.defineProperty(failing, 'durationSeconds', { get: () => 174 });
    port.createWriter = vi.fn(() => failing);

    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);

    expect(port.submit).toHaveBeenCalledWith('trip-1', expect.objectContaining({ durationSeconds: 174 }));
  });

  it('still submits a real end position when there is one', async () => {
    monitor.arm();
    await feed(monitor, T0, 25, 20);
    await feed(monitor, T0 + 25_000, 190, 0);

    const [, input] = (port.submit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(input.end.lat).not.toBe(0);
    expect(input.end.lng).not.toBe(0);
  });
});

/**
 * DRIVE DETECTOR: what does not count, and what the constants promise
 * ===================================================================
 * Split out of tests/unit/mobile-drive-detection.test.ts, which had grown past
 * the 500-line ceiling. These suites cover the potter that is not a drive, the
 * reset, the DETECTION constants themselves, and the case where the fixes stop
 * arriving. The builders are shared in helpers/driveDetectionHarness.ts.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  DETECTION,
  DriveDetector,
  type DetectionSample,
} from '../../mobile/lib/driveDetection';
import { T0, drive, sample } from './helpers/driveDetectionHarness';

describe('DriveDetector: a potter is not a drive', () => {
  it('discards a trip that never reaches a real road speed', () => {
    const d = new DriveDetector();
    drive(d, T0, 25, DETECTION.START_SPEED_MPS + 0.5);
    // Past the peak window, which is measured from the moment the drive was
    // declared, not from the first sample.
    const events = drive(d, T0 + 25_000, 130, DETECTION.START_SPEED_MPS + 0.5);

    expect(events.filter((e) => e.type === 'drive_discarded')).toHaveLength(1);
    expect(d.state).toBe('ended');
  });

  it('gives the discard an honest reason rather than calling it a stop', () => {
    const d = new DriveDetector();
    drive(d, T0, 25, 5);
    const events = drive(d, T0 + 25_000, 130, 5);
    const discarded = events.find((e) => e.type === 'drive_discarded');

    expect(discarded).toMatchObject({ reason: 'not_a_drive' });
  });

  it('keeps a trip that reaches road speed inside the window', () => {
    const d = new DriveDetector();
    drive(d, T0, 25, 5);
    drive(d, T0 + 25_000, 10, DETECTION.MIN_PEAK_SPEED_MPS + 2);
    const events = drive(d, T0 + 35_000, 130, 5);

    expect(events.filter((e) => e.type === 'drive_discarded')).toHaveLength(0);
    expect(d.state).toBe('driving');
  });

  it('does not re-judge a drive that already proved itself', () => {
    const d = new DriveDetector();
    drive(d, T0, 25, 20);
    const events = drive(d, T0 + 25_000, 200, 3);

    expect(events.filter((e) => e.type === 'drive_discarded')).toHaveLength(0);
  });

  it('reports the peak speed it actually saw, for the monitor to record', () => {
    const d = new DriveDetector();
    drive(d, T0, 25, 15);
    d.push(sample({ t: T0 + 25_000, speedMps: 31 }));

    expect(d.peakSpeedMps).toBe(31);
  });
});

describe('DriveDetector: reset', () => {
  it('returns to idle and forgets the previous drive', () => {
    const d = new DriveDetector();
    drive(d, T0, 25, 20);
    d.reset();

    expect(d.state).toBe('idle');
    expect(d.peakSpeedMps).toBe(0);
  });

  it('can detect a second drive after a reset', () => {
    const d = new DriveDetector();
    drive(d, T0, 25, 20);
    d.reset();
    const events = drive(d, T0 + 500_000, 25, 20);

    expect(events.filter((e) => e.type === 'drive_started')).toHaveLength(1);
  });
});

describe('DETECTION constants', () => {
  it('starts above running pace so a runner cannot open a trip', () => {
    // World-record marathon pace is about 5.7 m/s and a sprint is about 10,
    // but a sprint cannot be HELD for the start hold, which is what the
    // threshold plus the hold together are for.
    expect(DETECTION.START_SPEED_MPS).toBeGreaterThan(4);
  });

  it('requires a real road speed before a trip counts as a drive', () => {
    expect(DETECTION.MIN_PEAK_SPEED_MPS).toBeGreaterThan(DETECTION.START_SPEED_MPS);
  });

  it('pauses long before it ends, so traffic never ends a drive', () => {
    expect(DETECTION.PAUSE_HOLD_MS).toBeLessThan(DETECTION.STOP_HOLD_MS);
  });

  it('corroborated start is faster than uncorroborated, never slower', () => {
    expect(DETECTION.START_HOLD_CORROBORATED_MS).toBeLessThan(DETECTION.START_HOLD_MS);
  });
});

/**
 * WHEN THE FIXES SIMPLY STOP
 * ===========================
 * Found on the simulator, and it is not a simulator artefact. The machine only
 * ever reasoned about samples it was given, so it could only notice a car had
 * stopped if the phone kept reporting that it had stopped. A parked car does
 * not move, and a location service that has nothing new to say eventually says
 * nothing: the fixes dried up entirely and the trip stayed open, at speed, for
 * as long as anyone was willing to wait.
 *
 * Removing the distance filter was necessary and not sufficient. The real fix
 * is that the ABSENCE of movement is itself information, and the machine has to
 * be able to act on it. `tick` is how: it advances wall-clock time without
 * inventing a sample. Nothing is fabricated, no speed is assumed, no position
 * is guessed. It asks one question: how long has it been since anything
 * actually moved?
 */
describe('DriveDetector: ending when the fixes stop arriving', () => {
  function driving() {
    const d = new DriveDetector();
    drive(d, T0, 25, 15);
    return d;
  }

  it('does nothing while a drive is under way and time has barely passed', () => {
    const d = driving();

    expect(d.push(sample({ t: T0 + 25_000, speedMps: 15 })).type).toBe('none');
    expect(d.tick(T0 + 26_000).type).toBe('none');
    expect(d.state).toBe('driving');
  });

  it('pauses when nothing has moved for the pause hold, with no samples at all', () => {
    const d = driving();

    const event = d.tick(T0 + 24_000 + DETECTION.PAUSE_HOLD_MS);

    expect(event.type).toBe('drive_paused');
    expect(d.state).toBe('paused');
  });

  it('ends when nothing has moved for the stop hold, with no samples at all', () => {
    const d = driving();
    d.tick(T0 + 24_000 + DETECTION.PAUSE_HOLD_MS);

    const event = d.tick(T0 + 24_000 + DETECTION.STOP_HOLD_MS);

    expect(event).toMatchObject({ type: 'drive_ended', reason: 'stopped' });
    expect(d.state).toBe('ended');
  });

  it('counts from the last time anything MOVED, not from the last sample received', () => {
    const d = driving();
    // Stationary samples keep arriving for a while, then stop entirely. The
    // clock must run from the last MOVING fix at T0+24s, not from the last fix
    // received at T0+54s, or the trip ends thirty seconds late.
    drive(d, T0 + 25_000, 30, 0);

    // The machine steps through paused on its way to ended, deliberately: a
    // drive is never ended without first having been paused.
    expect(d.tick(T0 + 24_000 + DETECTION.PAUSE_HOLD_MS).type).toBe('drive_paused');
    expect(d.tick(T0 + 24_000 + DETECTION.STOP_HOLD_MS).type).toBe('drive_ended');
  });

  it('a tick can never start a drive, only end one', () => {
    const d = new DriveDetector();

    expect(d.tick(T0 + 10_000_000).type).toBe('none');
    expect(d.state).toBe('idle');
  });

  it('a tick does not resurrect an ended drive', () => {
    const d = driving();
    d.tick(T0 + 24_000 + DETECTION.PAUSE_HOLD_MS);
    d.tick(T0 + 24_000 + DETECTION.STOP_HOLD_MS);
    expect(d.state).toBe('ended');

    expect(d.tick(T0 + 999_000_000).type).toBe('none');
    expect(d.state).toBe('ended');
  });

  it('a tick still discards a journey that never reached a road speed', () => {
    const d = new DriveDetector();
    drive(d, T0, 25, 5);

    const event = d.tick(T0 + 24_000 + DETECTION.PEAK_WINDOW_MS);

    expect(event).toMatchObject({ type: 'drive_discarded', reason: 'not_a_drive' });
  });

  it('moving again after a tick-driven pause resumes the drive', () => {
    const d = driving();
    d.tick(T0 + 24_000 + DETECTION.PAUSE_HOLD_MS);

    const event = d.push(sample({ t: T0 + 24_000 + DETECTION.PAUSE_HOLD_MS + 1000, speedMps: 15 }));

    expect(event.type).toBe('drive_resumed');
    expect(d.state).toBe('driving');
  });
});

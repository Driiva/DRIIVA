/**
 * AUTOMATIC DRIVE DETECTION
 * ==========================
 * The headline claim: Driiva notices a drive starting, so the driver never has
 * to remember to press anything. Nothing on device did that before this. The
 * existing classifier (docs/HOW_WE_DETECT_REAL_DRIVING_VS_WALKING.md) is a
 * SERVER-SIDE, POST-HOC pass over a recording that already exists; it can tell
 * you afterwards which parts of a trace were driving, and it cannot start a
 * trip.
 *
 * This is the on-device half, and it is a state machine over timestamped
 * samples rather than a model, for three reasons: a phone must run it all day
 * on a battery, the decision has to be explainable to an insurer, and the same
 * inputs must always produce the same trip. Same posture as
 * lib/phonePickup.ts: documented, auditable, deterministic, and NOT calibrated
 * against labelled real-world data, because none exists yet.
 *
 * WHAT THE TESTS PIN, and why each one is a real failure mode:
 *
 *  - Walking never opens a trip. This is the one that matters. A telematics
 *    app that records a walk to the shops and scores it as driving produces a
 *    premium built on a lie. There is a property test over randomised
 *    walking-speed traces, not just an example.
 *  - A drive is not declared on one fast sample. GPS produces momentary
 *    garbage; the speed has to HOLD.
 *  - The points from before the decision are not lost. A trip that starts 20
 *    seconds late is missing its first 20 seconds of driving, so the detector
 *    reports when the candidate began and the monitor backfills.
 *  - Traffic does not end a trip. Stopping at lights pauses, and pausing keeps
 *    recording; only a long stationary spell ends it.
 *  - A slow potter that never reaches a real road speed is discarded rather
 *    than scored. A cyclist or a bus passenger must not be handed a driving
 *    score.
 *  - A fix the phone says it is unsure of is IGNORED, never repaired and never
 *    guessed at.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  DETECTION,
  DriveDetector,
  type DetectionSample,
} from '../../mobile/lib/driveDetection';
import { T0, drive, sample } from './helpers/driveDetectionHarness';

describe('DriveDetector: starting a drive', () => {
  it('starts idle', () => {
    expect(new DriveDetector().state).toBe('idle');
  });

  it('moves to candidate on the first sample at road speed, without declaring a drive', () => {
    const d = new DriveDetector();

    const event = d.push(sample({ t: T0, speedMps: DETECTION.START_SPEED_MPS }));

    expect(d.state).toBe('candidate');
    expect(event.type).toBe('none');
  });

  it('does not declare a drive from one fast sample', () => {
    const d = new DriveDetector();
    d.push(sample({ t: T0, speedMps: 20 }));

    expect(d.state).toBe('candidate');
  });

  it('declares a drive once road speed has held for the full start hold', () => {
    const d = new DriveDetector();
    const events = drive(d, T0, 25, 15);

    expect(d.state).toBe('driving');
    expect(events.filter((e) => e.type === 'drive_started')).toHaveLength(1);
  });

  it('declares the drive exactly once, not on every later sample', () => {
    const d = new DriveDetector();
    const events = drive(d, T0, 60, 15);

    expect(events.filter((e) => e.type === 'drive_started')).toHaveLength(1);
  });

  it('reports when the candidate began so the first seconds can be backfilled', () => {
    const d = new DriveDetector();
    const events = drive(d, T0, 25, 15);
    const started = events.find((e) => e.type === 'drive_started');

    expect(started).toMatchObject({ type: 'drive_started', since: T0 });
  });

  it('falls back to idle when the speed drops before the hold completes', () => {
    const d = new DriveDetector();
    drive(d, T0, 10, 15);
    d.push(sample({ t: T0 + 10_000, speedMps: 0.2 }));

    expect(d.state).toBe('idle');
  });

  it('restarts the hold from scratch after a drop, rather than resuming a part-served one', () => {
    const d = new DriveDetector();
    drive(d, T0, 19, 15);
    d.push(sample({ t: T0 + 19_000, speedMps: 0.2 }));
    const events = drive(d, T0 + 20_000, 5, 15);

    expect(events.every((e) => e.type === 'none')).toBe(true);
    expect(d.state).toBe('candidate');
  });

  it('shortens the hold when the accelerometer agrees it is not a human gait', () => {
    const d = new DriveDetector();
    const events = drive(d, T0, 12, 15, { accelVariance: DETECTION.GAIT_VARIANCE_G2 / 2 });

    expect(events.filter((e) => e.type === 'drive_started')).toHaveLength(1);
  });

  it('keeps the full hold when the accelerometer reads like walking, even at road speed', () => {
    const d = new DriveDetector();
    const events = drive(d, T0, 12, 15, { accelVariance: DETECTION.GAIT_VARIANCE_G2 * 2 });

    expect(events.every((e) => e.type === 'none')).toBe(true);
    expect(d.state).toBe('candidate');
  });

  it('still starts a drive on GPS alone, so the feature works without motion permission', () => {
    const d = new DriveDetector();
    const events = drive(d, T0, 25, 15, { accelVariance: null });

    expect(events.filter((e) => e.type === 'drive_started')).toHaveLength(1);
  });
});

describe('DriveDetector: what must never open a trip', () => {
  it('ignores walking pace', () => {
    const d = new DriveDetector();
    drive(d, T0, 600, 1.4);

    expect(d.state).toBe('idle');
  });

  it('ignores a brisk run', () => {
    const d = new DriveDetector();
    drive(d, T0, 600, 4.0);

    expect(d.state).toBe('idle');
  });

  it('never opens a trip on any trace that stays below the start speed', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: DETECTION.START_SPEED_MPS - 0.01, noNaN: true }), {
          minLength: 1,
          maxLength: 400,
        }),
        (speeds) => {
          const d = new DriveDetector();
          speeds.forEach((speedMps, i) => d.push(sample({ t: T0 + i * 1000, speedMps })));
          return d.state === 'idle';
        },
      ),
      { numRuns: 200 },
    );
  });

  it('ignores a fix the phone says it is unsure of, rather than guessing at it', () => {
    const d = new DriveDetector();
    drive(d, T0, 60, 20, { accuracyM: DETECTION.MAX_ACCURACY_M + 1 });

    expect(d.state).toBe('idle');
  });

  it('ignores a sample carrying no speed at all', () => {
    const d = new DriveDetector();
    drive(d, T0, 60, null);

    expect(d.state).toBe('idle');
  });

  it('does not let an ignored fix break a hold that is otherwise progressing', () => {
    const d = new DriveDetector();
    drive(d, T0, 10, 15);
    d.push(sample({ t: T0 + 10_000, speedMps: 0, accuracyM: DETECTION.MAX_ACCURACY_M + 1 }));
    const events = drive(d, T0 + 11_000, 12, 15);

    expect(events.filter((e) => e.type === 'drive_started')).toHaveLength(1);
  });
});

describe('DriveDetector: traffic does not end a drive', () => {
  function driving() {
    const d = new DriveDetector();
    drive(d, T0, 25, 15);
    return d;
  }

  it('pauses after a full minute stationary, and keeps recording', () => {
    const d = driving();
    const events = drive(d, T0 + 25_000, 65, 0);

    expect(d.state).toBe('paused');
    expect(events.filter((e) => e.type === 'drive_paused')).toHaveLength(1);
  });

  it('does not pause for a short stop at a light', () => {
    const d = driving();
    drive(d, T0 + 25_000, 30, 0);

    expect(d.state).toBe('driving');
  });

  it('resumes when the car pulls away again', () => {
    const d = driving();
    drive(d, T0 + 25_000, 65, 0);
    const events = drive(d, T0 + 90_000, 3, 15);

    expect(d.state).toBe('driving');
    expect(events.filter((e) => e.type === 'drive_resumed')).toHaveLength(1);
  });

  it('resumes on a crawl, not only at start speed (review finding 8)', () => {
    // Resuming used to require START_SPEED_MPS (4.5) while the stationary
    // clock cleared at PAUSE_SPEED_MPS (1.0), so between the two the machine
    // read "paused" over a moving car and the screen said "Stopped. Still
    // recording." while it crawled. One threshold now decides stationary
    // versus moving in both directions.
    const d = driving();
    drive(d, T0 + 25_000, 65, 0);
    const events = drive(d, T0 + 90_000, 3, 2.0);

    expect(d.state).toBe('driving');
    expect(events.filter((e) => e.type === 'drive_resumed')).toHaveLength(1);
  });

  it('does not resume below the stationary threshold', () => {
    const d = driving();
    drive(d, T0 + 25_000, 65, 0);
    const events = drive(d, T0 + 90_000, 3, DETECTION.PAUSE_SPEED_MPS / 2);

    expect(d.state).toBe('paused');
    expect(events.filter((e) => e.type === 'drive_resumed')).toHaveLength(0);
  });

  it('any speed that resets the stationary clock also resumes, so paused can never sit over a moving car', () => {
    fc.assert(
      fc.property(
        fc.double({
          min: DETECTION.PAUSE_SPEED_MPS,
          max: DETECTION.START_SPEED_MPS - 0.01,
          noNaN: true,
        }),
        (speedMps) => {
          const d = driving();
          drive(d, T0 + 25_000, 65, 0);
          d.push(sample({ t: T0 + 90_000, speedMps }));
          return d.state === 'driving';
        },
      ),
      { numRuns: 100 },
    );
  });

  it('resuming is instant but pausing again takes the full hold, so junctions cannot flap the state', () => {
    const d = driving();
    drive(d, T0 + 25_000, 65, 0);
    d.push(sample({ t: T0 + 90_000, speedMps: 1.5 }));
    expect(d.state).toBe('driving');

    // Half the pause hold of stillness is not enough to pause again.
    drive(d, T0 + 91_000, 30, 0);
    expect(d.state).toBe('driving');

    // The full hold is.
    drive(d, T0 + 121_000, 35, 0);
    expect(d.state).toBe('paused');
  });

  it('does not end a drive that is crawling in traffic rather than stopped', () => {
    const d = driving();
    drive(d, T0 + 25_000, 65, 0);
    // Creeping forward resets the stationary clock, and now also resumes the
    // drive: a car inching through a queue is moving, not stopped.
    for (let i = 0; i < 400; i++) {
      d.push(sample({ t: T0 + 90_000 + i * 1000, speedMps: i % 2 === 0 ? 1.4 : 0 }));
    }

    expect(d.state).not.toBe('ended');
  });

  it('ends the drive once it has been stationary for the full stop hold', () => {
    const d = driving();
    const events = drive(d, T0 + 25_000, 185, 0);

    expect(d.state).toBe('ended');
    expect(events.filter((e) => e.type === 'drive_ended')).toHaveLength(1);
  });

  it('ends exactly once and then stops emitting', () => {
    const d = driving();
    drive(d, T0 + 25_000, 185, 0);
    const after = drive(d, T0 + 400_000, 30, 0);

    expect(after.every((e) => e.type === 'none')).toBe(true);
  });
});

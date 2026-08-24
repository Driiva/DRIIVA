/**
 * Lives in the root test tree rather than beside the module: mobile/ has its
 * own Expo tsconfig and dependency set, which the root vitest run cannot
 * resolve. Same reason as tests/unit/mobile-waitlist.test.ts.
 *
 * mobile/lib/backgroundLocationBuffer.ts is the pure half of background trip
 * capture, split out from mobile/lib/backgroundLocation.ts specifically so it
 * has no expo-location/expo-task-manager import and can be tested here
 * without mobile's native dependency tree installed.
 *
 * What matters most: handleBackgroundLocationData must append to the SAME
 * writer a trip's foreground path is already using, not accumulate a queue
 * of its own, and it must never throw out of a background task (the driver
 * never sees that error) - it has to no-op quietly on a task error or on no
 * writer being registered.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  getActiveWriter,
  handleBackgroundLocationData,
  setActiveWriter,
  toSampledLocations,
  type PointBuffer,
  type RawLocationFix,
} from '../../mobile/lib/backgroundLocationBuffer';

function fix(overrides: Partial<RawLocationFix['coords']> & { timestamp?: number } = {}): RawLocationFix {
  const { timestamp = 1_000, ...coords } = overrides;
  return {
    coords: {
      latitude: 51.5,
      longitude: -0.1,
      speed: 12,
      heading: 90,
      accuracy: 5,
      ...coords,
    },
    timestamp,
  };
}

beforeEach(() => {
  setActiveWriter(null);
});

describe('toSampledLocations', () => {
  it('maps expo-location fixes to SampledLocation in order', () => {
    const fixes = [fix({ timestamp: 1_000 }), fix({ latitude: 51.6, timestamp: 2_000 })];

    expect(toSampledLocations(fixes)).toEqual([
      { latitude: 51.5, longitude: -0.1, speed: 12, heading: 90, accuracy: 5, timestamp: 1_000 },
      { latitude: 51.6, longitude: -0.1, speed: 12, heading: 90, accuracy: 5, timestamp: 2_000 },
    ]);
  });

  it('preserves null speed/heading/accuracy rather than coercing them', () => {
    const fixes = [fix({ speed: null, heading: null, accuracy: null })];

    const [sample] = toSampledLocations(fixes);
    expect(sample.speed).toBeNull();
    expect(sample.heading).toBeNull();
    expect(sample.accuracy).toBeNull();
  });

  it('returns an empty array for an empty input without throwing', () => {
    expect(toSampledLocations([])).toEqual([]);
  });
});

describe('setActiveWriter / getActiveWriter', () => {
  it('holds the one writer a trip in progress is using', () => {
    const writer: PointBuffer = { add: vi.fn() };
    expect(getActiveWriter()).toBeNull();

    setActiveWriter(writer);
    expect(getActiveWriter()).toBe(writer);

    setActiveWriter(null);
    expect(getActiveWriter()).toBeNull();
  });
});

describe('handleBackgroundLocationData', () => {
  it('appends every fix to the registered writer, not a buffer of its own', () => {
    const writer: PointBuffer = { add: vi.fn() };
    const fixes = [fix({ timestamp: 1_000 }), fix({ timestamp: 2_000 }), fix({ timestamp: 3_000 })];

    handleBackgroundLocationData({ data: { locations: fixes } }, writer);

    expect(writer.add).toHaveBeenCalledTimes(3);
    expect(writer.add).toHaveBeenNthCalledWith(1, expect.objectContaining({ timestamp: 1_000 }));
    expect(writer.add).toHaveBeenNthCalledWith(3, expect.objectContaining({ timestamp: 3_000 }));
  });

  it('no-ops on a task error rather than throwing', () => {
    const writer: PointBuffer = { add: vi.fn() };

    expect(() =>
      handleBackgroundLocationData({ error: new Error('location unavailable') }, writer),
    ).not.toThrow();
    expect(writer.add).not.toHaveBeenCalled();
  });

  it('no-ops when no trip has registered a writer, rather than dropping points into a new one', () => {
    expect(() =>
      handleBackgroundLocationData({ data: { locations: [fix()] } }, null),
    ).not.toThrow();
  });

  it('no-ops on a payload with no locations', () => {
    const writer: PointBuffer = { add: vi.fn() };

    handleBackgroundLocationData({ data: {} }, writer);
    handleBackgroundLocationData({ data: null }, writer);
    handleBackgroundLocationData({}, writer);

    expect(writer.add).not.toHaveBeenCalled();
  });

  it('reads whichever writer is currently registered via getActiveWriter, so a trip that ended cannot receive a late point', () => {
    const writer: PointBuffer = { add: vi.fn() };
    setActiveWriter(writer);

    // Trip ends: record.tsx's teardown() clears the writer before the
    // background task could plausibly fire again with a straggler fix.
    setActiveWriter(null);

    handleBackgroundLocationData({ data: { locations: [fix()] } }, getActiveWriter());
    expect(writer.add).not.toHaveBeenCalled();
  });
});

/**
 * WHAT THE TASK CALLBACK IS ALLOWED TO DO WITH AN ERROR
 * =====================================================
 * Jamal saw this on the record screen during a real simulator drive:
 *
 *   [backgroundLocation] task error {"code": 0, "message":
 *   "Error Domain=kCLErrorDomain Code=0 \"(null)\""}
 *
 * as a red LogBox toast, repeatedly, over a trip that was recording perfectly.
 * Two separate faults.
 *
 * FIRST, THE CLASSIFICATION. kCLErrorDomain code 0 is kCLErrorLocationUnknown:
 * Core Location saying "no fix at this instant, I am still trying". Apple's own
 * guidance is to keep waiting, because it clears itself. It is the single most
 * common thing an iOS location task ever reports, and on a simulator it fires
 * every time the simulated location is changed or cleared. Treating it as an
 * error at all was the bug; every fix after it arrived normally.
 *
 * SECOND, THE CHANNEL. Even a real fault must never reach a driver as a raw
 * error object. `console.error` in a dev build is a red stack-trace toast, and
 * in a release build it is silence, so the old code managed to be both alarming
 * and useless depending on who was looking.
 *
 * So the pure layer now RETURNS what happened and lets the caller decide, with
 * no logging of its own. A transient is not an error and produces no user-
 * visible anything.
 */
describe('handleBackgroundLocationData: outcomes', () => {
  it('reports how many fixes it appended', () => {
    const writer: PointBuffer = { add: vi.fn() };

    const outcome = handleBackgroundLocationData(
      { data: { locations: [fix({ timestamp: 1_000 }), fix({ timestamp: 2_000 })] } },
      writer,
    );

    expect(outcome).toEqual({ kind: 'appended', count: 2 });
  });

  it('classifies kCLErrorLocationUnknown as transient, which is not a fault at all', () => {
    const writer: PointBuffer = { add: vi.fn() };

    const outcome = handleBackgroundLocationData(
      { error: { code: 0, message: 'Error Domain=kCLErrorDomain Code=0 "(null)"' } },
      writer,
    );

    expect(outcome).toEqual({ kind: 'transient_fault' });
  });

  it('classifies a denied-permission error as capture being unavailable', () => {
    const outcome = handleBackgroundLocationData(
      { error: { code: 1, message: 'Error Domain=kCLErrorDomain Code=1 "Denied"' } },
      null,
    );

    expect(outcome).toMatchObject({ kind: 'capture_unavailable', code: 1 });
  });

  it('treats an error of an unrecognised shape as unavailable rather than swallowing it', () => {
    const outcome = handleBackgroundLocationData({ error: new Error('kaboom') }, null);

    expect(outcome).toMatchObject({ kind: 'capture_unavailable' });
  });

  it('carries the real message through so a fault can be diagnosed later', () => {
    const outcome = handleBackgroundLocationData(
      { error: { code: 2, message: 'Error Domain=kCLErrorDomain Code=2 "Network"' } },
      null,
    );

    expect(outcome).toMatchObject({ kind: 'capture_unavailable', message: expect.stringContaining('Network') });
  });

  it('reports ignored when there is no writer, which is not a fault either', () => {
    expect(handleBackgroundLocationData({ data: { locations: [fix()] } }, null)).toEqual({
      kind: 'ignored',
    });
  });

  it('reports ignored for a payload carrying no locations', () => {
    const writer: PointBuffer = { add: vi.fn() };

    expect(handleBackgroundLocationData({ data: {} }, writer)).toEqual({ kind: 'ignored' });
    expect(handleBackgroundLocationData({}, writer)).toEqual({ kind: 'ignored' });
  });

  it('prefers the error branch over the data branch when a payload somehow carries both', () => {
    const writer: PointBuffer = { add: vi.fn() };

    const outcome = handleBackgroundLocationData(
      { error: { code: 0, message: 'unknown' }, data: { locations: [fix()] } },
      writer,
    );

    expect(outcome).toEqual({ kind: 'transient_fault' });
    expect(writer.add).not.toHaveBeenCalled();
  });
});

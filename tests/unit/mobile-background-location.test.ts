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

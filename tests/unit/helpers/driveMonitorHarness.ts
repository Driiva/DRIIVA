/**
 * The injected-port harness the DriveMonitor suites share: a fake point
 * writer, a fake trip port, and a feeder that plays GPS fixes a second apart.
 * Extracted from tests/unit/mobile-drive-monitor.test.ts when that file was
 * split by describe block; the fakes are unchanged.
 */
import { vi } from 'vitest';

import {
  DriveMonitor,
  type PointWriterPort,
  type TripPort,
} from '../../mobile/lib/driveMonitor';
import type { SampledLocation } from '../../shared/trip-capture';

export const T0 = 1_700_000_000_000;

export function fix(t: number, speedMps: number | null, accuracyM = 5): SampledLocation {
  return { latitude: 51.5 + t * 1e-7, longitude: -0.12, speed: speedMps, heading: 90, accuracy: accuracyM, timestamp: t };
}

export function makeWriter(): PointWriterPort & { added: SampledLocation[] } {
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
    get durationSeconds() { return 120; },
    get lastAcceptedSample() { return added[added.length - 1] ?? null; },
  };
}

export function makePort(writer = makeWriter()) {
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
export async function feed(m: DriveMonitor, from: number, seconds: number, speedMps: number | null, accuracyM = 5) {
  for (let i = 0; i < seconds; i++) {
    await m.onLocation(fix(from + i * 1000, speedMps, accuracyM));
  }
}

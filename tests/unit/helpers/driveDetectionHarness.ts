/**
 * The sample and journey builders the DriveDetector suites share. Extracted
 * from tests/unit/mobile-drive-detection.test.ts when that file was split by
 * describe block; the builders are unchanged.
 */
import {
  DriveDetector,
  type DetectionSample,
} from '../../../mobile/lib/driveDetection';

export const T0 = 1_700_000_000_000;

export function sample(overrides: Partial<DetectionSample> & { t: number }): DetectionSample {
  return {
    speedMps: 0,
    accuracyM: 5,
    accelVariance: null,
    ...overrides,
  };
}

/** Feed a run of samples one second apart, returning every event emitted. */
export function drive(
  detector: DriveDetector,
  from: number,
  seconds: number,
  speedMps: number | null,
  extra: Partial<DetectionSample> = {},
) {
  const events = [];
  for (let i = 0; i < seconds; i++) {
    events.push(detector.push(sample({ t: from + i * 1000, speedMps, ...extra })));
  }
  return events;
}

/**
 * Pure logic for background trip-point capture.
 *
 * Split out from lib/backgroundLocation.ts (which does the actual
 * expo-task-manager/expo-location wiring) for one reason: this file has zero
 * expo/React Native imports, so it can be unit tested from the root vitest
 * suite without mobile's dependency tree installed. See mobile/tsconfig.json's
 * comment and tests/unit/mobile-waitlist.test.ts - CI never runs `npm i`
 * inside mobile/, only at the repo root and in functions/, so any mobile
 * module the root suite imports has to be resolvable without expo-location or
 * expo-task-manager on disk.
 *
 * This is also the seam that keeps background capture from becoming a SECOND
 * point buffer next to lib/trips.ts's TripPointWriter. registerActiveWriter/
 * getActiveWriter hold the one writer a trip in progress is using;
 * handleBackgroundLocationData appends to that same instance rather than
 * accumulating a queue of its own. A second buffer here is exactly the
 * shape of bug this codebase has already chased once (duplicate trip
 * writes) - see feature-planning notes on that.
 */
import type { SampledLocation } from '@shared/trip-capture';

/** Structural match for lib/trips.ts's TripPointWriter - the one point buffer. */
export interface PointBuffer {
  add(sample: SampledLocation): void;
}

/**
 * The fields of expo-location's LocationObject this file actually reads,
 * kept as a local structural type so this module needs no expo-location
 * import (see file header - that import would break the CI test run).
 */
export interface RawLocationFix {
  coords: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    accuracy: number | null;
  };
  timestamp: number;
}

let activeWriter: PointBuffer | null = null;

/**
 * Registers the TripPointWriter a trip in progress is using, so the
 * background task can append to it. record.tsx calls this when a trip
 * starts and clears it (passing null) in the same teardown() that stops the
 * foreground watch, so a trip that has ended can never receive a late
 * straggler point from the background task.
 */
export function setActiveWriter(writer: PointBuffer | null): void {
  activeWriter = writer;
}

export function getActiveWriter(): PointBuffer | null {
  return activeWriter;
}

export function toSampledLocations(fixes: readonly RawLocationFix[]): SampledLocation[] {
  return fixes.map((fix) => ({
    latitude: fix.coords.latitude,
    longitude: fix.coords.longitude,
    speed: fix.coords.speed,
    heading: fix.coords.heading,
    accuracy: fix.coords.accuracy,
    timestamp: fix.timestamp,
  }));
}

/**
 * The body of the TaskManager.defineTask callback, extracted so it is
 * testable without expo-task-manager's native module.
 *
 * No-ops rather than throwing when there is nothing to do - an error on the
 * payload, or no writer registered because the trip already ended or the OS
 * relaunched the app headless with no trip in progress to append to. A
 * background task error is not visible to the driver, so silently dropping
 * the fix is the honest failure mode here, not a crash.
 */
export function handleBackgroundLocationData(
  payload: { data?: { locations?: RawLocationFix[] } | null; error?: unknown },
  writer: PointBuffer | null,
): void {
  if (payload.error) return;
  if (!writer) return;

  const locations = payload.data?.locations;
  if (!locations || locations.length === 0) return;

  for (const sample of toSampledLocations(locations)) {
    writer.add(sample);
  }
}

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
 * Core Location's "I have no fix at this instant, still trying".
 *
 * kCLErrorDomain code 0 is kCLErrorLocationUnknown, and Apple's guidance is to
 * keep waiting because it clears itself. It is the most common thing an iOS
 * location task ever reports, and on a simulator it fires every time the
 * simulated location is changed or cleared. It is not a fault and it must
 * produce nothing a driver can see.
 */
const CL_ERROR_LOCATION_UNKNOWN = 0;

/** What one delivery of the background task actually did. */
export type BackgroundTaskOutcome =
  | { kind: 'appended'; count: number }
  | { kind: 'ignored' }
  | { kind: 'transient_fault' }
  | { kind: 'capture_unavailable'; code: number | null; message: string };

function readErrorCode(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number' && Number.isFinite(code)) return code;
  }
  return null;
}

function readErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

/**
 * The body of the TaskManager.defineTask callback, extracted so it is
 * testable without expo-task-manager's native module.
 *
 * RETURNS what happened and logs NOTHING. The old version called
 * console.error with the raw error object, which in a dev build is a red
 * stack-trace toast in the driver's face and in a release build is silence:
 * alarming and useless depending on who is looking. Deciding what a fault
 * means to a person is the caller's job, not this function's, and a transient
 * means nothing at all.
 *
 * Never throws. The OS can relaunch the app headless with no trip in progress
 * and deliver into a task with no writer registered; that is ordinary, not an
 * error.
 */
export function handleBackgroundLocationData(
  payload: { data?: { locations?: RawLocationFix[] } | null; error?: unknown },
  writer: PointBuffer | null,
): BackgroundTaskOutcome {
  // Error first: a payload carrying both is reporting a problem, and appending
  // points from it would be trusting a delivery the OS just disowned.
  if (payload.error) {
    const code = readErrorCode(payload.error);
    if (code === CL_ERROR_LOCATION_UNKNOWN) return { kind: 'transient_fault' };
    return { kind: 'capture_unavailable', code, message: readErrorMessage(payload.error) };
  }

  if (!writer) return { kind: 'ignored' };

  const locations = payload.data?.locations;
  if (!locations || locations.length === 0) return { kind: 'ignored' };

  const samples = toSampledLocations(locations);
  for (const sample of samples) {
    writer.add(sample);
  }
  return { kind: 'appended', count: samples.length };
}

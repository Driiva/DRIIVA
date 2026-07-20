/**
 * M2 T2 - trip scoring double-fire integration test (the module gate).
 *
 * This is the HARD correctness gate for M2 T2, not the weak
 * functions/src/__tests__/triggers/trips.test.ts (which asserts against inline
 * re-implementations of the trigger logic, so it cannot catch a regression in
 * the real file - see m2-grounding.md section 9).
 *
 * It drives the REAL exported onTripStatusChange Cloud Function against the
 * Firestore emulator via its v1 `.run(change, context)` entrypoint (the same
 * handler Firestore dispatches in production, wrapped by wrapTrigger), for BOTH
 * halves of the completion cascade:
 *   CASE 1 (recording -> processing): finalizeTripFromPoints computes metrics and
 *          performs Write B (status -> completed).
 *   CASE 2 (processing -> completed): the re-trigger Write B causes in production,
 *          which updates the driver profile and fires the push / classification /
 *          AI side effects.
 *
 * Pre-fix bug (m2-grounding.md section 2): finalizeTripFromPoints step 7 ALSO
 * applied the profile + achievements directly, so one real completion applied the
 * profile twice (totalTrips 2, totalMiles doubled) and fired the trip-complete
 * push twice. The fix deletes step 7 (CASE 2 is the sole caller) and adds a
 * per-trip idempotency marker inside the transaction.
 *
 * The push / classification / AI targets are mocked with spies purely to COUNT
 * how many times each side effect fires per completion (the done-when's "exactly
 * once"); the real profile transaction (updateDriverProfileAndPoolShare, inside
 * trips.ts) is NOT mocked and runs against the emulator. Weather is mocked to
 * keep the run deterministic and offline.
 *
 * IMPORT ORDER MATTERS: './helpers' must be imported before trips.ts so the
 * shared Admin app is initialised before trips.ts's top-level
 * `const db = admin.firestore()` runs - see the module-instance note in
 * tests/integration/helpers.ts.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import * as admin from 'firebase-admin';
import { adminDb, adminApp } from './helpers';

// Mock the side-effect targets so we can count firings. Factories only need the
// exports trips.ts imports from each module.
vi.mock('../../functions/src/utils/notifications', () => ({
  notifyTripComplete: vi.fn().mockResolvedValue(undefined),
  notifyAchievementsUnlocked: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../functions/src/utils/achievements', () => ({
  checkAndUnlockAchievements: vi.fn().mockResolvedValue([]),
  ACHIEVEMENT_DEFINITIONS: [],
}));
vi.mock('../../functions/src/http/classifier', () => ({
  classifyCompletedTrip: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../functions/src/ai/tripAnalysis', () => ({
  analyzeTrip: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../functions/src/utils/weather', () => ({
  getWeatherForTrip: vi.fn().mockResolvedValue('clear'),
}));

import { onTripStatusChange } from '../../functions/src/triggers/trips';
import { notifyTripComplete } from '../../functions/src/utils/notifications';
import { classifyCompletedTrip } from '../../functions/src/http/classifier';
import { analyzeTrip } from '../../functions/src/ai/tripAnalysis';

const METERS_PER_MILE = 1609.34;

function uniqueId(label: string): string {
  return `m2-t2-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function location(lat: number, lng: number) {
  return { lat, lng, address: null as null, placeType: null as null };
}

function seedUserDoc(uid: string) {
  const now = admin.firestore.Timestamp.now();
  return {
    uid,
    email: `${uid}@driiva.co.uk`,
    displayName: 'Trip Tester',
    photoURL: null,
    phoneNumber: null,
    createdAt: now,
    updatedAt: now,
    drivingProfile: {
      currentScore: 100,
      scoreBreakdown: {
        speedScore: 100,
        brakingScore: 100,
        accelerationScore: 100,
        corneringScore: 100,
        phoneUsageScore: 100,
      },
      totalTrips: 0,
      totalMiles: 0,
      totalDrivingMinutes: 0,
      lastTripAt: null,
      streakDays: 0,
      riskTier: 'low',
    },
    activePolicy: null,
    poolShare: {
      currentShareCents: 0,
      contributionCents: 0,
      sharePercentage: 0,
      lastUpdatedAt: now,
    },
    recentTrips: [],
    fcmTokens: [],
    settings: {
      notificationsEnabled: true,
      autoTripDetection: false,
      unitSystem: 'imperial',
    },
    createdBy: 'test',
    updatedBy: 'test',
  };
}

/**
 * A trip in the state the client leaves it after endTrip flips recording ->
 * processing: score/breakdown/events zeroed (rules-locked on the client write),
 * filled in by finalizeTripFromPoints from the GPS points.
 */
function seedProcessingTripDoc(
  tripId: string,
  userId: string,
  start: ReturnType<typeof location>,
  end: ReturnType<typeof location>,
) {
  const startedAt = admin.firestore.Timestamp.fromMillis(Date.now() - 60_000);
  const endedAt = admin.firestore.Timestamp.fromMillis(Date.now());
  return {
    tripId,
    userId,
    startedAt,
    endedAt,
    durationSeconds: 0,
    startLocation: start,
    endLocation: end,
    distanceMeters: 0,
    score: 0,
    scoreBreakdown: {
      speedScore: 0,
      brakingScore: 0,
      accelerationScore: 0,
      corneringScore: 0,
      phoneUsageScore: 0,
    },
    events: {
      hardBrakingCount: 0,
      hardAccelerationCount: 0,
      speedingSeconds: 0,
      sharpTurnCount: 0,
      phonePickupCount: 0,
    },
    anomalies: {
      hasGpsJumps: false,
      hasImpossibleSpeed: false,
      isDuplicate: false,
      flaggedForReview: false,
    },
    status: 'processing',
    processedAt: null,
    context: null,
    createdAt: startedAt,
    createdBy: userId,
    pointsCount: 0,
  };
}

function seedTripPointsDoc(tripId: string, userId: string, points: unknown[]) {
  return {
    tripId,
    userId,
    points,
    samplingRateHz: 1,
    totalPoints: points.length,
    compressedSize: 0,
    createdAt: admin.firestore.Timestamp.now(),
  };
}

// A short, realistic straight drive: ~11m between sequential points every 2s
// (~20 km/h), so the computed average speed is well under the 200mph anomaly
// bound and the route length matches the straight-line distance (no GPS-jump
// flag). Finalises to status 'completed'.
function normalPoints() {
  const baseLat = 51.5074;
  const baseLng = -0.1278;
  return Array.from({ length: 6 }, (_, i) => ({
    t: i * 2000,
    lat: baseLat + i * 0.0001,
    lng: baseLng,
    spd: 556,
    hdg: 0,
    acc: 5,
  }));
}

// Two points ~11km apart 1s apart: a physically impossible average speed
// (~24,000 mph) that detectAnomalies flags for review, so finalStatus stays
// 'processing' and the profile is never touched.
function impossibleSpeedPoints() {
  return [
    { t: 0, lat: 51.5, lng: -0.1278, spd: 556, hdg: 0, acc: 5 },
    { t: 1000, lat: 51.6, lng: -0.1278, spd: 556, hdg: 0, acc: 5 },
  ];
}

async function seedTrip(
  tripId: string,
  userId: string,
  start: ReturnType<typeof location>,
  end: ReturnType<typeof location>,
  points: unknown[],
) {
  await adminDb.collection('users').doc(userId).set(seedUserDoc(userId));
  await adminDb.collection('trips').doc(tripId).set(seedProcessingTripDoc(tripId, userId, start, end));
  await adminDb.collection('tripPoints').doc(tripId).set(seedTripPointsDoc(tripId, userId, points));
}

async function getTrip(tripId: string): Promise<admin.firestore.DocumentData> {
  const snap = await adminDb.collection('trips').doc(tripId).get();
  return snap.data() as admin.firestore.DocumentData;
}

async function getProfile(userId: string): Promise<admin.firestore.DocumentData> {
  const snap = await adminDb.collection('users').doc(userId).get();
  return (snap.data() as admin.firestore.DocumentData).drivingProfile;
}

/**
 * Drive the REAL onTripStatusChange Cloud Function the way Firestore dispatches
 * it: a v1 `.run(change, context)` call with before/after snapshots. The handler
 * only reads `change.before.data()`, `change.after.data()` and
 * `context.params.tripId`, so a minimal snapshot stub is faithful.
 */
async function runOnUpdate(
  beforeData: admin.firestore.DocumentData,
  afterData: admin.firestore.DocumentData,
  tripId: string,
): Promise<void> {
  const change = {
    before: { data: () => beforeData },
    after: { data: () => afterData },
  };
  const context = { params: { tripId } };
  await (onTripStatusChange as unknown as {
    run: (c: unknown, ctx: unknown) => Promise<void>;
  }).run(change, context);
}

/** Let fire-and-forget side effects (checkAchievementsAsync etc.) settle. */
async function settle(ms = 300): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('M2 T2 scoring double-fire (Firestore emulator, real onTripStatusChange)', () => {
  afterAll(async () => {
    await adminApp.delete();
  });

  it('applies a completed trip to the profile EXACTLY once and fires push/classification/AI once each', async () => {
    vi.clearAllMocks();
    const userId = uniqueId('user-once');
    const tripId = uniqueId('trip-once');
    const pts = normalPoints();
    const start = location(pts[0].lat, pts[0].lng);
    const end = location(pts[pts.length - 1].lat, pts[pts.length - 1].lng);
    await seedTrip(tripId, userId, start, end, pts);

    // CASE 1: recording -> processing. Runs the real finalizer, which performs
    // Write B (status -> completed). Post-fix it applies NO profile/achievements.
    const processing = await getTrip(tripId);
    await runOnUpdate({ ...processing, status: 'recording' }, processing, tripId);

    const completed = await getTrip(tripId);
    expect(completed.status).toBe('completed');

    // CASE 2: processing -> completed. In production Write B's status flip
    // dispatches exactly this. It is the sole caller of the profile update and
    // the push / classification / AI side effects.
    await runOnUpdate({ ...completed, status: 'processing' }, completed, tripId);
    await settle();

    const profile = await getProfile(userId);
    // Pre-fix this was 2 (step 7 + CASE 2). Post-fix it must be exactly 1.
    expect(profile.totalTrips).toBe(1);
    const expectedMiles = Math.round((completed.distanceMeters / METERS_PER_MILE) * 100) / 100;
    expect(profile.totalMiles).toBe(expectedMiles);

    // The done-when: each completion side effect fires EXACTLY once - not twice
    // (the pre-fix double-fire, or a future regression re-adding a direct call
    // to step 7), not zero (accidentally removed). notifyTripComplete is the
    // achievements/push wrapper's first action; classifyCompletedTrip and
    // analyzeTrip are the classification and AI wrappers' targets.
    expect(notifyTripComplete).toHaveBeenCalledTimes(1);
    expect(classifyCompletedTrip).toHaveBeenCalledTimes(1);
    expect(analyzeTrip).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when the same completed trip is delivered to CASE 2 again', async () => {
    vi.clearAllMocks();
    const userId = uniqueId('user-idem');
    const tripId = uniqueId('trip-idem');
    const pts = normalPoints();
    const start = location(pts[0].lat, pts[0].lng);
    const end = location(pts[pts.length - 1].lat, pts[pts.length - 1].lng);
    await seedTrip(tripId, userId, start, end, pts);

    const processing = await getTrip(tripId);
    await runOnUpdate({ ...processing, status: 'recording' }, processing, tripId);
    const completed = await getTrip(tripId);
    expect(completed.status).toBe('completed');

    // First (legitimate) CASE 2 delivery.
    await runOnUpdate({ ...completed, status: 'processing' }, completed, tripId);
    await settle();
    const afterFirst = await getProfile(userId);
    expect(afterFirst.totalTrips).toBe(1);

    // Second delivery of the SAME completion - a duplicate/retried Cloud Function
    // dispatch. The per-trip marker must make the profile update a no-op.
    await runOnUpdate({ ...completed, status: 'processing' }, completed, tripId);
    await settle();
    const afterSecond = await getProfile(userId);
    expect(afterSecond.totalTrips).toBe(1);
    expect(afterSecond.totalMiles).toBe(afterFirst.totalMiles);
  });

  it('leaves an anomaly-flagged trip in processing with the profile untouched', async () => {
    vi.clearAllMocks();
    const userId = uniqueId('user-anom');
    const tripId = uniqueId('trip-anom');
    const pts = impossibleSpeedPoints();
    const start = location(pts[0].lat, pts[0].lng);
    const end = location(pts[pts.length - 1].lat, pts[pts.length - 1].lng);
    await seedTrip(tripId, userId, start, end, pts);

    // CASE 1 only: the finalizer flags the anomaly, keeps status 'processing',
    // so Write B never flips to 'completed' and CASE 2 never fires.
    const processing = await getTrip(tripId);
    await runOnUpdate({ ...processing, status: 'recording' }, processing, tripId);
    await settle();

    const trip = await getTrip(tripId);
    // Locks section 6's current behaviour before T8 changes it.
    expect(trip.status).toBe('processing');
    expect(trip.anomalies.flaggedForReview).toBe(true);

    const profile = await getProfile(userId);
    expect(profile.totalTrips).toBe(0);
    expect(profile.totalMiles).toBe(0);

    // A flagged trip fires no completion side effects at all.
    expect(notifyTripComplete).toHaveBeenCalledTimes(0);
    expect(classifyCompletedTrip).toHaveBeenCalledTimes(0);
    expect(analyzeTrip).toHaveBeenCalledTimes(0);
  });
});

/**
 * M2 T2 - trip scoring double-fire integration test (the module gate).
 *
 * This is the HARD correctness gate for M2 T2, not the weak
 * functions/src/__tests__/triggers/trips.test.ts (which asserts against inline
 * re-implementations of the trigger logic, so it cannot catch a regression in
 * the real file - see m2-grounding.md section 9).
 *
 * It drives the REAL exported completion path from
 * functions/src/triggers/trips.ts against the Firestore emulator:
 *   1. finalizeTripFromPoints  - CASE 1's finalizer (recording -> processing),
 *      which computes metrics and performs Write B (status -> completed).
 *   2. updateDriverProfileAndPoolShare - the exact function CASE 2 calls when
 *      Write B's status flip re-triggers onTripStatusChange (the second half of
 *      the double-fire).
 *
 * The pre-fix bug (m2-grounding.md section 2): finalizeTripFromPoints step 7
 * ALSO called updateDriverProfileAndPoolShare directly, so one real completion
 * applied the profile twice - totalTrips 2, totalMiles doubled, etc. The fix
 * deletes step 7 (CASE 2 is the sole caller) and adds a per-trip idempotency
 * marker inside the transaction, giving "score exactly once per trip" even
 * against a re-delivery or a retried invocation.
 *
 * IMPORT ORDER MATTERS: './helpers' must be imported before trips.ts so the
 * shared Admin app is initialised before trips.ts's top-level
 * `const db = admin.firestore()` runs - see the module-instance note in
 * tests/integration/helpers.ts. Same reason identity.test.ts imports helpers
 * first.
 */
import { afterAll, describe, expect, it } from 'vitest';
import * as admin from 'firebase-admin';
import { adminDb, adminApp } from './helpers';

import {
  finalizeTripFromPoints,
  updateDriverProfileAndPoolShare,
} from '../../functions/src/triggers/trips';

const METERS_PER_MILE = 1609.34;

function uniqueId(label: string): string {
  return `m2-t2-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function location(lat: number, lng: number) {
  return { lat, lng, address: null, placeType: null as null };
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
 * processing: score/breakdown/events are zeroed (rules-locked on the client
 * write) and get filled in by finalizeTripFromPoints from the GPS points.
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

describe('M2 T2 scoring double-fire (Firestore emulator)', () => {
  afterAll(async () => {
    await adminApp.delete();
  });

  it('applies a completed trip to the driver profile EXACTLY once (kills the double-fire)', async () => {
    const userId = uniqueId('user-once');
    const tripId = uniqueId('trip-once');
    const pts = normalPoints();
    const start = location(pts[0].lat, pts[0].lng);
    const end = location(pts[pts.length - 1].lat, pts[pts.length - 1].lng);
    await seedTrip(tripId, userId, start, end, pts);

    // CASE 1: finalize the trip. This performs Write B (status -> completed)
    // and, pre-fix, ALSO applied the profile once directly (step 7).
    await finalizeTripFromPoints(tripId, (await getTrip(tripId)) as never);

    const completed = await getTrip(tripId);
    expect(completed.status).toBe('completed');

    // CASE 2: Write B's status flip re-triggers onTripStatusChange, which calls
    // updateDriverProfileAndPoolShare with the now-completed trip. This is the
    // second half of the double-fire.
    await updateDriverProfileAndPoolShare(completed as never, tripId);

    const profile = await getProfile(userId);
    // Pre-fix this is 2 (step 7 + CASE 2). Post-fix it must be exactly 1.
    expect(profile.totalTrips).toBe(1);

    // A representative accumulator must also be applied once, not doubled.
    const expectedMiles = Math.round((completed.distanceMeters / METERS_PER_MILE) * 100) / 100;
    expect(profile.totalMiles).toBe(expectedMiles);
  });

  it('is idempotent when the same completed trip is delivered again (retry / re-trigger)', async () => {
    const userId = uniqueId('user-idem');
    const tripId = uniqueId('trip-idem');
    const pts = normalPoints();
    const start = location(pts[0].lat, pts[0].lng);
    const end = location(pts[pts.length - 1].lat, pts[pts.length - 1].lng);
    await seedTrip(tripId, userId, start, end, pts);

    await finalizeTripFromPoints(tripId, (await getTrip(tripId)) as never);
    const completed = await getTrip(tripId);
    expect(completed.status).toBe('completed');

    // First (legitimate) application.
    await updateDriverProfileAndPoolShare(completed as never, tripId);
    const afterFirst = await getProfile(userId);
    expect(afterFirst.totalTrips).toBe(1);

    // Second delivery of the SAME trip - a duplicate Cloud Function invocation
    // or a re-trigger. The idempotency marker must make this a no-op.
    await updateDriverProfileAndPoolShare(completed as never, tripId);
    const afterSecond = await getProfile(userId);
    expect(afterSecond.totalTrips).toBe(1);
    expect(afterSecond.totalMiles).toBe(afterFirst.totalMiles);
  });

  it('leaves an anomaly-flagged trip in processing with the profile untouched', async () => {
    const userId = uniqueId('user-anom');
    const tripId = uniqueId('trip-anom');
    const pts = impossibleSpeedPoints();
    const start = location(pts[0].lat, pts[0].lng);
    const end = location(pts[pts.length - 1].lat, pts[pts.length - 1].lng);
    await seedTrip(tripId, userId, start, end, pts);

    await finalizeTripFromPoints(tripId, (await getTrip(tripId)) as never);

    const trip = await getTrip(tripId);
    // Locks section 6's current behaviour: a flagged trip is left in
    // 'processing', never scored into the profile (before T8 changes this).
    expect(trip.status).toBe('processing');
    expect(trip.anomalies.flaggedForReview).toBe(true);

    const profile = await getProfile(userId);
    expect(profile.totalTrips).toBe(0);
    expect(profile.totalMiles).toBe(0);
  });
});

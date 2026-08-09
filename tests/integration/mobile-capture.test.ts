/**
 * Wave C (C1): on-device capture reaches the scoring pipeline.
 *
 * The mobile record screen writes trip documents itself rather than going
 * through any server endpoint, so the only thing standing between "the app
 * recorded a trip" and "the trip was scored" is whether the documents it writes
 * are the documents the Cloud Function reads. This test drives the REAL
 * onTripStatusChange against the Firestore emulator over documents built the
 * way mobile/lib/trips.ts builds them.
 *
 * It differs from trips.test.ts in the one way that matters here: that suite
 * seeds GPS points into the tripPoints PARENT document's `points` array, which
 * no writer in the product actually populates. Mobile (and web) stream points
 * into tripPoints/{tripId}/batches/{n}, the readTripPoints fallback branch.
 * A trip whose points only ever land in batches must still score, in order, and
 * that path had no coverage before.
 *
 * Point encoding comes from shared/trip-capture.ts, the same function the phone
 * calls, so a change to the `t` offset or the m/s * 100 speed encoding fails
 * here rather than silently handing every driver a perfect speed score.
 *
 * IMPORT ORDER MATTERS: './helpers' before trips.ts, see that file's
 * module-instance note.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import * as admin from 'firebase-admin';
import { adminDb, adminApp } from './helpers';
import { encodePoint, type SampledLocation } from '../../shared/trip-capture';

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

const METERS_PER_MILE = 1609.34;
/** Points per batch flush, matching BATCH_SIZE in mobile/lib/trips.ts. */
const BATCH_SIZE = 100;

function uniqueId(label: string): string {
  return `wave-c-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * A plausible urban drive: one fix per second heading north at ~11 m/s
 * (~25 mph), which is under the anomaly bounds and long enough to span more
 * than one batch flush.
 */
function drive(sampleCount: number, startMs: number): SampledLocation[] {
  const baseLat = 51.5074;
  const baseLng = -0.1278;
  return Array.from({ length: sampleCount }, (_, i) => ({
    latitude: baseLat + i * 0.0001,
    longitude: baseLng,
    speed: 11.12,
    heading: 0,
    accuracy: 5,
    timestamp: startMs + i * 1000,
  }));
}

/** The trip document mobile/lib/trips.ts startTrip commits, field for field. */
function recordingTripDoc(tripId: string, userId: string, lat: number, lng: number) {
  const now = admin.firestore.Timestamp.now();
  const location = { lat, lng, address: null, placeType: null };
  return {
    tripId,
    userId,
    startedAt: now,
    endedAt: now,
    durationSeconds: 0,
    startLocation: location,
    endLocation: location,
    distanceMeters: 0,
    score: 0,
    scoreBreakdown: {
      speedScore: 100,
      brakingScore: 100,
      accelerationScore: 100,
      corneringScore: 100,
      phoneUsageScore: 100,
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
    status: 'recording',
    processedAt: null,
    context: null,
    createdAt: now,
    createdBy: userId,
    pointsCount: 0,
  };
}

function seedUserDoc(uid: string) {
  const now = admin.firestore.Timestamp.now();
  return {
    uid,
    email: `${uid}@driiva.co.uk`,
    displayName: 'Capture Tester',
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
    settings: { notificationsEnabled: true, autoTripDetection: false, unitSystem: 'imperial' },
    createdBy: 'test',
    updatedBy: 'test',
  };
}

/**
 * Reproduces a full capture: startTrip's two-document batch, then the point
 * writer's batched flushes into tripPoints/{tripId}/batches/{n}.
 */
async function captureTrip(
  tripId: string,
  userId: string,
  samples: SampledLocation[],
): Promise<{ points: ReturnType<typeof encodePoint>[]; batchCount: number }> {
  const startMs = samples[0].timestamp;
  const points = samples.map((s) => encodePoint(s, startMs));

  await adminDb.collection('users').doc(userId).set(seedUserDoc(userId));

  const start = adminDb.batch();
  start.set(
    adminDb.collection('trips').doc(tripId),
    recordingTripDoc(tripId, userId, samples[0].latitude, samples[0].longitude),
  );
  start.set(adminDb.collection('tripPoints').doc(tripId), {
    tripId,
    userId,
    // Written empty and never appended to; the batches subcollection is the
    // real storage. This is the field the old test seeded instead.
    points: [],
    samplingRateHz: 1,
    totalPoints: 0,
    compressedSize: 0,
    createdAt: admin.firestore.Timestamp.now(),
  });
  await start.commit();

  let batchIndex = 0;
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const slice = points.slice(i, i + BATCH_SIZE);
    await adminDb
      .collection('tripPoints')
      .doc(tripId)
      .collection('batches')
      .doc(String(batchIndex))
      .set({
        tripId,
        userId,
        batchIndex,
        startOffset: slice[0].t,
        endOffset: slice[slice.length - 1].t,
        points: slice,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    batchIndex++;
  }

  return { points, batchCount: batchIndex };
}

/** The recording -> processing update submitTripForScoring commits. */
async function submitForScoring(
  tripId: string,
  end: { lat: number; lng: number },
  distanceMeters: number,
  pointsCount: number,
): Promise<void> {
  await adminDb.collection('trips').doc(tripId).update({
    endedAt: admin.firestore.Timestamp.now(),
    endLocation: { lat: end.lat, lng: end.lng, address: null, placeType: null },
    distanceMeters: Math.round(distanceMeters),
    status: 'processing',
    pointsCount,
  });
}

async function runOnUpdate(
  beforeData: admin.firestore.DocumentData,
  afterData: admin.firestore.DocumentData,
  tripId: string,
): Promise<void> {
  await (onTripStatusChange as unknown as {
    run: (c: unknown, ctx: unknown) => Promise<void>;
  }).run(
    { before: { data: () => beforeData }, after: { data: () => afterData } },
    { params: { tripId } },
  );
}

async function getTrip(tripId: string): Promise<admin.firestore.DocumentData> {
  const snap = await adminDb.collection('trips').doc(tripId).get();
  return snap.data() as admin.firestore.DocumentData;
}

describe('Wave C: on-device capture through to a scored trip', () => {
  afterAll(async () => {
    await adminApp.delete();
  });

  it('scores a trip whose points exist only in the batches subcollection', async () => {
    const userId = uniqueId('user');
    const tripId = uniqueId('trip');
    // 150 samples forces two batch documents, so batch ordering is exercised
    // rather than assumed.
    const samples = drive(150, Date.now() - 150_000);
    const { batchCount } = await captureTrip(tripId, userId, samples);
    expect(batchCount).toBe(2);

    // The parent document's points array is empty, exactly as the writer leaves
    // it. If the finalizer only read that, the trip would fail as "insufficient
    // points" instead of scoring.
    const parent = await adminDb.collection('tripPoints').doc(tripId).get();
    expect((parent.data() as { points: unknown[] }).points).toEqual([]);

    const last = samples[samples.length - 1];
    await submitForScoring(
      tripId,
      { lat: last.latitude, lng: last.longitude },
      1650,
      samples.length,
    );

    const processing = await getTrip(tripId);
    await runOnUpdate({ ...processing, status: 'recording' }, processing, tripId);

    const completed = await getTrip(tripId);
    expect(completed.status).toBe('completed');
    expect(completed.anomalies.flaggedForReview).toBe(false);
    // A real score computed from the captured points, not the 0 the client wrote
    // and not the 100 placeholder it started at.
    expect(completed.score).toBeGreaterThan(0);
    expect(completed.score).toBeLessThanOrEqual(100);
    expect(completed.distanceMeters).toBeGreaterThan(0);
    // Duration is derived from the `t` offsets: 150 samples one second apart.
    expect(completed.durationSeconds).toBe(149);
    expect(completed.scoreBreakdown).toMatchObject({
      speedScore: expect.any(Number),
      brakingScore: expect.any(Number),
      accelerationScore: expect.any(Number),
      corneringScore: expect.any(Number),
      phoneUsageScore: expect.any(Number),
    });

    // The completion cascade then applies it to the driver profile exactly once.
    await runOnUpdate({ ...completed, status: 'processing' }, completed, tripId);
    await new Promise((r) => setTimeout(r, 300));

    const profile = (await adminDb.collection('users').doc(userId).get()).data()!.drivingProfile;
    expect(profile.totalTrips).toBe(1);
    expect(profile.totalMiles).toBe(
      Math.round((completed.distanceMeters / METERS_PER_MILE) * 100) / 100,
    );
  });

  it('never scores a trip the driver said they were not driving', async () => {
    const userId = uniqueId('user-passenger');
    const tripId = uniqueId('trip-passenger');
    const samples = drive(30, Date.now() - 30_000);
    await captureTrip(tripId, userId, samples);

    // The mode-confirmation "no, I was a passenger" path: recording -> failed,
    // which is a transition the client is allowed to make and the pipeline
    // never scores.
    await adminDb.collection('trips').doc(tripId).update({
      status: 'failed',
      discardReason: 'not_driving',
    });

    const failed = await getTrip(tripId);
    await runOnUpdate({ ...failed, status: 'recording' }, failed, tripId);
    await new Promise((r) => setTimeout(r, 300));

    const after = await getTrip(tripId);
    expect(after.status).toBe('failed');
    expect(after.score).toBe(0);

    const profile = (await adminDb.collection('users').doc(userId).get()).data()!.drivingProfile;
    expect(profile.totalTrips).toBe(0);
    expect(profile.totalMiles).toBe(0);
  });

  it('rejects a capture too short to score rather than storing a zero trip', async () => {
    const userId = uniqueId('user-short');
    const tripId = uniqueId('trip-short');
    const samples = drive(1, Date.now() - 1000);
    await captureTrip(tripId, userId, samples);

    const only = samples[0];
    await submitForScoring(tripId, { lat: only.latitude, lng: only.longitude }, 0, 1);

    const processing = await getTrip(tripId);
    await runOnUpdate({ ...processing, status: 'recording' }, processing, tripId);

    // The client refuses this before it ever gets here (MIN_POINTS in
    // mobile/lib/trips.ts). If it slips through, the pipeline fails it rather
    // than completing a trip with no distance and no duration.
    const after = await getTrip(tripId);
    expect(after.status).toBe('failed');

    const profile = (await adminDb.collection('users').doc(userId).get()).data()!.drivingProfile;
    expect(profile.totalTrips).toBe(0);
  });
});

describe('point encoding matches what the scoring pipeline expects', () => {
  it('stores t as an offset from trip start, not wall clock', () => {
    const startMs = 1_700_000_000_000;
    const point = encodePoint(
      { latitude: 51.5, longitude: -0.12, speed: 10, heading: 90, accuracy: 5, timestamp: startMs + 4500 },
      startMs,
    );
    expect(point.t).toBe(4500);
  });

  it('stores speed as metres per second times 100, the encoding computeSpeedStats divides out', () => {
    const point = encodePoint(
      { latitude: 51.5, longitude: -0.12, speed: 13.41, heading: 0, accuracy: 5, timestamp: 1000 },
      1000,
    );
    expect(point.spd).toBe(1341);
  });

  it('normalises the unknown-value sentinels the platforms report', () => {
    const point = encodePoint(
      // expo-location reports -1 for both an unknown speed and an unknown
      // heading. Stored raw, the heading breaks the 0-360 contract bound and
      // the speed becomes a negative reading in the scorer.
      { latitude: 51.5, longitude: -0.12, speed: -1, heading: -1, accuracy: null, timestamp: 500 },
      1000,
    );
    expect(point.spd).toBe(0);
    expect(point.hdg).toBe(0);
    expect(point.acc).toBe(0);
    // A fix predating trip start clamps rather than writing a negative offset.
    expect(point.t).toBe(0);
  });
});

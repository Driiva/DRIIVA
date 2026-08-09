/**
 * Seeds the Firebase emulators with a signed-in driver and enough history to
 * review every mobile screen.
 *
 * WHY: a native build authenticates against real Firebase, and no iOS app has
 * ever been registered against the driiva project, so no mobile screen behind
 * the auth gate had ever been seen running. This seeds the LOCAL EMULATORS
 * only, so the app can be driven end to end without touching production.
 *
 * This data is test data for a local emulator and never reaches a user. It is
 * deliberately NOT wired into the app as a fallback: if the emulator is empty,
 * the screens must show their honest empty states.
 *
 *   firebase emulators:start --only auth,firestore
 *   npx tsx scripts/seed-emulator-demo.ts
 *
 * Refuses to run against anything but the emulators.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const FIRESTORE_HOST = '127.0.0.1:8080';
const AUTH_HOST = '127.0.0.1:9099';
const PROJECT_ID = 'driiva';

const EMAIL = 'test@driiva.co.uk';
const PASSWORD = 'driiva1';

process.env.FIRESTORE_EMULATOR_HOST ??= FIRESTORE_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= AUTH_HOST;

// Belt and braces. A misconfigured host here would write invented driving
// history into a real project.
if (
  process.env.FIRESTORE_EMULATOR_HOST !== FIRESTORE_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== AUTH_HOST
) {
  throw new Error('Refusing to seed: emulator hosts are not the local defaults.');
}

const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);

const METRES_PER_MILE = 1609.34;

function isoWeekPeriod(now: Date): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Deterministic pseudo-random so repeated seeds produce the same review set. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ROUTES = [
  'Home to Work',
  'Work to Home',
  'Home to Gym',
  'Supermarket run',
  'Home to Station',
  'Airport run',
  'Weekend drive',
];

async function seedDriver(): Promise<string> {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(EMAIL);
    uid = existing.uid;
  } catch {
    const created = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: 'Jamal Adu',
      emailVerified: true,
    });
    uid = created.uid;
  }
  return uid;
}

/**
 * 34 completed trips: more than one page of 25, so the trips list actually
 * paginates rather than merely rendering.
 */
async function seedTrips(uid: string): Promise<{ trips: number; miles: number; score: number }> {
  const random = rng(20260809);
  const now = Date.now();
  let totalMiles = 0;
  let scoreSum = 0;

  for (let i = 0; i < 34; i++) {
    const tripId = `seed-trip-${String(i).padStart(3, '0')}`;
    const startedAt = new Date(now - (i + 1) * 7 * 3600 * 1000);
    const durationSeconds = 600 + Math.floor(random() * 2400);
    const distanceMeters = Math.round(3000 + random() * 22000);
    const score = Math.round(62 + random() * 36);

    totalMiles += distanceMeters / METRES_PER_MILE;
    scoreSum += score;

    // A short polyline through central London so the detail map has a route.
    const baseLat = 51.5074 + (random() - 0.5) * 0.05;
    const baseLng = -0.1278 + (random() - 0.5) * 0.05;
    const points = Array.from({ length: 40 }, (_, p) => ({
      t: p * 2000,
      lat: baseLat + p * 0.0004,
      lng: baseLng + p * 0.0002,
      spd: Math.round((8 + random() * 12) * 100),
      hdg: 45,
      acc: 5,
    }));

    await db.collection('trips').doc(tripId).set({
      tripId,
      userId: uid,
      startedAt: Timestamp.fromDate(startedAt),
      endedAt: Timestamp.fromDate(
        new Date(startedAt.getTime() + durationSeconds * 1000),
      ),
      durationSeconds,
      startLocation: { lat: baseLat, lng: baseLng, address: 'Camden, London', placeType: 'home' },
      endLocation: { lat: baseLat + 0.016, lng: baseLng + 0.008, address: 'Soho, London', placeType: 'work' },
      distanceMeters,
      score,
      scoreBreakdown: {
        speedScore: Math.round(60 + random() * 40),
        brakingScore: Math.round(60 + random() * 40),
        accelerationScore: Math.round(60 + random() * 40),
        corneringScore: Math.round(60 + random() * 40),
        phoneUsageScore: Math.round(70 + random() * 30),
      },
      events: {
        hardBrakingCount: Math.floor(random() * 4),
        hardAccelerationCount: Math.floor(random() * 3),
        speedingSeconds: Math.floor(random() * 90),
        sharpTurnCount: Math.floor(random() * 3),
        phonePickupCount: Math.floor(random() * 2),
      },
      anomalies: {
        hasGpsJumps: false,
        hasImpossibleSpeed: false,
        isDuplicate: false,
        flaggedForReview: false,
      },
      status: 'completed',
      routeSummary: ROUTES[i % ROUTES.length],
      processedAt: Timestamp.fromDate(startedAt),
      context: null,
      createdAt: Timestamp.fromDate(startedAt),
      createdBy: uid,
      pointsCount: points.length,
    });

    // Points live in the batches subcollection, which is where the writers
    // actually put them and where getTripPoints reads them from.
    await db.collection('tripPoints').doc(tripId).set({
      tripId,
      userId: uid,
      points: [],
      samplingRateHz: 1,
      totalPoints: points.length,
      compressedSize: points.length * 50,
      createdAt: Timestamp.fromDate(startedAt),
    });
    await db
      .collection('tripPoints')
      .doc(tripId)
      .collection('batches')
      .doc('0')
      .set({
        tripId,
        userId: uid,
        batchIndex: 0,
        startOffset: points[0].t,
        endOffset: points[points.length - 1].t,
        points,
        createdAt: Timestamp.fromDate(startedAt),
      });
  }

  return {
    trips: 34,
    miles: Math.round((totalMiles) * 100) / 100,
    score: Math.round(scoreSum / 34),
  };
}

async function seedUserDoc(
  uid: string,
  stats: { trips: number; miles: number; score: number },
): Promise<void> {
  const now = Timestamp.now();
  const recent = await db
    .collection('trips')
    .where('userId', '==', uid)
    .orderBy('startedAt', 'desc')
    .limit(3)
    .get();

  await db.collection('users').doc(uid).set({
    uid,
    email: EMAIL,
    displayName: 'Jamal Adu',
    photoURL: null,
    phoneNumber: null,
    createdAt: now,
    updatedAt: now,
    onboardingComplete: true,
    drivingProfile: {
      currentScore: stats.score,
      scoreBreakdown: {
        speedScore: 84,
        brakingScore: 79,
        accelerationScore: 88,
        corneringScore: 82,
        phoneUsageScore: 95,
      },
      totalTrips: stats.trips,
      totalMiles: stats.miles,
      totalDrivingMinutes: stats.trips * 24,
      lastTripAt: now,
      streakDays: 12,
      riskTier: 'low',
    },
    // A real premium, so the refund moment has an honest figure to project
    // from rather than hiding its money line.
    activePolicy: {
      policyId: 'seed-policy-1',
      policyNumber: 'DRV-2026-000148',
      status: 'active',
      premiumCents: 84000,
      coverageType: 'comprehensive',
      renewalDate: Timestamp.fromDate(new Date(Date.now() + 240 * 86400000)),
    },
    poolShare: {
      currentShareCents: 0,
      contributionCents: 0,
      sharePercentage: 0,
      lastUpdatedAt: now,
    },
    recentTrips: recent.docs.map((d) => {
      const t = d.data();
      return {
        tripId: t.tripId,
        startedAt: t.startedAt,
        distanceMeters: t.distanceMeters,
        durationSeconds: t.durationSeconds,
        score: t.score,
        routeSummary: t.routeSummary,
      };
    }),
    fcmTokens: [],
    settings: { notificationsEnabled: true, autoTripDetection: false, unitSystem: 'imperial' },
    createdBy: 'seed',
    updatedBy: 'seed',
  });
}

/** Other drivers, so the leaderboard is a board rather than a single row. */
async function seedLeaderboard(uid: string, myScore: number): Promise<void> {
  const others = [
    { userId: 'seed-peer-1', displayName: 'Amara Okafor', score: 96, totalMiles: 812, totalTrips: 96, change: 1 },
    { userId: 'seed-peer-2', displayName: 'Tom Whitfield', score: 93, totalMiles: 640, totalTrips: 71, change: -1 },
    { userId: 'seed-peer-3', displayName: 'Priya Raman', score: 91, totalMiles: 1204, totalTrips: 133, change: 2 },
    { userId: uid, displayName: 'Jamal Adu', score: myScore, totalMiles: 402, totalTrips: 34, change: 0 },
    { userId: 'seed-peer-4', displayName: 'Chris Boateng', score: 77, totalMiles: 388, totalTrips: 41, change: -2 },
    { userId: 'seed-peer-5', displayName: 'Sofia Marchetti', score: 74, totalMiles: 250, totalTrips: 29, change: 0 },
  ];

  const rankings = [...others]
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const now = new Date();
  const monthly = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}_monthly`;
  const ids = [`${isoWeekPeriod(now)}_weekly`, monthly, 'all_time_all_time'];

  for (const id of ids) {
    await db.collection('leaderboard').doc(id).set({
      periodId: id,
      rankings,
      updatedAt: Timestamp.now(),
      totalParticipants: rankings.length,
    });
  }

  // One accepted friendship, so the friends scope is not an empty state.
  await db.collection('friendships').doc(`${uid}__seed-peer-1`).set({
    users: [uid, 'seed-peer-1'],
    status: 'accepted',
    createdAt: Timestamp.now(),
    createdBy: uid,
  });
}

async function main(): Promise<void> {
  console.log(`Seeding emulators at ${FIRESTORE_HOST} / ${AUTH_HOST} (project ${PROJECT_ID})`);
  const uid = await seedDriver();
  console.log(`  driver ${EMAIL} -> ${uid}`);
  const stats = await seedTrips(uid);
  console.log(`  ${stats.trips} trips, ${stats.miles} miles, average score ${stats.score}`);
  await seedUserDoc(uid, stats);
  console.log('  user document written');
  await seedLeaderboard(uid, stats.score);
  console.log('  leaderboard and one friendship written');
  console.log('Done. Sign in on the simulator with the credentials above.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

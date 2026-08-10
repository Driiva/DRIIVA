#!/usr/bin/env node
/**
 * Seeds the Auth and Firestore emulators with one signed-in-able driver and
 * enough real-shaped data for the authenticated surfaces to render.
 *
 * This exists because dashboard, trips, leaderboard and rewards went through
 * three build waves without anybody seeing them run: they are auth-gated, and
 * the client had no way to reach an emulator. Machine checks against the
 * signed-out shell were weaker evidence than they looked.
 *
 * Everything written here is the shape the real writers produce, so the pages
 * exercise their real code paths. It is seed data for a local emulator and
 * never touches a real project: the script refuses to run without
 * FIRESTORE_EMULATOR_HOST set.
 *
 * Usage:
 *   firebase emulators:start --only auth,firestore     (in another terminal)
 *   node scripts/seed-qa-emulator.mjs
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

// A real project id would mean real writes. The emulator host vars above are
// what keep this local, so refuse if somebody has cleared them deliberately.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Refusing to run: emulator hosts are not set.');
  process.exit(1);
}

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'driiva';

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
const auth = getAuth();

export const QA_EMAIL = 'qa.driver@driiva.test';
export const QA_PASSWORD = 'qa-password-123';

const now = Timestamp.now();
const daysAgo = (n) => Timestamp.fromMillis(Date.now() - n * 86_400_000);

/** Deterministic pseudo-random so successive runs seed the same board. */
function seededScores(count, seed = 7) {
  const out = [];
  let x = seed;
  for (let i = 0; i < count; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out.push(60 + (x % 40));
  }
  return out;
}

async function ensureUser(email, displayName) {
  // emailVerified matters: ProtectedRoute reads it off the AUTH user, not the
  // Firestore document, so an unverified seed user bounces straight to
  // /verify-email and none of the authenticated surfaces ever render.
  try {
    const existing = await auth.getUserByEmail(email);
    if (!existing.emailVerified) {
      await auth.updateUser(existing.uid, { emailVerified: true });
    }
    return existing.uid;
  } catch {
    const created = await auth.createUser({
      email,
      password: QA_PASSWORD,
      displayName,
      emailVerified: true,
    });
    return created.uid;
  }
}

async function main() {
  console.log(`Seeding emulators for project "${PROJECT_ID}"`);

  const uid = await ensureUser(QA_EMAIL, 'Jamie Whitfield');

  // Nine other drivers so the leaderboard has a real board with the QA user
  // sitting mid-table rather than alone at rank 1.
  const others = [];
  for (let i = 1; i <= 9; i++) {
    const email = `qa.driver${i}@driiva.test`;
    others.push({ uid: await ensureUser(email, `Driver ${i}`), name: `Driver ${i}` });
  }

  // ── The QA driver's profile ───────────────────────────────────────────────
  await db.collection('users').doc(uid).set({
    uid,
    email: QA_EMAIL,
    displayName: 'Jamie Whitfield',
    photoURL: null,
    phoneNumber: null,
    createdAt: daysAgo(64),
    updatedAt: now,
    onboardingComplete: true,
    emailVerified: true,
    drivingProfile: {
      currentScore: 84,
      scoreBreakdown: {
        speedScore: 88,
        brakingScore: 79,
        accelerationScore: 82,
        corneringScore: 86,
        phoneUsageScore: 94,
      },
      totalTrips: 37,
      totalMiles: 812.4,
      totalDrivingMinutes: 1642,
      lastTripAt: daysAgo(1),
      streakDays: 5,
      riskTier: 'low',
    },
    activePolicy: {
      policyId: `policy_${uid}`,
      policyNumber: 'DRV-QA-0001',
      status: 'active',
      premiumCents: 74800,
      coverageType: 'standard',
      renewalDate: daysAgo(-301),
    },
    poolShare: {
      currentShareCents: 0,
      contributionCents: 0,
      sharePercentage: 1.84,
      lastUpdatedAt: now,
    },
    recentTrips: [],
    fcmTokens: [],
    settings: { notificationsEnabled: true, autoTripDetection: false, unitSystem: 'imperial' },
  });

  // ── Trips ────────────────────────────────────────────────────────────────
  const scores = seededScores(26);
  const batch = db.batch();
  const recent = [];

  scores.forEach((score, i) => {
    const tripId = `qa-trip-${String(i).padStart(3, '0')}`;
    const startedAt = daysAgo(i + 1);
    const distanceMeters = 4000 + (i % 9) * 2600;
    const durationSeconds = 600 + (i % 7) * 420;

    batch.set(db.collection('trips').doc(tripId), {
      tripId,
      userId: uid,
      status: 'completed',
      score,
      scoreBreakdown: {
        speedScore: Math.min(100, score + 4),
        brakingScore: Math.max(0, score - 6),
        accelerationScore: score,
        corneringScore: Math.min(100, score + 2),
        phoneUsageScore: 96,
      },
      distanceMeters,
      durationSeconds,
      // startLocation and endLocation are REQUIRED by the trip contract, in
      // both the zod schema and shared/firestore-types. Omitting them here
      // took the whole trips page down through the route ErrorBoundary, which
      // was the seed being invalid rather than the page being wrong.
      startLocation: {
        lat: 51.5416 + (i % 5) * 0.004,
        lng: -0.1425 - (i % 5) * 0.006,
        address: ['12 Camden Road, London', 'Home', '48 Kingsland Road, London',
          'Kings Cross Station', 'Work'][i % 5],
        placeType: [null, 'home', null, 'other', 'work'][i % 5],
      },
      endLocation: {
        lat: 51.5362 + (i % 5) * 0.003,
        lng: -0.1033 - (i % 5) * 0.004,
        address: ['22 Upper Street, London', 'Work', 'Shoreditch High Street',
          'Angel Station', 'Home'][i % 5],
        placeType: [null, 'work', null, 'other', 'home'][i % 5],
      },
      startedAt,
      endedAt: Timestamp.fromMillis(startedAt.toMillis() + durationSeconds * 1000),
      routeSummary: ['Camden to Islington', 'Home to work', 'Hackney to Shoreditch',
        'Kings Cross to Angel', 'Work to home'][i % 5],
      createdAt: startedAt,
      updatedAt: startedAt,
    });

    if (i < 5) {
      recent.push({
        tripId,
        score,
        distanceMeters,
        durationSeconds,
        routeSummary: ['Camden to Islington', 'Home to work', 'Hackney to Shoreditch',
          'Kings Cross to Angel', 'Work to home'][i % 5],
      });
    }
  });

  batch.update(db.collection('users').doc(uid), { recentTrips: recent });

  // ── Achievements actually earned by that profile ─────────────────────────
  for (const id of ['first-trip', 'smooth-operator', 'streak-master']) {
    batch.set(db.collection('users').doc(uid).collection('achievements').doc(id), {
      achievementId: id,
      unlockedAt: daysAgo(id === 'first-trip' ? 60 : 9),
      tripId: 'qa-trip-010',
    });
  }

  // ── Notifications ────────────────────────────────────────────────────────
  batch.set(db.collection('users').doc(uid).collection('notifications').doc('n1'), {
    title: 'Trip scored',
    body: 'Your trip scored 88 out of 100. Strong drive.',
    type: 'trip_complete',
    data: { type: 'trip_complete', tripId: 'qa-trip-000' },
    read: false,
    createdAt: daysAgo(1),
  });
  batch.set(db.collection('users').doc(uid).collection('notifications').doc('n2'), {
    title: 'Your weekly summary',
    body: 'This week: 6 trips, 148 miles, average score 84.',
    type: 'weekly_summary',
    data: { type: 'weekly_summary' },
    read: true,
    createdAt: daysAgo(4),
  });

  await batch.commit();

  // ── Leaderboard, written the way the scheduled function writes it ────────
  const isoWeek = (() => {
    const d = new Date();
    const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = u.getUTCDay() || 7;
    u.setUTCDate(u.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((u.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${u.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  })();

  const board = [
    ...others.map((o, i) => ({
      userId: o.uid,
      displayName: o.name,
      score: 96 - i * 3,
      totalMiles: 1400 - i * 90,
      totalTrips: 52 - i * 3,
    })),
    { userId: uid, displayName: 'Jamie Whitfield', score: 84, totalMiles: 812, totalTrips: 37 },
  ]
    .sort((a, b) => b.score - a.score)
    .map((entry, i) => ({
      rank: i + 1,
      ...entry,
      photoURL: null,
      change: [2, -1, 0, 3, -2, 1, 0, -3, 4, 1][i] ?? 0,
    }));

  for (const [period, type] of [[isoWeek, 'weekly'], ['all_time', 'all_time']]) {
    await db.collection('leaderboard').doc(`${period}_${type}`).set({
      leaderboardId: `${period}_${type}`,
      period,
      periodType: type,
      rankings: board,
      totalParticipants: board.length,
      averageScore: Math.round((board.reduce((s, r) => s + r.score, 0) / board.length) * 10) / 10,
      medianScore: board[Math.floor(board.length / 2)].score,
      calculatedAt: now,
      nextCalculationAt: Timestamp.fromMillis(Date.now() + 900_000),
    });
  }

  // ── Community pool, plus eight closed periods for the history chart ──────
  await db.collection('communityPool').doc('current').set({
    poolId: 'current',
    totalPoolCents: 0,
    totalContributionsCents: 0,
    totalPayoutsCents: 0,
    reserveCents: 0,
    activeParticipants: board.length,
    totalParticipantsEver: board.length,
    averagePoolScore: 84.2,
    safetyFactor: 0.86,
    claimsThisPeriod: 0,
    periodStart: daysAgo(12),
    periodEnd: daysAgo(-18),
    periodType: 'monthly',
    projectedRefundRate: 0,
    lastCalculatedAt: now,
    version: 1,
  });

  const history = db.batch();
  ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']
    .forEach((period, i) => {
      history.set(
        db.collection('communityPool').doc('current').collection('history').doc(period),
        {
          period,
          periodType: 'monthly',
          totalPoolCents: 0,
          totalContributionsCents: 0,
          totalPayoutsCents: 0,
          activeParticipants: 4 + i * 3,
          averagePoolScore: 76 + i,
          safetyFactor: 0.8 + i * 0.01,
          claimsThisPeriod: 0,
          sharesFinalized: 0,
          archivedAt: now,
        },
      );
    });
  await history.commit();

  // The pool share is what the panel reads for "your share" and "your points".
  const poolPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  await db.collection('poolShares').doc(`${poolPeriod}_${uid}`).set({
    shareId: `${poolPeriod}_${uid}`,
    poolPeriod,
    userId: uid,
    contributionCents: 0,
    contributionCount: 0,
    sharePercentage: 1.84,
    weightedScore: 3108,
    baseRefundCents: 0,
    projectedRefundCents: 0,
    status: 'active',
    eligibleForRefund: false,
    tripsIncluded: 37,
    milesIncluded: 812,
    averageScore: 84,
    createdAt: daysAgo(12),
    updatedAt: now,
  });

  console.log(`\nSeeded.\n  email:    ${QA_EMAIL}\n  password: ${QA_PASSWORD}\n  uid:      ${uid}`);
  console.log(`  board:    ${board.length} drivers, QA user at rank ${board.find((r) => r.userId === uid).rank}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

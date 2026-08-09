/**
 * Integration: the pool HISTORY read path.
 *
 * `communityPool/current` is a single mutable document, so before Wave B
 * finalising a period overwrote it and left no trace. finalizePoolPeriod now
 * archives each closed period to `communityPool/current/history/{period}`
 * first, which is the only thing the chart is allowed to draw: the history is
 * real or the chart is empty.
 *
 * Seeds eight closed periods, the minimum the Wave B brief asks the chart to
 * render, and reads them back the way the client does.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { collection, getDocs, orderBy, query, limit, doc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

import { adminDb, adminAuth, clientAuth, clientDb } from './helpers';

const EMAIL = 'pool-history@example.com';
const PASSWORD = 'test-password-123';
let uid = '';

/** Eight consecutive closed months, oldest first. */
const PERIODS = [
  '2025-07', '2025-08', '2025-09', '2025-10',
  '2025-11', '2025-12', '2026-01', '2026-02',
];

beforeAll(async () => {
  try {
    const created = await createUserWithEmailAndPassword(clientAuth, EMAIL, PASSWORD);
    uid = created.user.uid;
  } catch {
    const existing = await signInWithEmailAndPassword(clientAuth, EMAIL, PASSWORD);
    uid = existing.user.uid;
  }
  await signOut(clientAuth).catch(() => {});
});

afterAll(async () => {
  await signOut(clientAuth).catch(() => {});
  if (uid) await adminAuth.deleteUser(uid).catch(() => {});
});

beforeEach(async () => {
  const existing = await adminDb.collection('communityPool').doc('current').collection('history').get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));
});

async function seedHistory() {
  const batch = adminDb.batch();
  PERIODS.forEach((period, i) => {
    const ref = adminDb
      .collection('communityPool')
      .doc('current')
      .collection('history')
      .doc(period);
    batch.set(ref, {
      period,
      periodType: 'monthly',
      totalPoolCents: 0,
      totalContributionsCents: 0,
      totalPayoutsCents: 0,
      // Participation is the series the chart plots, because it is real today
      // while the pool money model is still an open decision.
      activeParticipants: 10 + i * 5,
      averagePoolScore: 70 + i,
      safetyFactor: 0.8,
      claimsThisPeriod: 0,
      sharesFinalized: 0,
      archivedAt: new Date(),
    });
  });
  await batch.commit();
}

describe('pool history read path', () => {
  it('reads back eight archived periods in chart order', async () => {
    await seedHistory();

    const snapshot = await getDocs(
      query(
        collection(clientDb, 'communityPool', 'current', 'history'),
        orderBy('period', 'desc'),
        limit(12),
      ),
    );

    expect(snapshot.docs).toHaveLength(8);

    // The hook reverses Firestore's newest-first into oldest-first, which is
    // the direction a chart reads.
    const chartOrder = snapshot.docs.map((d) => d.data().period as string).reverse();
    expect(chartOrder).toEqual(PERIODS);

    const participants = snapshot.docs.map((d) => d.data().activeParticipants as number).reverse();
    expect(participants[0]).toBe(10);
    expect(participants[7]).toBe(45);
  });

  it('is readable without signing in, since it carries no per-user data', async () => {
    await seedHistory();
    const snapshot = await getDocs(collection(clientDb, 'communityPool', 'current', 'history'));
    expect(snapshot.docs.length).toBe(8);
  });

  it('cannot be written by a client', async () => {
    await signInWithEmailAndPassword(clientAuth, EMAIL, PASSWORD);
    await expect(
      setDoc(doc(clientDb, 'communityPool', 'current', 'history', '2026-03'), {
        period: '2026-03',
        activeParticipants: 999_999,
      }),
    ).rejects.toThrow();
    await signOut(clientAuth);
  });

  // An empty history is the honest state for a product whose first period has
  // not closed yet. The chart must render nothing rather than a plausible curve.
  it('returns nothing at all before any period has closed', async () => {
    const snapshot = await getDocs(collection(clientDb, 'communityPool', 'current', 'history'));
    expect(snapshot.empty).toBe(true);
  });
});

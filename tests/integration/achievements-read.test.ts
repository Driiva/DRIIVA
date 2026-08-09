/**
 * Integration: the achievements READ PATH.
 *
 * The unlock engine writes users/{uid}/achievements/{achievementId} with the
 * Admin SDK; both surfaces read that subcollection under firestore.rules and
 * merge it with the shared catalogue from @driiva/contracts.
 *
 * The bug this guards against is the one Wave D fixed: the client used to read
 * the catalogue from a top-level collection that only an admin callable
 * populates, so an unseeded environment rendered nothing even for a user whose
 * unlocks existed. Merging against the shared catalogue means the unlocks are
 * the only thing that has to come from Firestore.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

import { adminDb, adminAuth, clientAuth, clientDb } from './helpers';
import { buildAchievementViews, ACHIEVEMENT_META } from '../../packages/contracts/src/achievement';

const EMAIL = 'achievements-reader@example.com';
const OTHER_EMAIL = 'achievements-other@example.com';
const PASSWORD = 'test-password-123';

let uid = '';
let otherUid = '';

async function ensureUser(email: string): Promise<string> {
  try {
    const created = await createUserWithEmailAndPassword(clientAuth, email, PASSWORD);
    return created.user.uid;
  } catch {
    const existing = await signInWithEmailAndPassword(clientAuth, email, PASSWORD);
    return existing.user.uid;
  } finally {
    await signOut(clientAuth).catch(() => {});
  }
}

beforeAll(async () => {
  uid = await ensureUser(EMAIL);
  otherUid = await ensureUser(OTHER_EMAIL);
});

afterAll(async () => {
  await signOut(clientAuth).catch(() => {});
  await Promise.all(
    [uid, otherUid].filter(Boolean).map((u) => adminAuth.deleteUser(u).catch(() => {})),
  );
});

beforeEach(async () => {
  await signOut(clientAuth).catch(() => {});
  const existing = await adminDb.collection('users').doc(uid).collection('achievements').get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));
});

/** Writes an unlock exactly the way the trip trigger does. */
async function unlock(targetUid: string, achievementId: string) {
  await adminDb
    .collection('users')
    .doc(targetUid)
    .collection('achievements')
    .doc(achievementId)
    .set({ achievementId, unlockedAt: new Date(), tripId: 'trip-1' });
}

describe('achievements read path', () => {
  it('a user reads their own unlocks and merges them with the shared catalogue', async () => {
    await unlock(uid, 'first-trip');
    await unlock(uid, 'high-scorer');

    await signInWithEmailAndPassword(clientAuth, EMAIL, PASSWORD);
    const snap = await getDocs(collection(clientDb, 'users', uid, 'achievements'));

    expect(snap.docs).toHaveLength(2);

    const views = buildAchievementViews(
      snap.docs.map((d) => ({
        achievementId: d.id,
        unlockedAt: d.data().unlockedAt?.toDate?.() ?? null,
      })),
      { totalTrips: 12, totalMiles: 240, streakDays: 3, currentScore: 91 },
    );

    // The whole catalogue renders, not only the unlocked two.
    expect(views).toHaveLength(ACHIEVEMENT_META.length);
    expect(views.filter((v) => v.unlocked).map((v) => v.id).sort()).toEqual([
      'first-trip',
      'high-scorer',
    ]);

    // Unlocked sort ahead of locked.
    expect(views[0].unlocked).toBe(true);

    // Progress comes from the real profile: 12 trips caps at the 10 target.
    const smooth = views.find((v) => v.id === 'smooth-operator');
    expect(smooth?.progress).toBe(10);
    const century = views.find((v) => v.id === 'century-club');
    expect(century?.progress).toBe(12);
  });

  it('renders the full catalogue for a user with no unlocks at all', async () => {
    await signInWithEmailAndPassword(clientAuth, EMAIL, PASSWORD);
    const snap = await getDocs(collection(clientDb, 'users', uid, 'achievements'));
    expect(snap.empty).toBe(true);

    const views = buildAchievementViews([], {
      totalTrips: 0, totalMiles: 0, streakDays: 0, currentScore: 0,
    });
    expect(views).toHaveLength(ACHIEVEMENT_META.length);
    expect(views.every((v) => !v.unlocked)).toBe(true);
  });

  it('refuses another user their unlocks', async () => {
    await unlock(uid, 'first-trip');
    await signInWithEmailAndPassword(clientAuth, OTHER_EMAIL, PASSWORD);
    await expect(getDocs(collection(clientDb, 'users', uid, 'achievements'))).rejects.toThrow();
  });

  it('refuses a client granting itself an unlock', async () => {
    await signInWithEmailAndPassword(clientAuth, EMAIL, PASSWORD);
    await expect(
      setDoc(doc(clientDb, 'users', uid, 'achievements', 'perfect-score'), {
        achievementId: 'perfect-score',
        unlockedAt: new Date(),
      }),
    ).rejects.toThrow();
  });
});

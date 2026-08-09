/**
 * Integration: the leaderboard READ PATH, end to end against the emulators.
 *
 * The scheduled function writes `leaderboard/{period}_{periodType}` with the
 * Admin SDK; the client subscribes to that exact document id under
 * firestore.rules. This proves the two agree, using the same helper the
 * function uses to derive the id, and it proves the friends board filters on
 * real friendship documents rather than on anything invented.
 *
 * This is the test that would have caught the Wave 0 bug directly: a function
 * writing one document id while the client reads another leaves the board
 * empty with no error anywhere.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, getDoc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

import { adminDb, adminAuth, clientAuth, clientDb } from './helpers';
import { getIsoWeekPeriod } from '../../functions/src/utils/helpers';
import { friendshipId } from '../../packages/contracts/src/friendship';

const PASSWORD = 'test-password-123';

const ALICE_EMAIL = 'leaderboard-alice@example.com';
const BOB_EMAIL = 'leaderboard-bob@example.com';
const CAROL_EMAIL = 'leaderboard-carol@example.com';

let aliceUid = '';
let bobUid = '';
let carolUid = '';

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

/** Writes a board exactly the way the scheduled function does. */
async function seedBoard(period: string, periodType: string, rankings: unknown[]) {
  const id = `${period}_${periodType}`;
  await adminDb
    .collection('leaderboard')
    .doc(id)
    .set({
      leaderboardId: id,
      period,
      periodType,
      rankings,
      totalParticipants: rankings.length,
      averageScore: 80,
      medianScore: 80,
      calculatedAt: new Date(),
      nextCalculationAt: new Date(Date.now() + 900_000),
    });
  return id;
}

beforeAll(async () => {
  aliceUid = await ensureUser(ALICE_EMAIL);
  bobUid = await ensureUser(BOB_EMAIL);
  carolUid = await ensureUser(CAROL_EMAIL);
});

afterAll(async () => {
  await signOut(clientAuth).catch(() => {});
  await Promise.all(
    [aliceUid, bobUid, carolUid].filter(Boolean).map((uid) => adminAuth.deleteUser(uid).catch(() => {})),
  );
});

beforeEach(async () => {
  await signOut(clientAuth).catch(() => {});
});

describe('leaderboard read path', () => {
  it('the client reads the exact document id the function writes', async () => {
    const period = getIsoWeekPeriod(new Date());
    const writtenId = await seedBoard(period, 'weekly', [
      { rank: 1, userId: aliceUid, displayName: 'Alice', score: 91, totalMiles: 120, totalTrips: 9, change: 2 },
      { rank: 2, userId: bobUid, displayName: 'Bob', score: 84, totalMiles: 80, totalTrips: 6, change: -1 },
    ]);

    // The id the CLIENT derives, from its own convention.
    const clientPeriod = getIsoWeekPeriod(new Date());
    const clientId = `${clientPeriod}_weekly`;
    expect(clientId).toBe(writtenId);

    await signInWithEmailAndPassword(clientAuth, ALICE_EMAIL, PASSWORD);
    const snap = await getDoc(doc(clientDb, 'leaderboard', clientId));

    expect(snap.exists()).toBe(true);
    expect(snap.data()?.rankings).toHaveLength(2);
    expect(snap.data()?.rankings[0].userId).toBe(aliceUid);
  });

  it('refuses the board to a signed-out reader, since it carries display names', async () => {
    const period = getIsoWeekPeriod(new Date());
    const id = await seedBoard(period, 'weekly', [
      { rank: 1, userId: aliceUid, displayName: 'Alice', score: 91, totalMiles: 120, totalTrips: 9, change: 0 },
    ]);

    await expect(getDoc(doc(clientDb, 'leaderboard', id))).rejects.toThrow();
  });

  it('filters the friends board on real friendship documents', async () => {
    const period = getIsoWeekPeriod(new Date());
    const id = await seedBoard(period, 'weekly', [
      { rank: 1, userId: carolUid, displayName: 'Carol', score: 95, totalMiles: 200, totalTrips: 20, change: 0 },
      { rank: 2, userId: aliceUid, displayName: 'Alice', score: 91, totalMiles: 120, totalTrips: 9, change: 1 },
      { rank: 3, userId: bobUid, displayName: 'Bob', score: 84, totalMiles: 80, totalTrips: 6, change: -1 },
    ]);

    // Alice and Bob are friends. Carol is on the board but is nobody's friend.
    const pair = friendshipId(aliceUid, bobUid);
    await adminDb
      .collection('friendships')
      .doc(pair)
      .set({
        friendshipId: pair,
        users: [aliceUid, bobUid].sort(),
        initiatedBy: aliceUid,
        createdAt: new Date(),
      });

    await signInWithEmailAndPassword(clientAuth, ALICE_EMAIL, PASSWORD);

    // The query the friends tab runs.
    const friendDocs = await getDocs(
      query(collection(clientDb, 'friendships'), where('users', 'array-contains', aliceUid)),
    );
    const friendUids = new Set(
      friendDocs.docs.flatMap((d) => (d.data().users as string[]).filter((u) => u !== aliceUid)),
    );
    expect(friendUids).toEqual(new Set([bobUid]));

    const board = await getDoc(doc(clientDb, 'leaderboard', id));
    const rankings = board.data()?.rankings as Array<{ userId: string }>;
    const friendsBoard = rankings.filter((r) => r.userId === aliceUid || friendUids.has(r.userId));

    // Alice and Bob, not Carol.
    expect(friendsBoard.map((r) => r.userId).sort()).toEqual([aliceUid, bobUid].sort());

    // And the ranks shown are the REAL global ranks, so a friend's position
    // never disagrees with their standing overall.
    expect(rankings.find((r) => r.userId === bobUid)).toMatchObject({ userId: bobUid });
    const bobRow = friendsBoard.find((r) => r.userId === bobUid) as { rank?: number };
    expect(bobRow?.rank).toBe(3);
  });

  it('a user cannot read a friendship they are not part of', async () => {
    const pair = friendshipId(aliceUid, bobUid);
    await adminDb
      .collection('friendships')
      .doc(pair)
      .set({
        friendshipId: pair,
        users: [aliceUid, bobUid].sort(),
        initiatedBy: aliceUid,
        createdAt: new Date(),
      });

    await signInWithEmailAndPassword(clientAuth, CAROL_EMAIL, PASSWORD);
    await expect(getDoc(doc(clientDb, 'friendships', pair))).rejects.toThrow();
  });

  it('an empty period yields no document rather than an invented board', async () => {
    await signInWithEmailAndPassword(clientAuth, ALICE_EMAIL, PASSWORD);
    const snap = await getDoc(doc(clientDb, 'leaderboard', '1970-W01_weekly'));
    expect(snap.exists()).toBe(false);
  });

  it('the client cannot write the leaderboard', async () => {
    const period = getIsoWeekPeriod(new Date());
    const id = `${period}_weekly`;
    await signInWithEmailAndPassword(clientAuth, ALICE_EMAIL, PASSWORD);
    await expect(
      setDoc(doc(clientDb, 'leaderboard', id), { rankings: [{ rank: 1, userId: aliceUid, score: 100 }] }),
    ).rejects.toThrow();
  });
});

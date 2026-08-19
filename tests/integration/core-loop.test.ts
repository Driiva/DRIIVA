/**
 * THE SCRIPTED CORE LOOP
 * ======================
 * System 2's done-when: "a scripted user completes the loop end to end; every
 * action emits an analytics event; loop state survives kill-and-relaunch."
 * This is that script.
 *
 * It drives TWO real users through the committed loop against the auth and
 * firestore emulators, using the client SDK so every write goes through
 * firestore.rules rather than around them via the Admin SDK. An Admin-SDK
 * version of this test would pass while the real app was refused by its own
 * rules, which is the shape of green that means nothing.
 *
 * The redemption decision under test is `decideRedemption` from
 * @driiva/contracts, which is the exact function both the mobile app and the
 * web app call. The Firestore calls here mirror mobile/lib/community.ts step
 * for step. What this cannot prove is the React layer above it; that needs a
 * device, and is what the stranger test in System 5 is for.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

import {
  decideRedemption,
  friendshipId,
  generateInviteCode,
  INVITE_TTL_DAYS,
} from '@driiva/contracts';

import { adminDb, adminAuth, clientAuth, clientDb } from './helpers';

const PASSWORD = 'loop-test-password-1';
const alice = { email: `alice-${Date.now()}@driiva.test`, uid: '' };
const bob = { email: `bob-${Date.now()}@driiva.test`, uid: '' };

let inviteCode = '';

/** Mirrors mobile/lib/analytics.ts firestoreSink, including the rule's fields. */
async function emit(userId: string, event: string, params: Record<string, unknown> = {}) {
  await addDoc(collection(clientDb, 'users', userId, 'events'), {
    event,
    params,
    userId,
    sessionId: 'scripted-run',
    occurredAt: Date.now(),
    durable: true,
    recordedAt: serverTimestamp(),
  });
}

async function eventsFor(userId: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(clientDb, 'users', userId, 'events'), orderBy('occurredAt')),
  );
  return snap.docs.map((d) => d.data().event as string);
}

/** Signs a user in and returns their uid. */
async function signInAs(email: string): Promise<string> {
  const cred = await signInWithEmailAndPassword(clientAuth, email, PASSWORD);
  return cred.user.uid;
}

beforeAll(async () => {
  for (const person of [alice, bob]) {
    const cred = await createUserWithEmailAndPassword(clientAuth, person.email, PASSWORD);
    person.uid = cred.user.uid;

    // The Auth onCreate trigger is not running in this suite, so the user doc
    // is seeded the way provisionUserOnSignup would.
    await adminDb.collection('users').doc(person.uid).set({
      email: person.email,
      displayName: person.email.split('@')[0],
      onboardingComplete: false,
      createdAt: new Date(),
    });
    await signOut(clientAuth);
  }
}, 60_000);

afterAll(async () => {
  await signOut(clientAuth).catch(() => {});
  for (const person of [alice, bob]) {
    if (person.uid) await adminAuth.deleteUser(person.uid).catch(() => {});
  }
});

describe('the core loop, end to end', () => {
  it('1. a new driver completes onboarding, and the gate is written', async () => {
    await signInAs(alice.email);

    await emit(alice.uid, 'onboarding_started');
    await emit(alice.uid, 'onboarding_step_viewed', { step: 1 });

    // The owner-gated completion write, exactly as the app performs it.
    await setDoc(
      doc(clientDb, 'users', alice.uid),
      { onboardingComplete: true },
      { merge: true },
    );
    await emit(alice.uid, 'onboarding_completed');

    const after = await getDoc(doc(clientDb, 'users', alice.uid));
    expect(after.data()?.onboardingComplete).toBe(true);
  });

  it('2. she mints an invite code', async () => {
    inviteCode = generateInviteCode();
    const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    await setDoc(doc(clientDb, 'invites', inviteCode), {
      code: inviteCode,
      createdBy: alice.uid,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expires),
      status: 'pending',
    });
    await emit(alice.uid, 'invite_created');
    await emit(alice.uid, 'invite_shared');

    const stored = await getDoc(doc(clientDb, 'invites', inviteCode));
    expect(stored.exists()).toBe(true);
    expect(stored.data()?.status).toBe('pending');
  });

  it('3. she cannot redeem her own code', async () => {
    const invite = await getDoc(doc(clientDb, 'invites', inviteCode));
    const decision = decideRedemption({
      rawCode: inviteCode,
      userId: alice.uid,
      invite: {
        exists: invite.exists(),
        createdBy: invite.data()?.createdBy,
        status: invite.data()?.status,
        expiresAtMs: invite.data()?.expiresAt?.toDate?.().getTime(),
      },
      alreadyFriends: false,
      nowMs: Date.now(),
    });

    expect(decision).toEqual({ ok: false, failure: 'own-code' });
  });

  it('4. a second driver redeems it, and the friendship is written', async () => {
    await signOut(clientAuth);
    await signInAs(bob.email);

    const invite = await getDoc(doc(clientDb, 'invites', inviteCode));
    const pairId = friendshipId(bob.uid, alice.uid);
    const existing = await getDoc(doc(clientDb, 'friendships', pairId));

    const decision = decideRedemption({
      rawCode: inviteCode.toLowerCase(), // as a human would retype it
      userId: bob.uid,
      invite: {
        exists: invite.exists(),
        createdBy: invite.data()?.createdBy,
        status: invite.data()?.status,
        expiresAtMs: invite.data()?.expiresAt?.toDate?.().getTime(),
      },
      alreadyFriends: existing.exists(),
      nowMs: Date.now(),
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;

    await updateDoc(doc(clientDb, 'invites', decision.code), {
      status: 'accepted',
      acceptedBy: bob.uid,
      acceptedAt: serverTimestamp(),
    });

    await setDoc(doc(clientDb, 'friendships', decision.pairId), {
      friendshipId: decision.pairId,
      users: [bob.uid, decision.friendUid].sort(),
      initiatedBy: decision.friendUid,
      viaInviteCode: decision.code,
      createdAt: serverTimestamp(),
    });

    await emit(bob.uid, 'invite_redeemed', { outcome: 'ok' });
    await emit(bob.uid, 'friend_added');

    const pair = await getDoc(doc(clientDb, 'friendships', decision.pairId));
    expect(pair.exists()).toBe(true);
    expect(pair.data()?.users).toEqual([bob.uid, alice.uid].sort());
  });

  it('5. the code cannot be spent twice', async () => {
    const invite = await getDoc(doc(clientDb, 'invites', inviteCode));
    const decision = decideRedemption({
      rawCode: inviteCode,
      userId: bob.uid,
      invite: {
        exists: invite.exists(),
        createdBy: invite.data()?.createdBy,
        status: invite.data()?.status,
        expiresAtMs: invite.data()?.expiresAt?.toDate?.().getTime(),
      },
      alreadyFriends: true,
      nowMs: Date.now(),
    });

    expect(decision).toEqual({ ok: false, failure: 'already-used' });
  });

  it('6. each driver sees the friendship from their own side', async () => {
    // Bob's view.
    const bobSide = await getDocs(
      query(collection(clientDb, 'friendships'), where('users', 'array-contains', bob.uid)),
    );
    expect(bobSide.docs).toHaveLength(1);
    expect(bobSide.docs[0].data().users).toContain(alice.uid);

    // Alice's view of the same single document.
    await signOut(clientAuth);
    await signInAs(alice.email);

    const aliceSide = await getDocs(
      query(collection(clientDb, 'friendships'), where('users', 'array-contains', alice.uid)),
    );
    expect(aliceSide.docs).toHaveLength(1);
    expect(aliceSide.docs[0].id).toBe(bobSide.docs[0].id);
  });

  it('7. the loop leaves an analytics trail attributable to each driver', async () => {
    const aliceEvents = await eventsFor(alice.uid);

    expect(aliceEvents).toContain('onboarding_started');
    expect(aliceEvents).toContain('onboarding_completed');
    expect(aliceEvents).toContain('invite_created');

    await signOut(clientAuth);
    await signInAs(bob.email);
    const bobEvents = await eventsFor(bob.uid);

    expect(bobEvents).toContain('invite_redeemed');
    expect(bobEvents).toContain('friend_added');

    // The two trails are separate. One driver's actions must never appear
    // under the other's id, or the design gate cannot prove who did what.
    expect(bobEvents).not.toContain('invite_created');
  });

  it('8. the trail is append-only, so it cannot be rewritten after the fact', async () => {
    const snap = await getDocs(collection(clientDb, 'users', bob.uid, 'events'));
    const first = snap.docs[0];

    // The design gate rests on this evidence. A user who could edit or delete
    // their own events could manufacture a completed loop.
    await expect(updateDoc(first.ref, { event: 'rewritten' })).rejects.toThrow();
  });

  it('9. loop state survives a kill and relaunch', async () => {
    // A relaunch is a fresh client with no in-memory state, signing back in.
    // Everything the loop produced must still be there, read through the rules.
    await signOut(clientAuth);
    const uid = await signInAs(bob.email);

    const friendships = await getDocs(
      query(collection(clientDb, 'friendships'), where('users', 'array-contains', uid)),
    );
    expect(friendships.docs).toHaveLength(1);

    const events = await eventsFor(uid);
    expect(events).toContain('friend_added');

    const invite = await getDoc(doc(clientDb, 'invites', inviteCode));
    expect(invite.data()?.status).toBe('accepted');
  });
});

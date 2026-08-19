/**
 * Rules suite for the Wave B social graph: `friendships/{pair}` and
 * `invites/{code}`.
 *
 * Runs the REAL firestore.rules against the emulator. The headline case is the
 * one the brief asks for: an invite created by user A can be accepted by user
 * B, and the resulting friendship is visible to both and to nobody else.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

import { createTestEnv } from './helpers';

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const MALLORY = 'mallory-uid';

/** Sorted-pair id, mirroring friendshipId() in @driiva/contracts. */
const pairId = (a: string, b: string) => [a, b].sort().join('_');
const ALICE_BOB = pairId(ALICE, BOB);

const CODE = 'ABCD2345';

let env: RulesTestEnvironment;

/** Milliseconds either side of now, as a Date the emulator will accept. */
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

async function seedInvite(overrides: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'invites', CODE), {
      code: CODE,
      createdBy: ALICE,
      createdAt: new Date(),
      expiresAt: inDays(14),
      status: 'pending',
      ...overrides,
    });
  });
}

async function seedFriendship() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'friendships', ALICE_BOB), {
      friendshipId: ALICE_BOB,
      users: [ALICE, BOB].sort(),
      initiatedBy: ALICE,
      viaInviteCode: CODE,
      createdAt: new Date(),
    });
  });
}

beforeAll(async () => {
  env = await createTestEnv('driiva-rules-friendships');
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('invites', () => {
  it('lets a signed-in user create an invite for themselves', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'invites', CODE), {
        code: CODE,
        createdBy: ALICE,
        createdAt: serverTimestamp(),
        expiresAt: inDays(14),
        status: 'pending',
      }),
    );
  });

  it('refuses an invite created in somebody else’s name', async () => {
    const mallory = env.authenticatedContext(MALLORY).firestore();
    await assertFails(
      setDoc(doc(mallory, 'invites', CODE), {
        code: CODE,
        createdBy: ALICE,
        createdAt: serverTimestamp(),
        expiresAt: inDays(14),
        status: 'pending',
      }),
    );
  });

  it('refuses an invite that arrives already accepted', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(alice, 'invites', CODE), {
        code: CODE,
        createdBy: ALICE,
        createdAt: serverTimestamp(),
        expiresAt: inDays(14),
        status: 'pending',
        acceptedBy: MALLORY,
      }),
    );
  });

  it('refuses an unauthenticated read, so codes are not enumerable anonymously', async () => {
    await seedInvite();
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'invites', CODE)));
  });

  it('lets the invited user accept a pending, unexpired invite', async () => {
    await seedInvite();
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      updateDoc(doc(bob, 'invites', CODE), {
        status: 'accepted',
        acceptedBy: BOB,
        acceptedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses self-acceptance by the creator', async () => {
    await seedInvite();
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      updateDoc(doc(alice, 'invites', CODE), {
        status: 'accepted',
        acceptedBy: ALICE,
        acceptedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses acceptance stamped with somebody else’s uid', async () => {
    await seedInvite();
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      updateDoc(doc(bob, 'invites', CODE), {
        status: 'accepted',
        acceptedBy: MALLORY,
        acceptedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses acceptance of an expired invite', async () => {
    await seedInvite({ expiresAt: inDays(-1) });
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      updateDoc(doc(bob, 'invites', CODE), {
        status: 'accepted',
        acceptedBy: BOB,
        acceptedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses a second acceptance of an already-accepted invite', async () => {
    await seedInvite({ status: 'accepted', acceptedBy: BOB });
    const mallory = env.authenticatedContext(MALLORY).firestore();
    await assertFails(
      updateDoc(doc(mallory, 'invites', CODE), {
        status: 'accepted',
        acceptedBy: MALLORY,
        acceptedAt: serverTimestamp(),
      }),
    );
  });

  // An acceptor who could rewrite expiresAt could keep a dead invite alive.
  it('refuses an acceptance that also edits the invite’s own terms', async () => {
    await seedInvite();
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      updateDoc(doc(bob, 'invites', CODE), {
        status: 'accepted',
        acceptedBy: BOB,
        expiresAt: inDays(3650),
      }),
    );
    await assertFails(
      updateDoc(doc(bob, 'invites', CODE), {
        status: 'accepted',
        acceptedBy: BOB,
        createdBy: BOB,
      }),
    );
  });

  it('lets the creator revoke an untaken invite, but nobody else', async () => {
    await seedInvite();
    const mallory = env.authenticatedContext(MALLORY).firestore();
    await assertFails(updateDoc(doc(mallory, 'invites', CODE), { status: 'revoked' }));

    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(alice, 'invites', CODE), { status: 'revoked' }));
  });
});

describe('friendships', () => {
  it('lets the accepting user create the pair document', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      setDoc(doc(bob, 'friendships', ALICE_BOB), {
        friendshipId: ALICE_BOB,
        users: [ALICE, BOB].sort(),
        initiatedBy: ALICE,
        viaInviteCode: CODE,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('refuses a friendship the creator is not part of', async () => {
    const mallory = env.authenticatedContext(MALLORY).firestore();
    await assertFails(
      setDoc(doc(mallory, 'friendships', ALICE_BOB), {
        friendshipId: ALICE_BOB,
        users: [ALICE, BOB].sort(),
        initiatedBy: ALICE,
        createdAt: serverTimestamp(),
      }),
    );
  });

  // Without this, Mallory could add herself to anyone's friends list and read
  // their position on the friends board.
  it('refuses a friendship somebody grants themselves', async () => {
    const mallory = env.authenticatedContext(MALLORY).firestore();
    const pair = pairId(ALICE, MALLORY);
    await assertFails(
      setDoc(doc(mallory, 'friendships', pair), {
        friendshipId: pair,
        users: [ALICE, MALLORY].sort(),
        initiatedBy: MALLORY, // claiming to have invited themselves
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('refuses a document id that does not match the sorted pair', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      setDoc(doc(bob, 'friendships', 'not-the-pair'), {
        friendshipId: 'not-the-pair',
        users: [ALICE, BOB].sort(),
        initiatedBy: ALICE,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('refuses an unsorted users array, so the pair id stays canonical', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    const [lo, hi] = [ALICE, BOB].sort();
    await assertFails(
      setDoc(doc(bob, 'friendships', ALICE_BOB), {
        friendshipId: ALICE_BOB,
        users: [hi, lo],
        initiatedBy: ALICE,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('refuses befriending yourself', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    const selfPair = pairId(BOB, BOB);
    await assertFails(
      setDoc(doc(bob, 'friendships', selfPair), {
        friendshipId: selfPair,
        users: [BOB, BOB],
        initiatedBy: BOB,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('is readable by both parties and by nobody else', async () => {
    await seedFriendship();
    await assertSucceeds(getDoc(doc(env.authenticatedContext(ALICE).firestore(), 'friendships', ALICE_BOB)));
    await assertSucceeds(getDoc(doc(env.authenticatedContext(BOB).firestore(), 'friendships', ALICE_BOB)));
    await assertFails(getDoc(doc(env.authenticatedContext(MALLORY).firestore(), 'friendships', ALICE_BOB)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'friendships', ALICE_BOB)));
  });

  /**
   * The read that happens BEFORE any friendship exists.
   *
   * Redeeming an invite asks "are these two already connected" by getting
   * friendships/{pairId}, and on the happy path that document is absent. The
   * rule used to read `resource.data.users` unguarded, which raises a Null
   * value error on a missing document rather than denying quietly, and a rules
   * error reaches the client as a FirebaseError. Every first-time redemption,
   * the only kind that matters, failed with "we could not connect you just
   * now" on both web and mobile.
   *
   * The suite missed it because the end-to-end test below models the WRITES
   * the flow performs and not the read the client performs first. A test that
   * seeds the document can never catch a bug that only exists when it is
   * absent.
   */
  it('can be read when it does not exist yet, which is the redemption path', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(doc(bob, 'friendships', ALICE_BOB)));
  });

  it('still refuses a stranger reading a pair that does exist', async () => {
    await seedFriendship();
    const mallory = env.authenticatedContext(MALLORY).firestore();
    await assertFails(getDoc(doc(mallory, 'friendships', ALICE_BOB)));
  });

  it('cannot be edited into a different pair', async () => {
    await seedFriendship();
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      updateDoc(doc(bob, 'friendships', ALICE_BOB), { users: [BOB, MALLORY].sort() }),
    );
  });

  it('can be deleted by either party but not by a stranger', async () => {
    await seedFriendship();
    await assertFails(deleteDoc(doc(env.authenticatedContext(MALLORY).firestore(), 'friendships', ALICE_BOB)));
    await assertSucceeds(deleteDoc(doc(env.authenticatedContext(BOB).firestore(), 'friendships', ALICE_BOB)));
  });
});

describe('the whole invite flow, end to end', () => {
  // This is the case the Wave B brief asks to be proven: A invites, B accepts,
  // and both can then see the friendship.
  it('A creates an invite, B redeems it, both see the friendship', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const bob = env.authenticatedContext(BOB).firestore();

    await assertSucceeds(
      setDoc(doc(alice, 'invites', CODE), {
        code: CODE,
        createdBy: ALICE,
        createdAt: serverTimestamp(),
        expiresAt: inDays(14),
        status: 'pending',
      }),
    );

    // B looks the code up, which is a get rather than a query precisely so the
    // rules can authorise it.
    const found = await getDoc(doc(bob, 'invites', CODE));
    expect(found.exists()).toBe(true);
    expect(found.data()?.createdBy).toBe(ALICE);

    await assertSucceeds(
      updateDoc(doc(bob, 'invites', CODE), {
        status: 'accepted',
        acceptedBy: BOB,
        acceptedAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      setDoc(doc(bob, 'friendships', ALICE_BOB), {
        friendshipId: ALICE_BOB,
        users: [ALICE, BOB].sort(),
        initiatedBy: ALICE,
        viaInviteCode: CODE,
        createdAt: serverTimestamp(),
      }),
    );

    const seenByAlice = await getDoc(doc(alice, 'friendships', ALICE_BOB));
    expect(seenByAlice.exists()).toBe(true);
    expect(seenByAlice.data()?.users).toEqual([ALICE, BOB].sort());
  });
});

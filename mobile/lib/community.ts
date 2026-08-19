/**
 * COMMUNITY
 * =========
 * The whole social half of the core loop, behind one interface: see who your
 * friends are, mint a code to add one, redeem someone else's.
 *
 * WHY THIS EXISTS
 * The friends leaderboard has been readable on mobile since Wave B
 * (mobile/app/leaderboard.tsx subscribes to `friendships` and offers a friends
 * scope), but nothing on mobile could ever CREATE a friendship. The invite
 * write path shipped on web only. Every beta user is a mobile user, so the
 * friends board was empty by construction: a scope the app offered and the app
 * itself made unreachable. That is the gap that stopped the loop closing.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * The rules of redemption. `decideRedemption` lives in @driiva/contracts and
 * is shared with the web app, because the two surfaces speak different
 * Firestore SDKs but must agree exactly on which codes are acceptable. A code
 * minted on web has to redeem on mobile. Duplicating that reasoning here is
 * how the two drift apart, and the failure would be invisible until a real
 * user in a car park could not add their friend.
 *
 * ANALYTICS ARE EMITTED HERE, NOT AT THE CALL SITES
 * The brief requires every core-loop action to be instrumented. Emitting from
 * inside the module makes that true by construction: a screen cannot add a
 * friend without the event being recorded, and a future call site cannot
 * forget. The alternative, trusting each caller, is how a funnel ends up with
 * a hole in the middle that nobody notices for a month.
 */
import {
  decideRedemption,
  friendshipId,
  generateInviteCode,
  normaliseInviteCode,
  INVITE_TTL_DAYS,
  type RedeemFailure,
} from '@driiva/contracts';

import { firestore } from '@/lib/firebase';
import { track } from '@/lib/analytics';

export interface Friend {
  uid: string;
  friendshipId: string;
  since: Date | null;
}

export interface RedeemResult {
  ok: boolean;
  failure?: RedeemFailure;
  friendUid?: string;
}

/** Human-readable copy for each failure. Honest, and says what to do next. */
export const REDEEM_MESSAGES: Record<RedeemFailure, string> = {
  'invalid-code': 'That code does not look right. Codes are 8 characters.',
  'not-found': 'We could not find that code. Check it and try again.',
  expired: 'That code has expired. Ask your friend for a new one.',
  'already-used': 'That code has already been used.',
  'own-code': 'That is your own code. Share it with a friend instead.',
  'already-friends': 'You two are already connected.',
  'write-failed': 'We could not connect you just now. Try again.',
};

/**
 * Subscribes to the viewer's friendships.
 *
 * One document per pair keyed by the sorted uids, so this is a single
 * array-contains query and there is no mirrored row to fall out of step. See
 * packages/contracts/src/friendship.ts for the model.
 */
export function subscribeFriends(
  userId: string,
  onChange: (friends: Friend[]) => void,
): () => void {
  return firestore()
    .collection('friendships')
    .where('users', 'array-contains', userId)
    .onSnapshot(
      (snap: {
        docs: Array<{
          id: string;
          data: () => { users?: string[]; createdAt?: { toDate?: () => Date } };
        }>;
      }) => {
        const friends: Friend[] = snap.docs.map((d) => {
          const data = d.data();
          const other = (data.users ?? []).find((u) => u !== userId) ?? '';
          return {
            uid: other,
            friendshipId: d.id,
            since: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          };
        });
        onChange(friends);
      },
      // A permission error or a dropped connection must not take the screen
      // down. An empty list is the honest render, and the caller separates
      // "no friends yet" from "we could not load" via its own loading state.
      () => onChange([]),
    );
}

/**
 * Mints an invite code owned by the viewer.
 *
 * Collisions are astronomically unlikely at this alphabet and length, but a
 * code that silently overwrote somebody else's pending invite would hand two
 * people the same string and connect the wrong pair, so the write checks
 * first and retries rather than trusting the odds.
 */
export async function createInvite(userId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const ref = firestore().collection('invites').doc(code);

    try {
      const existing = await ref.get();
      if (existing.exists) continue;

      const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
      await ref.set({
        code,
        createdBy: userId,
        createdAt: firestore.FieldValue.serverTimestamp(),
        expiresAt: expires,
        status: 'pending',
      });

      track('invite_created');
      return code;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Redeems someone else's code.
 *
 * Two writes rather than a transaction, because these are two documents under
 * two different rule blocks and a rules-authorised batch would have to satisfy
 * both at once. If the second write fails the invite is spent without a
 * friendship, so this reports the failure rather than pretending; the user can
 * be re-invited. Making it atomic belongs in a callable function and is noted
 * for the server wave.
 */
export async function redeemInvite(userId: string, rawCode: string): Promise<RedeemResult> {
  const code = normaliseInviteCode(rawCode);

  let decision;
  try {
    const inviteSnap = await firestore().collection('invites').doc(code).get();
    const data = inviteSnap.exists ? (inviteSnap.data() ?? {}) : {};

    // Firestore hands back a Timestamp; the shared decision takes plain
    // milliseconds so it never has to know which SDK produced it.
    const expiresAt = data.expiresAt as { toDate?: () => Date } | undefined;

    const pairId = friendshipId(userId, String(data.createdBy ?? ''));
    const pairSnap = await firestore().collection('friendships').doc(pairId).get();

    decision = decideRedemption({
      rawCode,
      userId,
      invite: {
        exists: Boolean(inviteSnap.exists),
        createdBy: data.createdBy as string | undefined,
        status: data.status as 'pending' | 'accepted' | 'revoked' | undefined,
        expiresAtMs: expiresAt?.toDate ? expiresAt.toDate().getTime() : undefined,
      },
      alreadyFriends: Boolean(pairSnap.exists),
      nowMs: Date.now(),
    });
  } catch {
    track('invite_redeemed', { outcome: 'write-failed' });
    return { ok: false, failure: 'write-failed' };
  }

  if (!decision.ok) {
    track('invite_redeemed', { outcome: decision.failure });
    return { ok: false, failure: decision.failure };
  }

  try {
    await firestore().collection('invites').doc(decision.code).update({
      status: 'accepted',
      acceptedBy: userId,
      acceptedAt: firestore.FieldValue.serverTimestamp(),
    });

    await firestore()
      .collection('friendships')
      .doc(decision.pairId)
      .set({
        friendshipId: decision.pairId,
        users: [userId, decision.friendUid].sort(),
        initiatedBy: decision.friendUid,
        viaInviteCode: decision.code,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

    track('invite_redeemed', { outcome: 'ok' });
    track('friend_added');
    return { ok: true, friendUid: decision.friendUid };
  } catch {
    track('invite_redeemed', { outcome: 'write-failed' });
    return { ok: false, failure: 'write-failed' };
  }
}

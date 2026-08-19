/**
 * FRIENDS HOOK
 * ============
 * Subscribes to the viewer's friendships, and carries the two write paths:
 * creating an invite, and redeeming one.
 *
 * The friendship model is one document per pair, keyed by the two uids sorted
 * and joined, so "who are my friends" is a single array-contains query and
 * there is no second mirrored row to fall out of step. See
 * packages/contracts/src/friendship.ts for why.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import {
  decideRedemption,
  friendshipId,
  generateInviteCode,
  normaliseInviteCode,
  INVITE_TTL_DAYS,
  type FriendshipDocument,
  type RedeemFailure,
} from '@driiva/contracts';

export interface Friend {
  uid: string;
  friendshipId: string;
  since: Date | null;
}

/**
 * Why a redemption failed, in terms the UI can turn into honest copy.
 *
 * Re-exported from @driiva/contracts rather than declared here: mobile has to
 * agree with this exactly, and the shared decision that produces these values
 * lives there. See decideRedemption.
 */
export type { RedeemFailure };

export interface RedeemResult {
  ok: boolean;
  failure?: RedeemFailure;
  friendUid?: string;
}

export function useFriends(userId: string | null) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !userId) {
      setFriends([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(db, 'friendships'), where('users', 'array-contains', userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: Friend[] = snapshot.docs.map((d) => {
          const data = d.data() as FriendshipDocument;
          const otherUid = data.users.find((u) => u !== userId) ?? '';
          const createdAt = data.createdAt as unknown as Timestamp | undefined;
          return {
            uid: otherUid,
            friendshipId: d.id,
            since: createdAt?.toDate ? createdAt.toDate() : null,
          };
        });
        setFriends(next);
        setLoading(false);
      },
      (err) => {
        console.error('[useFriends] subscription error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userId]);

  /**
   * Mints an invite code owned by the viewer. Collisions are astronomically
   * unlikely at this alphabet and length, but a code that silently overwrote
   * somebody else's invite would be a real bug, so the write checks first.
   */
  const createInvite = useCallback(async (): Promise<string | null> => {
    if (!isFirebaseConfigured || !db || !userId) return null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      const ref = doc(db, 'invites', code);
      const existing = await getDoc(ref);
      if (existing.exists()) continue;

      const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
      await setDoc(ref, {
        code,
        createdBy: userId,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expires),
        status: 'pending',
      });
      return code;
    }
    return null;
  }, [userId]);

  /**
   * Redeems someone else's code: marks the invite accepted, then writes the
   * friendship. Both writes are the acceptor's, which is what the rules
   * expect.
   *
   * These are two writes rather than a transaction because they are two
   * documents under two different rule blocks, and a rules-authorised batch
   * would have to satisfy both in one shot. If the second write fails the
   * invite is spent without a friendship, so redeem reports the failure rather
   * than pretending; the user can be re-invited. Making this atomic belongs in
   * a callable function and is noted for the server wave.
   */
  const redeemInvite = useCallback(
    async (rawCode: string): Promise<RedeemResult> => {
      if (!isFirebaseConfigured || !db || !userId) {
        return { ok: false, failure: 'write-failed' };
      }

      const code = normaliseInviteCode(rawCode);
      const inviteRef = doc(db, 'invites', code);
      const snap = await getDoc(inviteRef);
      const invite = snap.exists() ? snap.data() : {};
      const expiresAt = invite.expiresAt as Timestamp | undefined;

      // Whether the pair are already connected is a fact the decision needs,
      // so it is read before deciding rather than checked afterwards. With no
      // creator there is no pair to look up and the decision refuses anyway.
      const existingPair = invite.createdBy
        ? await getDoc(doc(db, 'friendships', friendshipId(userId, invite.createdBy)))
        : null;

      // The rules of redemption are shared with mobile. Only the reads and
      // writes differ between the two SDKs; which codes are acceptable must
      // not.
      const decision = decideRedemption({
        rawCode,
        userId,
        invite: {
          exists: snap.exists(),
          createdBy: invite.createdBy,
          status: invite.status,
          expiresAtMs: expiresAt?.toDate ? expiresAt.toDate().getTime() : undefined,
        },
        alreadyFriends: Boolean(existingPair?.exists()),
        nowMs: Date.now(),
      });

      if (!decision.ok) return { ok: false, failure: decision.failure };

      try {
        await updateDoc(inviteRef, {
          status: 'accepted',
          acceptedBy: userId,
          acceptedAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'friendships', decision.pairId), {
          friendshipId: decision.pairId,
          users: [userId, decision.friendUid].sort(),
          initiatedBy: decision.friendUid,
          viaInviteCode: decision.code,
          createdAt: serverTimestamp(),
        });

        return { ok: true, friendUid: decision.friendUid };
      } catch (err) {
        console.error('[useFriends] redeem failed:', err);
        return { ok: false, failure: 'write-failed' };
      }
    },
    [userId],
  );

  return { friends, loading, error, createInvite, redeemInvite };
}

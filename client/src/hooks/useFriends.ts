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
  friendshipId,
  generateInviteCode,
  normaliseInviteCode,
  isValidInviteCode,
  INVITE_TTL_DAYS,
  type FriendshipDocument,
} from '@driiva/contracts';

export interface Friend {
  uid: string;
  friendshipId: string;
  since: Date | null;
}

/** Why a redemption failed, in terms the UI can turn into honest copy. */
export type RedeemFailure =
  | 'invalid-code'
  | 'not-found'
  | 'expired'
  | 'already-used'
  | 'own-code'
  | 'already-friends'
  | 'write-failed';

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
      if (!isValidInviteCode(rawCode)) {
        return { ok: false, failure: 'invalid-code' };
      }

      const code = normaliseInviteCode(rawCode);
      const inviteRef = doc(db, 'invites', code);
      const snap = await getDoc(inviteRef);

      if (!snap.exists()) return { ok: false, failure: 'not-found' };

      const invite = snap.data();
      if (invite.createdBy === userId) return { ok: false, failure: 'own-code' };
      if (invite.status !== 'pending') return { ok: false, failure: 'already-used' };

      const expiresAt = invite.expiresAt as Timestamp | undefined;
      if (expiresAt?.toDate && expiresAt.toDate().getTime() < Date.now()) {
        return { ok: false, failure: 'expired' };
      }

      const pairId = friendshipId(userId, invite.createdBy);
      const pairRef = doc(db, 'friendships', pairId);
      const alreadyFriends = await getDoc(pairRef);
      if (alreadyFriends.exists()) return { ok: false, failure: 'already-friends' };

      try {
        await updateDoc(inviteRef, {
          status: 'accepted',
          acceptedBy: userId,
          acceptedAt: serverTimestamp(),
        });

        await setDoc(pairRef, {
          friendshipId: pairId,
          users: [userId, invite.createdBy].sort(),
          initiatedBy: invite.createdBy,
          viaInviteCode: code,
          createdAt: serverTimestamp(),
        });

        return { ok: true, friendUid: invite.createdBy };
      } catch (err) {
        console.error('[useFriends] redeem failed:', err);
        return { ok: false, failure: 'write-failed' };
      }
    },
    [userId],
  );

  return { friends, loading, error, createInvite, redeemInvite };
}

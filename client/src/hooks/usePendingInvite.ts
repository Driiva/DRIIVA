/**
 * PENDING INVITE
 * ==============
 * Carries an invite code across account creation.
 *
 * A friendship needs two real uids, so an invited person who does not have an
 * account yet cannot redeem on arrival: /invite/:code sends them to sign up
 * first. Without this hook the code died at that redirect, the account got
 * created, and the friendship silently never formed. The invite link appeared
 * to work and produced nothing, which is the worst kind of failure because
 * neither person sees an error.
 *
 * sessionStorage rather than the query string: the code has to survive sign-up,
 * email verification and onboarding, which is several navigations and at least
 * one full reload.
 */
import { useEffect, useRef } from 'react';
import { useFriends } from './useFriends';

export const PENDING_INVITE_KEY = 'driiva-pending-invite';

export function stashPendingInvite(code: string) {
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, code);
  } catch {
    // Private browsing with storage disabled. The invite is lost, but the
    // sign-up itself must not be.
  }
}

export function readPendingInvite(): string | null {
  try {
    return sessionStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Redeems a stashed invite once there is a signed-in user, exactly once.
 * Mount once, high in the tree.
 */
export function usePendingInvite(userId: string | null) {
  const { redeemInvite } = useFriends(userId);
  const attempted = useRef(false);

  useEffect(() => {
    if (!userId || attempted.current) return;

    const code = readPendingInvite();
    if (!code) return;

    attempted.current = true;

    (async () => {
      const result = await redeemInvite(code);
      // Cleared on success, and on every terminal failure. A code that cannot
      // be redeemed (expired, already used, their own) would otherwise be
      // retried on every session for the life of the browser tab.
      if (result.ok || result.failure !== 'write-failed') {
        clearPendingInvite();
      }
      if (!result.ok) {
        console.warn('[usePendingInvite] invite not redeemed:', result.failure);
      }
    })();
  }, [userId, redeemInvite]);
}

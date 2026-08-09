/**
 * INVITE LANDING (/invite/:code)
 * ==============================
 * Where a shared invite link lands.
 *
 * A signed-out visitor is sent to sign up with the code carried through, so
 * the invite survives account creation. Redeeming happens only once there is
 * an authenticated user to attach the friendship to, because a friendship
 * needs two real uids.
 */
import { useEffect, useState } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { UserPlus, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends, type RedeemFailure } from '@/hooks/useFriends';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageWrapper } from '@/components/PageWrapper';
import { isValidInviteCode, normaliseInviteCode, INVITE_TTL_DAYS } from '@driiva/contracts';
import { stashPendingInvite } from '@/hooks/usePendingInvite';

const FAILURE_COPY: Record<RedeemFailure, string> = {
  'invalid-code': 'That link does not carry a valid invite code.',
  'not-found': 'No invite matches this code. Ask for a fresh link.',
  expired: `This invite has expired. Invites last ${INVITE_TTL_DAYS} days.`,
  'already-used': 'This invite has already been used.',
  'own-code': 'This is your own invite. Share the link with someone else.',
  'already-friends': 'You are already friends with them.',
  'write-failed': 'The invite could not be accepted. Check your connection and try again.',
};

export default function InvitePage() {
  const [, params] = useRoute('/invite/:code');
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { redeemInvite } = useFriends(user?.id ?? null);

  const rawCode = params?.code ?? '';
  const code = normaliseInviteCode(rawCode);

  const [state, setState] = useState<'checking' | 'done' | 'failed'>('checking');
  const [failure, setFailure] = useState<RedeemFailure | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isValidInviteCode(code)) {
      setFailure('invalid-code');
      setState('failed');
      return;
    }

    // Carry the code through sign-up so it survives account creation. The
    // query string is for legibility; sessionStorage is what actually
    // survives the reloads between here and a signed-in user.
    if (!user) {
      stashPendingInvite(code);
      setLocation(`/signup?invite=${encodeURIComponent(code)}`);
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await redeemInvite(code);
      if (cancelled) return;
      if (result.ok) {
        setState('done');
      } else {
        setFailure(result.failure ?? 'write-failed');
        setState('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, code, redeemInvite, setLocation]);

  return (
    <PageWrapper>
      <div className="pt-10">
        {state === 'checking' && (
          <EmptyState
            icon={<UserPlus size={24} strokeWidth={2} />}
            heading="Checking your invite"
            subtext="One moment."
          />
        )}

        {state === 'done' && (
          <EmptyState
            icon={<Check size={24} strokeWidth={2} />}
            heading="You are now friends"
            subtext="They will appear on your friends leaderboard as soon as you have both completed a scored trip this period."
            action={
              <Link href="/leaderboard">
                <button
                  className="px-5 py-2.5 text-[14px]"
                  style={{
                    borderRadius: 'var(--radius-button)',
                    background: 'var(--app-primary)',
                    color: 'var(--app-text-hero)',
                  }}
                >
                  See the leaderboard
                </button>
              </Link>
            }
          />
        )}

        {state === 'failed' && (
          <EmptyState
            icon={<UserPlus size={24} strokeWidth={2} />}
            heading="This invite could not be used"
            subtext={FAILURE_COPY[failure ?? 'write-failed']}
            action={
              <Link href="/leaderboard">
                <button
                  className="px-5 py-2.5 text-[14px]"
                  style={{
                    borderRadius: 'var(--radius-button)',
                    background: 'var(--app-surface-2)',
                    color: 'var(--app-text-pri)',
                  }}
                >
                  Go to the leaderboard
                </button>
              </Link>
            }
          />
        )}
      </div>
    </PageWrapper>
  );
}

/**
 * INVITE SHEET
 * ============
 * The two halves of the social graph in one surface: share a code, or redeem
 * one you were given.
 *
 * Sharing prefers the native share sheet where the browser has one, and falls
 * back to clipboard. Both are behind a user gesture because neither works
 * otherwise.
 *
 * Every failure path says what actually happened. "Something went wrong" for a
 * code that is simply expired teaches people to retype a code that will never
 * work.
 */
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Copy, Check, Share2, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends, type RedeemFailure } from '@/hooks/useFriends';
import { FixedLayer } from '@/components/motion/FixedLayer';
import { INVITE_TTL_DAYS } from '@driiva/contracts';

const FAILURE_COPY: Record<RedeemFailure, string> = {
  'invalid-code': 'That code is not the right shape. Codes are 8 characters.',
  'not-found': 'No invite matches that code. Check it and try again.',
  expired: `That invite has expired. Invites last ${INVITE_TTL_DAYS} days, so ask for a fresh one.`,
  'already-used': 'That invite has already been used.',
  'own-code': 'That is your own invite code. Share it with someone else.',
  'already-friends': 'You are already friends.',
  'write-failed': 'The invite could not be accepted. Check your connection and try again.',
};

export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { createInvite, redeemInvite } = useFriends(user?.id ?? null);
  const reduce = useReducedMotion();

  const [code, setCode] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [entry, setEntry] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const inviteUrl = code ? `${window.location.origin}/invite/${code}` : '';

  async function handleCreate() {
    setMinting(true);
    setMessage(null);
    const next = await createInvite();
    setMinting(false);
    if (next) setCode(next);
    else setMessage({ ok: false, text: 'Could not create an invite. Try again in a moment.' });
  }

  async function handleShare() {
    if (!code) return;
    const text = `Join me on Driiva. Use invite code ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Driiva invite', text, url: inviteUrl });
        return;
      } catch {
        // The user dismissed the sheet. Fall through to clipboard rather than
        // reporting a failure they caused deliberately.
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ ok: false, text: 'Could not copy the link. Select the code and copy it.' });
    }
  }

  async function handleRedeem() {
    setRedeeming(true);
    setMessage(null);
    const result = await redeemInvite(entry);
    setRedeeming(false);
    if (result.ok) {
      setEntry('');
      setMessage({ ok: true, text: 'You are now friends. They will appear on your friends board.' });
    } else {
      setMessage({ ok: false, text: FAILURE_COPY[result.failure ?? 'write-failed'] });
    }
  }

  return (
    <FixedLayer>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={onClose}
              className="fixed inset-0 z-[60]"
              style={{ background: 'rgba(0, 0, 0, 0.6)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Invite a friend"
              initial={reduce ? { opacity: 0 } : { y: '100%' }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: '100%' }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-0 right-0 bottom-0 z-[61] max-h-[90vh] overflow-y-auto"
              style={{
                background: 'var(--app-surface-1)',
                borderTop: '1px solid var(--app-border)',
                borderTopLeftRadius: 'var(--radius-xl)',
                borderTopRightRadius: 'var(--radius-xl)',
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
              }}
            >
              <div className="max-w-md mx-auto px-5 pt-5">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-[18px]" style={{ color: 'var(--app-text-hero)' }}>
                      Friends
                    </h2>
                    <p className="text-[13px] mt-0.5" style={{ color: 'var(--app-text-sec)' }}>
                      Share a code, or enter one you were given.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center shrink-0"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--app-surface-2)',
                    }}
                  >
                    <X size={18} style={{ color: 'var(--app-text-pri)' }} />
                  </button>
                </div>

                {/* Share half */}
                <section className="mb-6">
                  <span className="stat-label">Your invite</span>
                  {code ? (
                    <div className="mt-2">
                      <div
                        className="flex items-center justify-between px-4 py-3"
                        style={{
                          borderRadius: 'var(--radius-card)',
                          background: 'var(--app-surface-2)',
                          border: '1px solid var(--app-border)',
                        }}
                      >
                        <span
                          className="font-mono text-[20px] tracking-[0.18em]"
                          style={{ color: 'var(--app-text-hero)' }}
                        >
                          {code}
                        </span>
                        <button
                          onClick={handleShare}
                          className="inline-flex items-center gap-2 px-3 py-2 text-[14px]"
                          style={{
                            borderRadius: 'var(--radius-button)',
                            background: 'var(--app-primary)',
                            color: 'var(--app-text-hero)',
                          }}
                        >
                          {copied ? <Check size={16} /> : <Share2 size={16} />}
                          {copied ? 'Copied' : 'Share'}
                        </button>
                      </div>
                      <p className="text-[13px] mt-2" style={{ color: 'var(--app-text-sec)' }}>
                        Valid for {INVITE_TTL_DAYS} days. One person can use it.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleCreate}
                      disabled={minting}
                      className="mt-2 w-full inline-flex items-center justify-center gap-2 py-3 text-[15px] disabled:opacity-60"
                      style={{
                        borderRadius: 'var(--radius-button)',
                        background: 'var(--app-primary)',
                        color: 'var(--app-text-hero)',
                      }}
                    >
                      <UserPlus size={18} />
                      {minting ? 'Creating' : 'Create an invite code'}
                    </button>
                  )}
                </section>

                {/* Redeem half */}
                <section className="mb-4">
                  <label htmlFor="invite-code" className="stat-label">
                    Enter a code
                  </label>
                  <div className="flex gap-2 mt-2">
                    <input
                      id="invite-code"
                      value={entry}
                      onChange={(e) => setEntry(e.target.value.toUpperCase())}
                      placeholder="ABCD2345"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={12}
                      className="flex-1 px-4 py-3 font-mono text-[16px] tracking-[0.14em] outline-none"
                      style={{
                        borderRadius: 'var(--radius-card)',
                        background: 'var(--app-surface-2)',
                        border: '1px solid var(--app-border)',
                        color: 'var(--app-text-hero)',
                      }}
                    />
                    <button
                      onClick={handleRedeem}
                      disabled={redeeming || entry.length === 0}
                      className="px-5 text-[15px] disabled:opacity-40"
                      style={{
                        borderRadius: 'var(--radius-button)',
                        background: 'var(--app-surface-3)',
                        color: 'var(--app-text-pri)',
                      }}
                    >
                      {redeeming ? 'Checking' : 'Join'}
                    </button>
                  </div>
                </section>

                {message && (
                  <p
                    role="status"
                    className="text-[14px] mb-4 px-3 py-2"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      color: message.ok ? 'var(--ok)' : 'var(--err)',
                      background: message.ok
                        ? 'rgba(16, 185, 129, 0.10)'
                        : 'rgba(239, 68, 68, 0.10)',
                    }}
                  >
                    {message.text}
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </FixedLayer>
  );
}

export default InviteSheet;

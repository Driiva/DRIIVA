/**
 * The waitlist form, once.
 *
 * The hero and the final CTA are the same form with a different source tag, and
 * they were the same sixty lines copied into two files. They had already
 * drifted twice: an em dash survived in one and not the other, and the
 * accessibility fix (aria-invalid, aria-describedby, focus on failure, and
 * retracting the error when the address is edited) had to be written into both
 * by hand, which is precisely the point at which two copies become one bug.
 *
 * The aria wiring is returned as prop bundles rather than as loose values, so a
 * caller cannot wire the field to the message incorrectly, or forget to.
 */
import { useRef, useState, type FormEvent } from 'react';

import { animate, prefersReducedMotion } from '@/lib/motion';
import { joinWaitlist } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

export type WaitlistStatus = 'idle' | 'submitting' | 'success' | 'error';

/** One wording for a bad address, so the two forms cannot disagree about it. */
const INVALID_EMAIL = "That email doesn't look right. Give it another go.";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

interface Options {
  /** Analytics tag, and the only thing that actually differs between callers. */
  source: 'hero' | 'final-cta';
  /**
   * The id the status region carries and the field points at. Both forms render
   * on the same page, so two elements cannot share one id and still have
   * aria-describedby resolve.
   */
  statusId: string;
}

export function useWaitlistForm({ source, statusId }: Options) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<WaitlistStatus>('idle');
  const [message, setMessage] = useState('');

  const locked = status === 'submitting' || status === 'success';

  function fail(text: string) {
    setStatus('error');
    setMessage(text);
    // Put the caret back where the problem is, rather than leaving focus on the
    // body for the reader to hunt the field down again.
    inputRef.current?.focus();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');

    if (!isValidEmail(email)) {
      fail(INVALID_EMAIL);
      return;
    }

    setStatus('submitting');
    const result = await joinWaitlist(email, source);

    if (!result.ok) {
      trackEvent('waitlist_error', { source, error: result.error ?? 'unknown' });
      fail(
        result.error === 'invalid_email'
          ? INVALID_EMAIL
          : 'Something broke on our end. Try again in a moment?',
      );
      return;
    }

    trackEvent('waitlist_success', { source, already_on_list: result.alreadyOnList === true });
    setStatus('success');
    setMessage(
      result.alreadyOnList
        ? result.position
          ? `Already on the list. You're #${result.position}.`
          : 'Already on the list.'
        : result.position
        ? `You're #${result.position}. We'll email when the beta opens.`
        : "You're on the list. We'll email when the beta opens.",
    );
    setEmail('');

    const btn = buttonRef.current;
    if (btn && !prefersReducedMotion()) {
      animate(btn, { scale: [1, 1.04, 1], duration: 380, ease: 'cubicBezier(0.22, 1, 0.36, 1)' });
    }
  }

  // Refs are handed back separately rather than folded into the bundles below:
  // this is React 18, where ref is not an ordinary prop and does not survive a
  // spread.
  return {
    status,
    message,
    inputRef,
    buttonRef,
    handleSubmit,

    inputProps: {
      type: 'email' as const,
      inputMode: 'email' as const,
      autoComplete: 'email',
      required: true,
      'aria-label': 'Email address',
      'aria-invalid': status === 'error' || undefined,
      'aria-describedby': statusId,
      placeholder: 'your@email.co.uk',
      value: email,
      disabled: locked,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        // Editing after a rejection retracts the rejection. Holding it until
        // the next submit tells someone who has already fixed their address
        // that they have not.
        if (status === 'error') {
          setStatus('idle');
          setMessage('');
        }
      },
    },

    buttonProps: {
      type: 'submit' as const,
      disabled: locked,
    },

    buttonLabel:
      status === 'submitting' ? 'Adding you' : status === 'success' ? "You're in" : 'Get early access',

    statusProps: {
      id: statusId,
      className: `form-status ${status === 'error' ? 'err' : status === 'success' ? 'ok' : ''}`,
      role: 'status' as const,
      'aria-live': 'polite' as const,
    },
  };
}

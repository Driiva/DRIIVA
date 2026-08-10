import { useRef, useState, type FormEvent } from 'react';
import { useReveal } from '@/hooks/useReveal';
import { animate, prefersReducedMotion } from '@/lib/motion';
import { joinWaitlist } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { useWaitlistCount } from '@/hooks/useWaitlistCount';

type Status = 'idle' | 'submitting' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Distinct from the hero's: this page renders both forms, and two elements
// cannot share an id that aria-describedby has to resolve.
const STATUS_ID = 'cta-waitlist-status';

export function FinalCTA() {
  const ref = useReveal<HTMLElement>();
  const waitlistCount = useWaitlistCount();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    if (!isValidEmail(email)) {
      setStatus('error');
      setMessage("That email doesn't look right. Give it another go.");
      // Put the caret back where the problem is, rather than leaving focus on
      // the body for the reader to hunt the field down again.
      inputRef.current?.focus();
      return;
    }
    setStatus('submitting');
    const result = await joinWaitlist(email, 'final-cta');
    if (!result.ok) {
      trackEvent('waitlist_error', { source: 'final-cta', error: result.error ?? 'unknown' });
      setStatus('error');
      setMessage(
        result.error === 'invalid_email'
          ? "That email doesn't look right. Give it another go."
          : 'Something broke on our end. Try again in a moment?',
      );
      inputRef.current?.focus();
      return;
    }
    trackEvent('waitlist_success', {
      source: 'final-cta',
      already_on_list: result.alreadyOnList === true,
    });
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
      animate(btn, {
        scale: [1, 1.04, 1],
        duration: 380,
        ease: 'cubicBezier(0.22, 1, 0.36, 1)',
      });
    }
  }

  return (
    <section ref={ref} id="cta-final" data-section="cta-final" className="cta-final">
      <div className="container">
        <div className="reveal-init">
          <h2>Ready to get paid for driving safely? Sign up now - early access is limited.</h2>
          <p>
            {waitlistCount === null
              ? 'Join the waitlist for the first refund-first motor insurance that means it.'
              : `Join the ${waitlistCount.toLocaleString('en-GB')} UK drivers on the waitlist for the first refund-first motor insurance that means it.`}
          </p>
          <form onSubmit={handleSubmit} noValidate className="waitlist-form" data-testid="cta-form">
            <input
              ref={inputRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              aria-label="Email address"
              aria-invalid={status === 'error' || undefined}
              aria-describedby={STATUS_ID}
              placeholder="your@email.co.uk"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Editing after a rejection retracts the rejection.
                if (status === 'error') {
                  setStatus('idle');
                  setMessage('');
                }
              }}
              disabled={status === 'submitting' || status === 'success'}
            />
            <button
              ref={buttonRef}
              type="submit"
              disabled={status === 'submitting' || status === 'success'}
            >
              {status === 'submitting'
                ? 'Adding you'
                : status === 'success'
                ? "You're in"
                : 'Get early access'}
            </button>
          </form>
          <div
            id={STATUS_ID}
            className={`form-status ${status === 'error' ? 'err' : status === 'success' ? 'ok' : ''}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        </div>
      </div>
    </section>
  );
}

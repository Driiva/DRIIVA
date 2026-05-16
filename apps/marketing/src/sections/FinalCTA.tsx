import { useRef, useState, type FormEvent } from 'react';
import { useReveal } from '@/hooks/useReveal';
import { animate, prefersReducedMotion } from '@/lib/motion';

type Status = 'idle' | 'submitting' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function FinalCTA() {
  const ref = useReveal<HTMLElement>();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [spotsLeft, setSpotsLeft] = useState(383);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    if (!isValidEmail(email)) {
      setStatus('error');
      setMessage("That email doesn't look right. Give it another go.");
      return;
    }
    setStatus('submitting');
    window.setTimeout(() => {
      setStatus('success');
      setMessage("You're on the list. We'll be in touch soon.");
      setEmail('');
      setSpotsLeft((n) => Math.max(n - 1, 1));
      const btn = buttonRef.current;
      if (btn && !prefersReducedMotion()) {
        animate(btn, {
          scale: [1, 1.04, 1],
          duration: 380,
          ease: 'cubicBezier(0.22, 1, 0.36, 1)',
        });
      }
    }, 800);
  }

  return (
    <section ref={ref} id="cta-final" data-section="cta-final">
      <div className="container">
        <div className="cta-final reveal-init">
          <h2>
            Contribute to ethical insurance
            <br />
            in just 30 seconds.
          </h2>
          <p className="sub">Drop your email. We'll reach out when your beta slot opens.</p>
          <form onSubmit={handleSubmit} noValidate className="waitlist-form" data-testid="cta-form">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              aria-label="Email address"
              placeholder="your@email.co.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'submitting' || status === 'success'}
            />
            <button
              ref={buttonRef}
              type="submit"
              disabled={status === 'submitting' || status === 'success'}
            >
              {status === 'submitting'
                ? 'Adding you…'
                : status === 'success'
                ? "You're in"
                : 'Get Early Access'}
            </button>
          </form>
          <div
            className={`form-status${message ? ' visible' : ''}${status === 'error' ? ' error' : ''}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
          <div className="cta-spots">
            500 beta spots · <span data-testid="spots-left">{spotsLeft}</span> remaining
          </div>
          <div className="cta-compliance">
            Early Refund Guarantee applies to beta participants only, subject to eligibility criteria and
            caps. Not a guaranteed profit scheme. Driiva Ltd is working toward FCA authorisation.
          </div>
        </div>
      </div>
    </section>
  );
}

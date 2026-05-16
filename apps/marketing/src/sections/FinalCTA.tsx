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
      setMessage("You're on the list. We'll email when the beta opens.");
      setEmail('');
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
    <section ref={ref} id="cta-final" data-section="cta-final" className="cta-final">
      <div className="container">
        <div className="reveal-init">
          <h2>
            Ready to drive well, <span className="accent">and get money back?</span>
          </h2>
          <p>
            Join the 117 UK drivers on the waitlist for the first refund-first motor insurance that means
            it.
          </p>
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
                ? 'Adding you'
                : status === 'success'
                ? "You're in"
                : 'Get Early Access'}
            </button>
          </form>
          <div
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

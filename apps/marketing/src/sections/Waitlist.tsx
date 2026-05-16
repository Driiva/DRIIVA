import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useInView } from '@/hooks/useInView';
import { animate, prefersReducedMotion } from '@/lib/motion';

type Status = 'idle' | 'submitting' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function Waitlist() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2, once: true });
  const cardRef = useRef<HTMLFormElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inView) return;
    const card = cardRef.current;
    if (!card) return;
    animate(card, {
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 700,
      ease: 'cubicBezier(0.22, 1, 0.36, 1)',
    });
  }, [inView]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setStatus('submitting');
    // No real endpoint yet, simulate then show success.
    window.setTimeout(() => {
      setStatus('success');
      const btn = buttonRef.current;
      if (!btn) return;
      if (prefersReducedMotion()) {
        btn.style.opacity = '1';
        return;
      }
      animate(btn, {
        scale: [1, 1.04, 1],
        duration: 360,
        ease: 'cubicBezier(0.22, 1, 0.36, 1)',
      });
    }, 600);
  }

  return (
    <section
      ref={ref}
      data-section="waitlist"
      id="waitlist"
      className="relative mx-auto w-full max-w-3xl px-6 py-32 text-center"
    >
      <p className="eyebrow mb-6">The waitlist</p>
      <h2 className="display-2 mb-6">Be first in line.</h2>
      <p className="lede mx-auto mb-12">
        We are onboarding the first cohort of UK drivers this year. Leave an email and we will reach out as policies open.
      </p>

      <form
        ref={cardRef}
        onSubmit={handleSubmit}
        noValidate
        className="glass mx-auto flex w-full max-w-xl flex-col items-stretch gap-3 rounded-xl p-3 sm:flex-row"
        style={{ opacity: 0 }}
        data-testid="waitlist-form"
      >
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'submitting' || status === 'success'}
          className="min-w-0 flex-1 rounded bg-transparent px-4 py-3 text-base text-text-1 placeholder:text-text-3 focus:outline-none"
        />
        <button
          ref={buttonRef}
          type="submit"
          disabled={status === 'submitting' || status === 'success'}
          className="ghost-cta justify-center"
          data-testid="waitlist-submit"
          aria-live="polite"
        >
          {status === 'idle' && <span>request access</span>}
          {status === 'submitting' && <span className="mono text-text-2">sending</span>}
          {status === 'success' && (
            <span className="flex items-center gap-2 text-ok">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6L9 17L4 12" />
              </svg>
              you are in
            </span>
          )}
          {status === 'error' && <span className="text-err">try again</span>}
        </button>
      </form>

      {error && (
        <p className="mono mt-4 text-sm text-err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

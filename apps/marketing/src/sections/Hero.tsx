import { useEffect, useRef, useState, type FormEvent } from 'react';
import { animate, createTimeline, prefersReducedMotion } from '@/lib/motion';

type Status = 'idle' | 'submitting' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function Hero() {
  const eyebrowRef = useRef<HTMLParagraphElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const wordmarkRef = useRef<HTMLDivElement | null>(null);
  const ghostsRef = useRef<HTMLDivElement | null>(null);
  const subRef = useRef<HTMLParagraphElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const guaranteeRef = useRef<HTMLDivElement | null>(null);
  const formRevealedRef = useRef(false);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // Hero entrance: anime.js timeline that lands the eyebrow, headline and wordmark.
  // The form + guarantee start hidden and only enter when the user begins to scroll,
  // giving the page its initial visual focus on the wordmark.
  useEffect(() => {
    const eyebrow = eyebrowRef.current;
    const headline = headlineRef.current;
    const wordmark = wordmarkRef.current;
    const ghosts = ghostsRef.current;
    if (!eyebrow || !headline || !wordmark || !ghosts) return;

    if (prefersReducedMotion()) {
      for (const el of [eyebrow, headline, wordmark, formRef.current, guaranteeRef.current]) {
        if (el) {
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
      }
      // Reveal ghosts immediately too
      const ghostEls = Array.from(ghosts.querySelectorAll<HTMLImageElement>('.wm-ghost'));
      for (const g of ghostEls) g.style.opacity = '';
      return;
    }

    // Stage 1: the headline + wordmark land first
    const tl = createTimeline({ defaults: { ease: 'cubicBezier(0.16, 1, 0.3, 1)', duration: 900 } });
    tl.add(eyebrow, { opacity: [0, 1], translateY: [24, 0], duration: 700 })
      .add(headline, { opacity: [0, 1], translateY: [28, 0] }, '-=500')
      .add(
        wordmark,
        { opacity: [0, 1], translateY: [36, 0], scale: [0.94, 1], duration: 1100 },
        '-=600',
      );

    // Stage 2: the motion-blur ghost trail fades in slightly after the main wordmark
    const ghostEls = Array.from(ghosts.querySelectorAll<HTMLImageElement>('.wm-ghost'));
    for (const g of ghostEls) g.style.opacity = '0';
    animate(ghostEls, {
      opacity: (el: HTMLElement) => {
        if (el.classList.contains('wm-g1')) return [0, 0.55];
        if (el.classList.contains('wm-g2')) return [0, 0.38];
        if (el.classList.contains('wm-g3')) return [0, 0.22];
        return [0, 0.12];
      },
      translateX: (el: HTMLElement) => {
        if (el.classList.contains('wm-g1')) return [0, -5];
        if (el.classList.contains('wm-g2')) return [0, -12];
        if (el.classList.contains('wm-g3')) return [0, -22];
        return [0, -36];
      },
      delay: (_: unknown, i: number) => 700 + i * 90,
      duration: 1200,
      ease: 'cubicBezier(0.16, 1, 0.3, 1)',
    } as never);
  }, []);

  // Scroll-triggered reveal of the form + guarantee. Fires the moment the user
  // begins to scroll. Real anime.js, not a CSS class swap.
  useEffect(() => {
    function revealFormStack() {
      if (formRevealedRef.current) return;
      const form = formRef.current;
      const sub = subRef.current;
      const guarantee = guaranteeRef.current;
      if (!form && !sub && !guarantee) return;
      formRevealedRef.current = true;
      const targets: Element[] = [];
      if (sub) targets.push(sub);
      if (form) targets.push(form);
      if (guarantee) targets.push(guarantee);
      if (prefersReducedMotion()) {
        for (const el of targets) {
          if (el instanceof HTMLElement) {
            el.style.opacity = '1';
            el.style.transform = 'none';
          }
        }
        return;
      }
      animate(targets, {
        opacity: [0, 1],
        translateY: [44, 0],
        duration: 900,
        ease: 'cubicBezier(0.16, 1, 0.3, 1)',
        delay: (_: unknown, i: number) => i * 120,
      } as never);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onScroll);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('keydown', onKey);
    }

    function onScroll() {
      revealFormStack();
    }
    function onKey(e: KeyboardEvent) {
      if (
        e.key === 'PageDown' ||
        e.key === 'ArrowDown' ||
        e.key === ' ' ||
        e.key === 'End'
      ) {
        revealFormStack();
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);

    // Fallback so the form is reachable for people who never scroll
    const fallback = window.setTimeout(revealFormStack, 4200);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onScroll);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(fallback);
    };
  }, []);

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
    <header className="hero" data-section="hero">
      <div className="container">
        <p ref={eyebrowRef} className="hero-eyebrow-line" style={{ opacity: 0 }}>
          Insurance, simplified.
        </p>
        <h1 ref={headlineRef} className="hero-headline" style={{ opacity: 0 }}>
          AI-Powered. <span className="italic">Community-driven.</span>
        </h1>

        <div
          ref={wordmarkRef}
          className="hero-wordmark"
          style={{ opacity: 0 }}
          data-testid="hero-wordmark"
        >
          <div ref={ghostsRef}>
            <img className="wm-ghost wm-g4" src="/brand/logo-wordmark-white-v3.png" alt="" />
            <img className="wm-ghost wm-g3" src="/brand/logo-wordmark-white-v3.png" alt="" />
            <img className="wm-ghost wm-g2" src="/brand/logo-wordmark-white-v3.png" alt="" />
            <img className="wm-ghost wm-g1" src="/brand/logo-wordmark-white-v3.png" alt="" />
          </div>
          <img className="wm-main" src="/brand/logo-wordmark-white-v3.png" alt="driiva" />
        </div>

        <p ref={subRef} className="hero-sub" style={{ opacity: 0 }}>
          Ready for insurance that rewards you?
          <br />
          Enter your email for early access.
        </p>

        <form
          ref={formRef}
          className="waitlist-form"
          onSubmit={handleSubmit}
          noValidate
          style={{ opacity: 0 }}
          data-testid="hero-form"
        >
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
            {status === 'submitting' ? 'Adding you' : status === 'success' ? "You're in" : 'Get Early Access'}
          </button>
        </form>
        <div
          className={`form-status ${status === 'error' ? 'err' : status === 'success' ? 'ok' : ''}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </div>

        <div ref={guaranteeRef} className="hero-guarantee" style={{ opacity: 0 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.3 0 4.4.86 6 2.28" />
          </svg>
          Early Refund Guarantee. If our models don't deliver, we refund early.
        </div>
      </div>
    </header>
  );
}

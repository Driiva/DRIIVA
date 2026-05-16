import { useEffect, useRef, useState, type FormEvent } from 'react';
import { animate, createTimeline, prefersReducedMotion } from '@/lib/motion';

type Status = 'idle' | 'submitting' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function Hero() {
  const eyebrowRef = useRef<HTMLParagraphElement | null>(null);
  const wordmarkRef = useRef<HTMLDivElement | null>(null);
  const ghostsRef = useRef<HTMLDivElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const subRef = useRef<HTMLParagraphElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const guaranteeRef = useRef<HTMLDivElement | null>(null);
  const formRevealedRef = useRef(false);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // Cinematic hero entrance with anime.js. Order matches the canonical
  // composition: eyebrow first, then the wordmark scales and fades in
  // as the anchor, then the headline lands tightly underneath, then
  // the subhead. The form + guarantee stay hidden until the user
  // begins to scroll, so the wordmark gets a moment to breathe.
  useEffect(() => {
    const eyebrow = eyebrowRef.current;
    const wordmark = wordmarkRef.current;
    const ghosts = ghostsRef.current;
    const headline = headlineRef.current;
    if (!eyebrow || !wordmark || !ghosts || !headline) return;

    if (prefersReducedMotion()) {
      for (const el of [eyebrow, wordmark, headline, subRef.current, formRef.current, guaranteeRef.current]) {
        if (el) {
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
      }
      const ghostEls = Array.from(ghosts.querySelectorAll<HTMLImageElement>('.wm-ghost'));
      for (const g of ghostEls) g.style.opacity = '';
      return;
    }

    const tl = createTimeline({ defaults: { ease: 'cubicBezier(0.16, 1, 0.3, 1)', duration: 800 } });
    tl.add(eyebrow, { opacity: [0, 1], translateY: [16, 0] })
      .add(
        wordmark,
        { opacity: [0, 1], translateY: [28, 0], scale: [0.92, 1], duration: 1100 },
        '-=500',
      )
      .add(headline, { opacity: [0, 1], translateY: [22, 0], duration: 850 }, '-=550');

    // Motion-blur ghost trail eases in after the wordmark lands
    const ghostEls = Array.from(ghosts.querySelectorAll<HTMLImageElement>('.wm-ghost'));
    for (const g of ghostEls) g.style.opacity = '0';
    animate(ghostEls, {
      opacity: (el: HTMLElement) => {
        if (el.classList.contains('wm-g1')) return [0, 0.32];
        if (el.classList.contains('wm-g2')) return [0, 0.2];
        if (el.classList.contains('wm-g3')) return [0, 0.11];
        return [0, 0.05];
      },
      duration: 900,
      ease: 'cubicBezier(0.16, 1, 0.3, 1)',
      delay: (_: unknown, i: number) => 1000 + i * 110,
    } as never);
  }, []);

  // Scroll-triggered reveal of the form + sub + guarantee, anime.js driven.
  useEffect(() => {
    function revealFormStack() {
      if (formRevealedRef.current) return;
      const sub = subRef.current;
      const form = formRef.current;
      const guarantee = guaranteeRef.current;
      const targets: Element[] = [];
      if (sub) targets.push(sub);
      if (form) targets.push(form);
      if (guarantee) targets.push(guarantee);
      if (targets.length === 0) return;
      formRevealedRef.current = true;
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
        translateY: [40, 0],
        duration: 900,
        ease: 'cubicBezier(0.16, 1, 0.3, 1)',
        delay: (_: unknown, i: number) => i * 110,
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
      if (e.key === 'PageDown' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'End') {
        revealFormStack();
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    const fallback = window.setTimeout(revealFormStack, 3600);
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
          <span className="trust-chip" data-testid="trust-chip">
            117+ drivers on the waitlist · UK beta launching soon
          </span>
          <br />
          Insurance, simplified.
        </p>

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
          <img
            className="wm-main"
            src="/brand/logo-wordmark-white-v3.png"
            alt="driiva"
            decoding="sync"
            loading="eager"
          />
        </div>

        <h1 ref={headlineRef} className="hero-headline" style={{ opacity: 0 }}>
          AI-Powered. <span className="italic">Community-driven.</span>
        </h1>

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

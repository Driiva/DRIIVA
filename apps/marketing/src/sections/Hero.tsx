import { useEffect, useRef, useState, type FormEvent } from 'react';
import { animate, createTimeline, prefersReducedMotion } from '@/lib/motion';

type Status = 'idle' | 'submitting' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function Hero() {
  const logoRef = useRef<HTMLDivElement | null>(null);
  const eyebrowRef = useRef<HTMLDivElement | null>(null);
  const h1Ref = useRef<HTMLHeadingElement | null>(null);
  const subRef = useRef<HTMLParagraphElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const guaranteeRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const refs = [logoRef, eyebrowRef, h1Ref, subRef, formRef, guaranteeRef];
    const targets: HTMLElement[] = [];
    for (const r of refs) {
      if (r.current) targets.push(r.current);
    }
    if (targets.length === 0) return;
    if (prefersReducedMotion()) {
      for (const el of targets) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
      return;
    }
    const tl = createTimeline({
      defaults: { ease: 'cubicBezier(0.22, 1, 0.36, 1)', duration: 900 },
    });
    tl.add(logoRef.current as Element, {
      opacity: [0, 1],
      translateY: [20, 0],
      scale: [0.95, 1],
      duration: 1000,
    })
      .add(eyebrowRef.current as Element, { opacity: [0, 1], translateY: [20, 0] }, '-=700')
      .add(h1Ref.current as Element, { opacity: [0, 1], translateY: [20, 0] }, '-=750')
      .add(subRef.current as Element, { opacity: [0, 1], translateY: [20, 0] }, '-=750')
      .add(formRef.current as Element, { opacity: [0, 1], translateY: [20, 0] }, '-=750')
      .add(guaranteeRef.current as Element, { opacity: [0, 1], translateY: [20, 0] }, '-=750');
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
      setMessage("You're on the list. We'll be in touch soon.");
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
      <div className="container hero-inner">
        <div ref={logoRef} className="hero-logo" style={{ opacity: 0 }}>
          <img src="/brand/driiva-logo.png" alt="Driiva" />
        </div>
        <div ref={eyebrowRef} className="hero-eyebrow" style={{ opacity: 0 }}>
          <span className="eyebrow">117+ drivers on the waitlist · UK beta launching soon</span>
        </div>
        <h1 ref={h1Ref} style={{ opacity: 0 }}>
          Drive well. <span className="accent-gradient">Get money back.</span>
        </h1>
        <p ref={subRef} className="hero-sub" style={{ opacity: 0 }}>
          Join 500 early drivers testing AI-powered telematics insurance that rewards safe driving with
          real cash refunds, not points, not vouchers.
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
            {status === 'submitting' ? 'Adding you…' : status === 'success' ? "You're in" : 'Claim a beta spot'}
          </button>
        </form>
        <div
          className={`form-status${message ? ' visible' : ''}${status === 'error' ? ' error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
        <div ref={guaranteeRef} className="hero-guarantee" style={{ opacity: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
          </svg>
          Early Refund Guarantee: if our models don't deliver, we refund early.
        </div>
      </div>
    </header>
  );
}

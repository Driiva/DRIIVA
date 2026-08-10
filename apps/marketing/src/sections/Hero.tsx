import { useEffect, useRef } from 'react';
import { animate, createTimeline, prefersReducedMotion } from '@/lib/motion';
import { useWaitlistForm } from '@/hooks/useWaitlistForm';
import { PhoneFrame } from './PhoneFrame';

// The status region doubles as the field's description, so it needs a stable
// id to point aria-describedby at. Unique per form: this page renders two.
const STATUS_ID = 'hero-waitlist-status';

export function Hero() {
  const eyebrowRef = useRef<HTMLParagraphElement | null>(null);
  const wordmarkRef = useRef<HTMLDivElement | null>(null);
  const ghostsRef = useRef<HTMLDivElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const subRef = useRef<HTMLParagraphElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const guaranteeRef = useRef<HTMLDivElement | null>(null);

  const {
    message, inputRef, buttonRef, handleSubmit, inputProps, buttonProps, buttonLabel, statusProps,
  } = useWaitlistForm({ source: 'hero', statusId: STATUS_ID });

  // Hero entrance: live strip → eyebrow → wordmark → headline → form stack.
  // The phone frame self-reveals via its own IntersectionObserver, on a
  // parallel track so the right column lands at roughly the same moment
  // as the wordmark settles.
  useEffect(() => {
    const eyebrow = eyebrowRef.current;
    const wordmark = wordmarkRef.current;
    const ghosts = ghostsRef.current;
    const headline = headlineRef.current;
    const sub = subRef.current;
    const form = formRef.current;
    const guarantee = guaranteeRef.current;
    if (!eyebrow || !wordmark || !ghosts || !headline) return;

    if (prefersReducedMotion()) {
      for (const el of [eyebrow, wordmark, headline, sub, form, guarantee]) {
        if (el) {
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
      }
      const ghostEls = Array.from(ghosts.querySelectorAll<HTMLImageElement>('.wm-ghost'));
      for (const g of ghostEls) g.style.opacity = '';
      return;
    }

    const tl = createTimeline({ defaults: { ease: 'cubicBezier(0.16, 1, 0.3, 1)', duration: 750 } });
    tl.add(eyebrow, { opacity: [0, 1], translateY: [16, 0] })
      .add(
        wordmark,
        { opacity: [0, 1], translateY: [28, 0], scale: [0.92, 1], duration: 1100 },
        '-=500',
      )
      .add(headline, { opacity: [0, 1], translateY: [22, 0], duration: 850 }, '-=550');

    const formStack: HTMLElement[] = [];
    if (sub) formStack.push(sub);
    if (form) formStack.push(form);
    if (guarantee) formStack.push(guarantee);
    if (formStack.length > 0) {
      tl.add(formStack, { opacity: [0, 1], translateY: [18, 0], duration: 800 }, '-=350');
    }

    // Motion-blur ghost trail eases in after the wordmark lands.
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

  return (
    <header className="hero" data-section="hero">
      <div className="container">
        <p ref={eyebrowRef} className="hero-eyebrow-line" style={{ opacity: 0 }}>
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
          AI-powered. <span className="italic">Community-driven.</span>
        </h1>

        <div className="hero-grid">
          <div className="hero-grid-left">
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
              <input ref={inputRef} {...inputProps} />
              <button ref={buttonRef} {...buttonProps}>
                {buttonLabel}
              </button>
            </form>
            <div {...statusProps}>{message}</div>

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
              Early refund guarantee. If our models don't deliver, we refund early.
            </div>
          </div>

          <div className="hero-grid-right">
            <PhoneFrame />
          </div>
        </div>
      </div>
    </header>
  );
}

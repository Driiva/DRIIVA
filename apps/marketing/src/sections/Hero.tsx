import { useEffect, useRef } from 'react';
import { animate, createTimeline, prefersReducedMotion } from '@/lib/motion';

export function Hero() {
  const wordmarkRef = useRef<HTMLImageElement | null>(null);
  const subheadRef = useRef<HTMLParagraphElement | null>(null);
  const ctaRef = useRef<HTMLAnchorElement | null>(null);
  const noiseRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const wordmark = wordmarkRef.current;
    const subhead = subheadRef.current;
    const cta = ctaRef.current;
    const noise = noiseRef.current;
    if (!wordmark || !subhead || !cta) return;

    if (prefersReducedMotion()) {
      for (const el of [wordmark, subhead, cta]) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
      return;
    }

    const tl = createTimeline({
      defaults: { ease: 'cubicBezier(0.16, 1, 0.3, 1)', duration: 1100 },
    });
    tl.add(wordmark, {
      opacity: [0, 1],
      scale: [1.05, 1],
      translateX: [-12, 0],
    })
      .add(
        subhead,
        { opacity: [0, 1], translateY: [16, 0], duration: 800 },
        '-=300',
      )
      .add(
        cta,
        { opacity: [0, 1], translateY: [12, 0], duration: 700 },
        '-=400',
      );

    let noiseHandle: ReturnType<typeof animate> = null;
    if (noise) {
      noiseHandle = animate(noise, {
        translateX: [-20, 20],
        translateY: [-10, 10],
        duration: 60000,
        ease: 'inOutSine',
        loop: true,
        direction: 'alternate',
      });
    }

    return () => {
      noiseHandle?.pause?.();
    };
  }, []);

  return (
    <section
      data-section="hero"
      className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24"
    >
      <svg
        ref={noiseRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]"
      >
        <filter id="hero-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-noise)" />
      </svg>

      <img
        ref={wordmarkRef}
        src="/brand/driiva-wordmark.png"
        alt="driiva"
        className="block h-auto w-full max-w-[min(72vw,920px)] select-none"
        style={{ opacity: 0 }}
        draggable={false}
        {...({ fetchpriority: 'high' } as Record<string, string>)}
      />

      <p
        ref={subheadRef}
        className="lede mt-10 text-center"
        style={{ opacity: 0 }}
      >
        AI-powered. Community-driven.
      </p>

      <a
        ref={ctaRef}
        href="#waitlist"
        className="ghost-cta mt-12"
        style={{ opacity: 0 }}
      >
        join the waitlist
        <span aria-hidden="true" className="mono">→</span>
      </a>
    </section>
  );
}

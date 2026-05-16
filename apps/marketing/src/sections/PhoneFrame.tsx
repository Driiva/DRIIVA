import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

const TARGET_SCORE = 84;

// Animates 0 → target via requestAnimationFrame so we don't depend on
// anime.js plain-object semantics. Cubic ease-out for a confident finish.
function countUp(el: HTMLElement, target: number, duration: number, delay: number) {
  const start = () => {
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (delay > 0) {
    window.setTimeout(start, delay);
  } else {
    start();
  }
}

export function PhoneFrame() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    const valueEl = valueRef.current;
    if (!frame || !valueEl) return;

    if (prefersReducedMotion()) {
      setPlayed(true);
      valueEl.textContent = String(TARGET_SCORE);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setPlayed(true);
      countUp(valueEl, TARGET_SCORE, 1500, 600);
      return;
    }

    let triggered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !triggered) {
            triggered = true;
            setPlayed(true);
            countUp(valueEl, TARGET_SCORE, 1500, 600);
          }
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className={`phone-frame${played ? ' is-played' : ''}`}
      data-testid="phone-frame"
      aria-label="Driiva app preview"
    >
      <div className="phone-glow" aria-hidden="true" />
      <div className="phone-body">
        <div className="phone-notch" aria-hidden="true" />
        <div className="phone-screen">
          <div className="phone-statusbar" aria-hidden="true">
            <span>9:41</span>
            <span className="phone-statusbar-right">
              <span className="phone-signal" />
              <span className="phone-battery" />
            </span>
          </div>

          <div className="phone-app-head">
            <span className="phone-tier">Tier 3</span>
            <span className="phone-app-title">Score this week</span>
          </div>

          <div className="phone-ring-wrap">
            <svg viewBox="0 0 160 160" className="phone-ring" aria-hidden="true">
              <defs>
                <linearGradient id="phoneRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="55%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <circle
                cx="80"
                cy="80"
                r="60"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="10"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="75 25"
                transform="rotate(135 80 80)"
              />
              <circle
                className="phone-ring-fill"
                cx="80"
                cy="80"
                r="60"
                fill="none"
                stroke="url(#phoneRingGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                pathLength="100"
                transform="rotate(135 80 80)"
              />
            </svg>
            <div className="phone-ring-center">
              <span ref={valueRef} className="phone-ring-value">
                0
              </span>
              <span className="phone-ring-suffix">/ 100</span>
            </div>
          </div>

          <div className="phone-rows">
            <div className="phone-row">
              <span className="phone-row-label">This month</span>
              <span className="phone-row-value">£18 saved</span>
            </div>
            <div className="phone-row">
              <span className="phone-row-label">Next refund</span>
              <span className="phone-row-value">31 Jan 27</span>
            </div>
            <div className="phone-row">
              <span className="phone-row-label">Streak</span>
              <span className="phone-row-value">14 days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useReveal } from '@/hooks/useReveal';
import { prefersReducedMotion } from '@/lib/motion';

// Marketing-only model. Real underwriting will replace this once Driiva is
// through the FCA sandbox; the formula here exists to give safe drivers an intuitive
// sense of scale. See FAQ for caveats.
function estimatePremium(age: number, mileage: number): number {
  const ageEffect = Math.max(0, 28 - age) * 22; // younger pays more, capped
  const mileageEffect = (mileage / 1000) * 38;
  return Math.round(720 + ageEffect + mileageEffect);
}

function refundRange(premium: number): [number, number] {
  return [Math.round(premium * 0.06), Math.round(premium * 0.15)];
}

function countTo(target: number, durationMs: number, onTick: (value: number) => void) {
  if (prefersReducedMotion()) {
    onTick(target);
    return () => undefined;
  }
  const startVal = 0;
  const startT = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - startT) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    onTick(Math.round(startVal + (target - startVal) * eased));
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function ScoreCalculator() {
  const ref = useReveal<HTMLElement>();
  const [age, setAge] = useState(22);
  const [mileage, setMileage] = useState(8000);
  const [hasFiredFirstReveal, setHasFiredFirstReveal] = useState(false);
  const lowRef = useRef<HTMLSpanElement | null>(null);
  const highRef = useRef<HTMLSpanElement | null>(null);

  const premium = useMemo(() => estimatePremium(age, mileage), [age, mileage]);
  const [low, high] = useMemo(() => refundRange(premium), [premium]);

  // Run the count-up the first time the section enters viewport, then
  // snap-update on every slider change.
  useEffect(() => {
    const lowEl = lowRef.current;
    const highEl = highRef.current;
    if (!lowEl || !highEl) return;
    if (!hasFiredFirstReveal) {
      setHasFiredFirstReveal(true);
      const a = countTo(low, 1300, (v) => (lowEl.textContent = '£' + v));
      const b = countTo(high, 1300, (v) => (highEl.textContent = '£' + v));
      return () => {
        a();
        b();
      };
    }
    lowEl.textContent = '£' + low;
    highEl.textContent = '£' + high;
    return;
  }, [low, high, hasFiredFirstReveal]);

  return (
    <section ref={ref} id="check-refund" className="calc" data-section="calc">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow-mini">Check your projected refund</span>
          <h2>How much could you get back?</h2>
          <p>
            A marketing-only estimate. Real pricing happens once we are through the FCA regulatory sandbox and we score
            your actual driving.
          </p>
        </div>

        <div className="calc-card glass reveal-init">
          <div className="calc-grid">
            <div className="calc-controls">
              <Slider
                id="calc-age"
                label="Your age"
                min={17}
                max={35}
                value={age}
                suffix=""
                onChange={(v) => setAge(v)}
              />
              <Slider
                id="calc-miles"
                label="Annual mileage"
                min={3000}
                max={15000}
                step={500}
                value={mileage}
                suffix=" miles"
                onChange={(v) => setMileage(v)}
              />
              <p className="calc-disclaimer">
                Assumes a personal score above 70/100. Below that, refunds taper to zero.
              </p>
            </div>
            <div className="calc-output">
              <div className="calc-output-eyebrow">Projected annual refund</div>
              <div className="calc-output-range">
                <span ref={lowRef} className="calc-output-value">
                  £{low}
                </span>
                <span className="calc-output-sep">to</span>
                <span ref={highRef} className="calc-output-value">
                  £{high}
                </span>
              </div>
              <div className="calc-output-meta">
                Based on a notional premium of £{premium}, paid back when the pool performs.
              </div>
              <a href="#cta-final" className="calc-output-cta">
                Lock in my place
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface SliderProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  suffix: string;
  onChange: (v: number) => void;
}

function Slider({ id, label, min, max, step, value, suffix, onChange }: SliderProps) {
  function handle(e: ChangeEvent<HTMLInputElement>) {
    onChange(Number(e.target.value));
  }
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="calc-slider">
      <label htmlFor={id} className="calc-slider-head">
        <span>{label}</span>
        <span className="calc-slider-value">
          {value}
          {suffix}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={handle}
        className="calc-slider-input"
        style={{ '--calc-pct': pct + '%' } as React.CSSProperties}
      />
    </div>
  );
}

import { useReveal } from '@/hooks/useReveal';

interface Row {
  feature: string;
  driiva: { has: boolean; note?: string };
  traditional: { has: boolean; note?: string };
}

const ROWS: readonly Row[] = [
  {
    feature: 'Refunds for safe driving',
    driiva: { has: true, note: 'Up to 15% annually' },
    traditional: { has: false, note: 'Never' },
  },
  {
    feature: 'Explainable scoring',
    driiva: { has: true, note: 'Every factor + weight published' },
    traditional: { has: false, note: 'Black box at renewal' },
  },
  {
    feature: 'Hardware required',
    driiva: { has: false, note: 'Phone only' },
    traditional: { has: true, note: 'OBD or dashcam' },
  },
  {
    feature: 'Real-time score visibility',
    driiva: { has: true, note: 'Live in-app' },
    traditional: { has: false, note: 'You find out at renewal' },
  },
  {
    feature: 'Community surplus sharing',
    driiva: { has: true, note: 'Pool returns to drivers' },
    traditional: { has: false, note: 'Profit kept by insurer' },
  },
];

function Check({ on }: { on: boolean }) {
  if (on) {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Yes">
        <path d="M5 12l5 5L20 7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="No">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Comparison() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="compare" className="compare" data-section="compare">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow-mini">Driiva vs traditional</span>
          <h2>Same road. Different deal.</h2>
          <p>
            What changes when the insurer is structured to pay drivers back instead of lock them in.
          </p>
        </div>
        <div className="compare-card glass reveal-init" role="table" aria-label="Driiva versus traditional motor insurance">
          <div className="compare-row compare-row-head" role="row">
            <div role="columnheader" className="compare-cell compare-cell-feature">Feature</div>
            <div role="columnheader" className="compare-cell compare-cell-driiva">
              <img
                className="compare-wordmark"
                src="/brand/logo-wordmark-white-v3.png"
                alt="Driiva"
                width="84"
                height="22"
              />
            </div>
            <div role="columnheader" className="compare-cell compare-cell-trad">Traditional UK insurer</div>
          </div>
          {ROWS.map((row) => (
            <div key={row.feature} className="compare-row" role="row">
              <div role="cell" className="compare-cell compare-cell-feature">{row.feature}</div>
              <div role="cell" className="compare-cell compare-cell-driiva">
                <span className={`compare-mark ${row.driiva.has ? 'on' : 'off'}`}>
                  <Check on={row.driiva.has} />
                </span>
                {row.driiva.note && <span className="compare-note">{row.driiva.note}</span>}
              </div>
              <div role="cell" className="compare-cell compare-cell-trad">
                <span className={`compare-mark ${row.traditional.has ? 'on' : 'off'}`}>
                  <Check on={row.traditional.has} />
                </span>
                {row.traditional.note && <span className="compare-note">{row.traditional.note}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The annual/monthly billing toggle. Extracted verbatim from
 * client/src/pages/checkout.tsx.
 */
import { motion } from 'framer-motion';

import { formatGbp } from '@/lib/pricingEngine';
import type { BillingPeriod } from './types';

export function BillingToggle({
  period,
  onChange,
  annualGbp,
  monthlyGbp,
}: {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
  annualGbp: number;
  monthlyGbp: number;
}) {
  const annualVsMonthly = Math.round((1 - annualGbp / (monthlyGbp * 12)) * 100);

  return (
    <div className="space-y-3 mb-6">
      <div
        className="flex rounded-2xl p-1 gap-1"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
        role="group"
        aria-label="Billing period"
      >
        {(['annual', 'monthly'] as BillingPeriod[]).map((p) => {
          const isActive = period === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className="flex-1 relative flex flex-col items-center py-3 rounded-xl transition-all duration-200 text-sm"
              style={{
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
              }}
            >
              {p === 'annual' && annualVsMonthly > 0 && (
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-300"
                  style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)' }}
                >
                  Save {annualVsMonthly}%
                </span>
              )}
              <span className={`font-semibold ${isActive ? 'text-white' : 'text-white/60'}`}>
                {p === 'annual' ? `${formatGbp(annualGbp)}/yr` : `${formatGbp(monthlyGbp, true)}/mo`}
              </span>
              <span className={`text-xs mt-0.5 ${isActive ? 'text-white/60' : 'text-white/55'}`}>
                {p === 'annual' ? 'Pay annually' : 'Pay monthly'}
              </span>
            </button>
          );
        })}
      </div>
      {period === 'monthly' && (
        <p className="text-center text-white/60 text-xs">
          Monthly instalments include a 7% handling charge vs. annual.
        </p>
      )}
    </div>
  );
}

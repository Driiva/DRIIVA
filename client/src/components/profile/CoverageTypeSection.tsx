/**
 * The cover tier panel: which tier the driver is on, what it includes, and
 * what the next one would cost. Extracted verbatim from
 * client/src/pages/profile.tsx.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { projectedRefundCents } from '@driiva/scoring';
import { easing } from '@/lib/animations';

import { PolicyFeature, Skeleton } from './primitives';

export function CoverageTypeSection({ currentScore, coverageType, premiumAmount, loading }: { currentScore: number; coverageType: string | null; premiumAmount: number; loading?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // WEB-17: use the canonical @driiva/scoring refund (blended score, 50-100
  // scale) instead of a divergent hand-rolled 5-15%/70-100 formula.
  // projectedRefundCents returns null when there is no premium to project
  // against, so the "could reduce your premium by" line below has nothing to
  // state. It used to promise a saving of nothing at renewal to any driver
  // scoring 70 or better with no policy bound, which is a figure nobody
  // calculated. The block is now gated on there being a refund to name.
  const projectedRefundCentsValue = currentScore >= 70
    ? projectedRefundCents(currentScore, Math.round(premiumAmount * 100))
    : null;
  const projectedRefund = projectedRefundCentsValue === null ? 0 : projectedRefundCentsValue / 100;

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
        <Skeleton className="h-5 w-full" />
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors min-h-[56px]"
      >
        <span className="text-sm text-white/60">Coverage Type</span>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-medium">{coverageType ?? 'Not active'}</span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-emerald-400" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: easing.smoothDecel }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-white/[0.08]">
              {/*
                WAVE G: this benefit list, the excess panel and the premium-reduction
                line used to render for every signed-in user, whether or not they had a
                policy. Driiva has never issued one, so a driver with no cover was being
                shown "Third-Party Liability up to £20M" and "Legal Expenses up to
                £100,000" as though those limits applied to them. They are gated on a
                real coverage type now: no policy, no benefits list.
              */}
              {!coverageType ? (
                <p className="text-sm text-white/50">
                  You have no cover in place. Driiva cannot issue policies until it is
                  through the FCA regulatory sandbox, so there is nothing to summarise here yet. Your driving
                  score is still being recorded in the meantime.
                </p>
              ) : (
              <>
              <p className="text-sm text-white/60 mb-4">Full coverage with extras</p>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wide">
                  What's included
                </h4>

                <PolicyFeature icon="✅" title="Collision Coverage" description="Damage to your vehicle from accidents" />
                <PolicyFeature icon="✅" title="Comprehensive Coverage" description="Theft, vandalism, weather damage" />
                <PolicyFeature icon="✅" title="Third-Party Liability" description="Up to £20M coverage for injuries & property" />
                <PolicyFeature icon="✅" title="Personal Injury Protection" description="Medical expenses for you and passengers" />
                <PolicyFeature icon="✅" title="Roadside Assistance" description="24/7 emergency breakdown service" />
                <PolicyFeature icon="✅" title="Courtesy Car" description="Replacement vehicle during repairs" />
                <PolicyFeature icon="✅" title="Legal Expenses" description="Up to £100,000 legal cover" />
              </div>

              <div className="mt-4 p-3 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/60">Voluntary Excess</span>
                  <span className="text-sm font-medium text-white/60">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Compulsory Excess</span>
                  <span className="text-sm font-medium text-white/60">—</span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/80">Total Excess</span>
                  <span className="text-base font-semibold text-white/60">—</span>
                </div>
              </div>

              {currentScore >= 70 && projectedRefund > 0 && (
                <div className="mt-4 flex items-start gap-2 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <span className="text-base">ℹ️</span>
                  <div>
                    <p className="text-xs text-emerald-300 font-medium mb-1">Policy Benefits</p>
                    <p className="text-xs text-emerald-200/70">
                      Your safe driving score of {currentScore} could reduce your premium by up to £{projectedRefund.toFixed(2)} at renewal.
                    </p>
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


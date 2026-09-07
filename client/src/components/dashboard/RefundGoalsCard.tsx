/**
 * Refund goals card: the projected surplus, its progress bar and the copy that
 * changes with the score. Extracted verbatim from client/src/pages/dashboard.tsx.
 */
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { FinancialPromotionDisclaimer } from '@/components/FinancialPromotionDisclaimer';
import { item } from '@/lib/animations';

interface RefundGoalsCardProps {
  surplusProjection: number;
  drivingScore: number;
  premiumAmount: number;
  isNewUser: boolean;
}

export function RefundGoalsCard({ surplusProjection, drivingScore, premiumAmount, isNewUser }: RefundGoalsCardProps) {
  return (
        <motion.div variants={item} className="instrument-card mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Refund goals</h2>
            <Target className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Current Refund</span>
              <AnimatedNumber value={surplusProjection} prefix="£" className="text-emerald-400 font-bold text-xl" />
            </div>
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Based on {drivingScore}% score</span>
              <span>Max £{Math.round(premiumAmount * 0.15)}</span>
            </div>
            <div className="h-3 bg-white/10 rounded-[2px] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((surplusProjection / Math.max(premiumAmount * 0.15, 1)) * 100, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500"
              />
            </div>
            {isNewUser ? (
              <p className="text-white/60 text-xs text-center mt-2">
                Drive safely to unlock refunds up to 15% of your premium!
              </p>
            ) : surplusProjection > 0 ? (
              <p className="text-emerald-300/70 text-sm text-center mt-2">
                You're on track for £{surplusProjection} back this period. Refunds are calculated at the end of each period.
              </p>
            ) : drivingScore < 70 ? (
              <p className="text-amber-300/70 text-xs text-center mt-2">
                Score 70+ to qualify for a refund. Keep driving safely!
              </p>
            ) : null}
            <FinancialPromotionDisclaimer className="mt-3 text-center" />
          </div>
        </motion.div>
  );
}

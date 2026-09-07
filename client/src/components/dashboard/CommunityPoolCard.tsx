/**
 * Community pool card: totals, the projected refund, the safety-factor bar and
 * the leaderboard link. Extracted verbatim from client/src/pages/dashboard.tsx,
 * including the empty-pool note that keeps this surface honest while there is
 * no funding path in.
 */
import { motion } from 'framer-motion';
import { ChevronRight, Trophy, Users } from 'lucide-react';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { item } from '@/lib/animations';

interface CommunityPoolCardProps {
  isDemoMode: boolean;
  poolLoading: boolean;
  poolTotal: number;
  poolShare: number;
  poolDaysRemaining: number;
  userSharePercentage: number;
  safetyFactor: number | null;
  activeParticipants: number;
  userRank: number | null;
  setLocation: (path: string) => void;
}

export function CommunityPoolCard({
  isDemoMode,
  poolLoading,
  poolTotal,
  poolShare,
  poolDaysRemaining,
  userSharePercentage,
  safetyFactor,
  activeParticipants,
  userRank,
  setLocation,
}: CommunityPoolCardProps) {
  return (
        <motion.div variants={item} className="instrument-card mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Community pool</h2>
              {poolDaysRemaining > 0 && !isDemoMode && (
                <p className="text-xs text-white/60">{poolDaysRemaining} days left in period</p>
              )}
            </div>
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          {poolLoading && !isDemoMode ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-white/10 rounded" />
                  <div className="h-4 w-16 bg-white/10 rounded" />
                </div>
              ))}
              <div className="h-2 w-full bg-white/10 rounded-[2px] mt-2" />
            </div>
          ) : (
            <div className="space-y-3">
              {/*
                Wave 0 (0h): there is no funding path into the pool yet. The
                contribution callable has no callers and trip completion never
                creates a share, so this card renders a full economy that
                nothing fills. Rather than invent one (the pool money model is
                still an open decision), say so while the pool is empty.
              */}
              {!isDemoMode && poolTotal === 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
                  <p className="text-sm text-white/70 leading-relaxed">
                    Contributions start when the insurance product launches.
                    Your score is being tracked now and will set your share of
                    the pool from day one.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Total Pool</span>
                <AnimatedNumber value={poolTotal} prefix="£" locale className="text-white font-semibold" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Your Projected Refund</span>
                <AnimatedNumber value={poolShare} prefix="£" decimals={2} className="text-emerald-400 font-bold" />
              </div>
              {userSharePercentage > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Your Share</span>
                  <span className="text-white font-semibold tabular">{userSharePercentage.toFixed(2)}%</span>
                </div>
              )}
              {safetyFactor != null && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Safety Factor</span>
                  <span className="text-white font-semibold tabular">{Math.round(safetyFactor * 100)}%</span>
                </div>
              )}
              {activeParticipants > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Participants</span>
                  <span className="text-white font-semibold tabular">{activeParticipants.toLocaleString()}</span>
                </div>
              )}
              
              {/* Safety Factor Progress Bar. Drawn only when there is a factor. */}
              {safetyFactor != null && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/60">Safety Factor</span>
                  <span className="text-xs text-white/60 tabular">{Math.round(safetyFactor * 100)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-[2px] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${safetyFactor * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  />
                </div>
              </div>
              )}

              {/* Leaderboard Link */}
              <button
                onClick={() => setLocation('/leaderboard')}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 font-medium hover:from-purple-500/30 hover:to-pink-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                {userRank ? `View Leaderboard • You're #${userRank}` : 'View Leaderboard'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
  );
}

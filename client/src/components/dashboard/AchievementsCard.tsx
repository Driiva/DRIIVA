/**
 * Achievements card: the unlocked strip when there is trip history, the empty
 * state when there is not. Extracted verbatim from client/src/pages/dashboard.tsx.
 */
import { motion } from 'framer-motion';
import { Car, ChevronRight, Target, Trophy } from 'lucide-react';
import { item } from '@/lib/animations';
import type { DashboardData } from '@/hooks/useDashboardData';

interface AchievementsCardProps {
  isDemoMode: boolean;
  dashboardData: DashboardData | null;
  setLocation: (path: string) => void;
}

export function AchievementsCard({ isDemoMode, dashboardData, setLocation }: AchievementsCardProps) {
  return (
        <motion.div variants={item} className="instrument-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Achievements</h2>
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          {(isDemoMode || (dashboardData?.totalTrips || 0) > 0) ? (
            <>
              <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-amber-400" />
                </div>
                <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                  <Car className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Target className="w-8 h-8 text-blue-400" />
                </div>
                <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-white/55 text-2xl">?</span>
                </div>
              </div>
              <button
                onClick={() => setLocation('/achievements')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30 text-amber-300 font-medium hover:from-amber-500/30 hover:to-amber-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                View All Achievements
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Trophy className="w-10 h-10 text-white/20 mb-3" />
              <p className="text-white/60 text-sm mb-4">Complete trips to unlock achievements!</p>
              <button
                onClick={() => setLocation('/achievements')}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70 text-sm hover:bg-white/15 transition-all flex items-center gap-2"
              >
                View Achievements
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
  );
}

/**
 * Driving score card: the ring, its settle pulse and the five-factor
 * breakdown. Extracted verbatim from client/src/pages/dashboard.tsx.
 */
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { SettlePulse } from '@/components/motion/Instrument';
import ScoreRing from '@/components/ScoreRing';
import { StartingScoreExplainer } from '@/components/StartingScoreExplainer';
import { item } from '@/lib/animations';
import type { DashboardData } from '@/hooks/useDashboardData';
import { getScoreMessage } from './helpers';

interface DrivingScoreCardProps {
  isNewUser: boolean;
  isDemoMode: boolean;
  drivingScore: number;
  dashboardData: DashboardData | null;
}

export function DrivingScoreCard({ isNewUser, isDemoMode, drivingScore, dashboardData }: DrivingScoreCardProps) {
  return (
        <motion.div variants={item} className="instrument-card mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Driving score</h2>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>

          {isNewUser ? (
            <div className="flex flex-col items-center py-4">
              <div className="w-[140px] h-[140px] rounded-full border-[6px] border-white/8 flex items-center justify-center mb-3">
                <span className="text-4xl font-bold text-white/55">—</span>
              </div>
              <p className="text-sm text-white/60 text-center">
                Complete your first trip to get a driving score.
              </p>
              {/* Keith Q1: what score do I begin on. Answered from the same
                  constant provisioning writes, rather than a number typed
                  into copy. */}
              <StartingScoreExplainer />
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* The ring already counts the figure up. The pulse is what makes
                  a change felt: it fires once, only when the score is actually
                  a different number from the one that was on screen. */}
              <SettlePulse pulseKey={drivingScore}>
                <ScoreRing score={drivingScore} size={140} strokeWidth={8} />
              </SettlePulse>
              <p className="text-sm text-white/60 mt-3 text-center">
                {getScoreMessage(drivingScore)}
              </p>
            </div>
          )}
          
          {!isDemoMode && !isNewUser && dashboardData?.scoreBreakdown && (
            <Stagger
              className="mt-4 pt-4 border-t border-white/10 grid grid-cols-5 gap-2 text-center"
              delay={0.35}
            >
              {/* The five factors the score is made of, arriving after the ring
                  has settled so the reader sees the total before the breakdown.
                  Tabular figures, because these five sit in a row and a digit
                  changing width would shift its neighbours. */}
              {[
                { label: 'Speed', value: dashboardData.scoreBreakdown.speed },
                { label: 'Braking', value: dashboardData.scoreBreakdown.braking },
                { label: 'Accel', value: dashboardData.scoreBreakdown.acceleration },
                { label: 'Corners', value: dashboardData.scoreBreakdown.cornering },
                { label: 'Phone', value: dashboardData.scoreBreakdown.phoneUsage },
              ].map((factor) => (
                <StaggerItem key={factor.label} yOffset={6}>
                  <div className="text-xs text-white/60">{factor.label}</div>
                  <div className="text-sm font-semibold text-white tabular">{factor.value}</div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </motion.div>
  );
}

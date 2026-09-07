/**
 * AI Driiva card: the always-visible, zero-latency static insight chosen from
 * the score. Extracted verbatim from client/src/pages/dashboard.tsx.
 */
import { motion } from 'framer-motion';
import { item } from '@/lib/animations';
import { getAiDriivaTip, TipIcon } from './helpers';

interface AiDriivaCardProps {
  drivingScore: number;
}

export function AiDriivaCard({ drivingScore }: AiDriivaCardProps) {
  return (
        <motion.div variants={item} className="mb-4">
          {(() => {
            const tip = getAiDriivaTip(drivingScore);

            return (
              <div className="instrument-card relative overflow-hidden">
                {/* Premium gradient glow border */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-pink-500/20 blur-xl -z-10" />
                <div className="absolute inset-0 rounded-2xl border border-indigo-400/30" />

                <div className="flex items-center gap-3 mb-3 relative z-10">
                  {/* Pulsing indigo orb */}
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                      <span className="text-base leading-none">✦</span>
                    </div>
                    <span className="absolute inset-0 rounded-full animate-ping bg-indigo-500/20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">AI Driiva</span>
                      <span className="px-1.5 py-0.5 rounded-xs bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-medium">Beta</span>
                    </div>
                    <p className="text-xs text-white/60 truncate">Personalised driving insights</p>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 mb-3">
                  <p className="text-[13px] font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--app-primary-text)' }}>
                    <TipIcon name={tip.icon} />
                    {tip.headline}
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed">{tip.tip}</p>
                </div>
                
                {/*
                  Wave 0 (0a): the "Get Deep Insight" expander rendered a
                  hardcoded array of invented trip events (streets, speeds, a
                  pool contribution figure) picked at random and presented as
                  personalised analysis. Deleted rather than restated. Per-trip
                  analysis returns when it reads real trip data.
                */}
              </div>
            );
          })()}
        </motion.div>
  );
}

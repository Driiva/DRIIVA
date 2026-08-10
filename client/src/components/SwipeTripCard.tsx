/**
 * Swipeable trip card with peek-to-reveal actions.
 * Swipe left to reveal a "View Details" action panel.
 */
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useCallback, useState } from 'react';
import { Map, ChevronRight, Eye, AlertCircle } from 'lucide-react';
import { haptic } from '@/hooks/useHaptics';

interface SwipeTripCardProps {
  tripId: string;
  from: string;
  to: string;
  score: number;
  distance: string;
  date: string;
  duration: string;
  events: {
    braking: number;
    acceleration: number;
    speeding: string;
  };
  onTap: () => void;
  index?: number;
  /**
   * Trip lifecycle status. Non-completed trips (recording/processing) are
   * still in flight - they have no final score or events yet, so the card
   * shows a distinct "in progress" treatment instead of a score of 0.
   */
  status?: 'recording' | 'processing' | 'completed';
  /**
   * True when the trip was flagged for review by anomaly detection (impossible
   * average speed or an extreme GPS jump). A flagged trip sits in 'processing'
   * status indefinitely - there is no automatic path back out today (see
   * docs/rebuild/m2-dec-3-anomaly-resolution.md) - so it must NOT wear the same
   * pulsing "Processing" badge as a trip that will finish scoring in seconds.
   * This drives a distinct, honest "Under review" treatment instead.
   */
  flagged?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'from-emerald-500/20 to-emerald-600/10';
  if (score >= 60) return 'from-amber-500/20 to-amber-600/10';
  return 'from-red-500/20 to-red-600/10';
}

export function SwipeTripCard({
  from,
  to,
  score,
  distance,
  date,
  duration,
  events,
  onTap,
  index = 0,
  status = 'completed',
  flagged = false,
}: SwipeTripCardProps) {
  const isInFlight = status !== 'completed';
  const x = useMotionValue(0);
  const [swiped, setSwiped] = useState(false);
  const actionOpacity = useTransform(x, [-100, -60, 0], [1, 0.5, 0]);
  const actionScale = useTransform(x, [-100, -60, 0], [1, 0.8, 0.6]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (info.offset.x < -60) {
      setSwiped(true);
      haptic('light');
    } else {
      setSwiped(false);
    }
  }, []);

  const handleTap = useCallback(() => {
    if (swiped) {
      setSwiped(false);
      return;
    }
    haptic('selection');
    onTap();
  }, [swiped, onTap]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Swipe action revealed behind the card */}
      <motion.div
        className="absolute inset-y-0 right-0 w-24 flex items-center justify-center"
        style={{ opacity: actionOpacity }}
      >
        <motion.button
          style={{ scale: actionScale }}
          onClick={onTap}
          className="flex flex-col items-center gap-1 text-emerald-400"
        >
          <Eye className="w-5 h-5" />
          <span className="text-[10px] font-medium">View</span>
        </motion.button>
      </motion.div>

      {/* Main card (draggable) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: swiped ? -80 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{ x }}
        onClick={handleTap}
        className="relative dashboard-glass-card p-5 cursor-pointer active:scale-[0.98] transition-transform"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 bg-gradient-to-br ${isInFlight ? 'from-white/[0.08] to-white/[0.03]' : getScoreBg(score)} rounded-xl flex items-center justify-center flex-shrink-0 border border-white/[0.08]`}>
              <Map className="w-5 h-5 text-white/70" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-sm truncate">
                {from} → {to}
              </h3>
              <p className="text-xs text-white/60 mt-0.5">
                {date} · {duration}
              </p>
            </div>
          </div>
          {isInFlight ? (
            <div className="text-right flex-shrink-0 ml-3">
              <div className="flex items-center gap-1.5 justify-end">
                {flagged ? (
                  // Steady alert icon, not a pulsing dot: a flagged trip is held,
                  // not actively computing, so the indicator must not imply motion.
                  <AlertCircle className="w-3.5 h-3.5 text-indigo-300" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
                <span className={`text-xs font-semibold ${flagged ? 'text-indigo-300' : 'text-amber-300'}`}>
                  {flagged ? 'Under review' : status === 'recording' ? 'Recording' : 'Processing'}
                </span>
              </div>
              <div className="text-xs text-white/60 mt-0.5 tabular">{distance}</div>
            </div>
          ) : (
            <div className="text-right flex-shrink-0 ml-3">
              <div className={`text-xl font-bold tabular-nums ${getScoreColor(score)}`}>
                {score}
              </div>
              <div className="text-xs text-white/60 tabular">{distance}</div>
            </div>
          )}
        </div>

        {isInFlight ? (
          /* In-flight status line (no final events yet) */
          <div className="mt-3 pt-3 border-t border-white/[0.06] text-center">
            <span className="text-xs text-white/45">
              {flagged
                ? "This trip flagged something unusual - we're checking it"
                : status === 'recording'
                ? 'Trip in progress - score pending'
                : 'Scoring your trip - this can take a moment'}
            </span>
          </div>
        ) : (
          /* Event metrics row */
          <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-[10px] text-white/55 mb-0.5">Braking</div>
              <div className="text-xs font-semibold text-white/75 tabular-nums">{events.braking}</div>
            </div>
            <div className="text-center border-x border-white/[0.06]">
              <div className="text-[10px] text-white/55 mb-0.5">Accel</div>
              <div className="text-xs font-semibold text-white/75 tabular-nums">{events.acceleration}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-white/55 mb-0.5">Speed</div>
              <div className="text-xs font-semibold text-white/75 tabular-nums">{events.speeding}</div>
            </div>
          </div>
        )}

        {/* Subtle chevron hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-30 transition-opacity">
          <ChevronRight className="w-4 h-4 text-white/20" />
        </div>
      </motion.div>
    </motion.div>
  );
}

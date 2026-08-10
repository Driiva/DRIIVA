import { motion, useMotionValue, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { GlassCard } from './GlassCard';
import { timing, easing, loopAnimations } from "@/lib/animations";

interface LiquidGaugeProps {
  score: number;
  projectedRefund: number;
  premiumAmount: number;
}

function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    
    const controls = animate(motionValue.get(), value, {
      duration: timing.counter,
      ease: easing.smoothDecel,
      onUpdate: (latest) => {
        node.textContent = Math.round(latest).toString();
      }
    });
    
    motionValue.set(value);
    
    return () => controls.stop();
  }, [value, motionValue]);
  
  return <span ref={nodeRef} className={className}>0</span>;
}

export default function LiquidGauge({ score, projectedRefund, premiumAmount }: LiquidGaugeProps) {
  const { toast } = useToast();
  const personalScore = Math.round(score * 0.8);
  const poolScore = Math.round(score * 0.2);
  const scorePercentage = score / 100;

  const handleScoreClick = () => {
    toast({
      title: "Score Breakdown",
      description: `Personal driving: ${personalScore}/100 (80% weight)\nCommunity pool: ${poolScore}/100 (20% weight)\nTotal score: ${score}/100`,
    });
  };

  return (
    <GlassCard className="p-6">
      {/* Score Ring with spring entrance */}
      <motion.div 
        className="relative w-40 h-40 mx-auto mb-6"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: timing.cardEntrance * 1.5, ease: easing.elastic }}
      >
        <svg 
          className="w-full h-full -rotate-90" 
          viewBox="0 0 100 100"
        >
          {/* Background ring */}
          <circle 
            cx="50" 
            cy="50" 
            r="45" 
            stroke="rgba(255,255,255,0.1)" 
            strokeWidth="6" 
            fill="none"
          />
          {/* Animated progress ring */}
          <motion.circle 
            cx="50" 
            cy="50" 
            r="45" 
            stroke="#10B981"
            strokeWidth="6" 
            fill="none" 
            strokeLinecap="round"
            strokeDasharray="283"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: scorePercentage }}
            transition={{ duration: timing.loop, ease: "easeOut", delay: timing.pageTransition }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.button 
            onClick={handleScoreClick} 
            className="text-center min-h-[44px] min-w-[44px]" 
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: timing.quick }}
            data-testid="driving-score-button"
          >
            <motion.div
              key={score}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.3 }}
            >
              <AnimatedCounter value={score} className="text-5xl font-semibold text-white" />
            </motion.div>
            <div className="text-xs text-white/60 mt-1">
              out of 100
            </div>
          </motion.button>
        </div>
      </motion.div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.div 
          className="text-center p-3 bg-white/5 rounded-xl"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: timing.quick }}
        >
          <div className="text-lg font-semibold text-white" data-testid="personal-score">
            {personalScore}%
          </div>
          <div className="text-xs text-white/60 mt-1">
            Personal Score
          </div>
        </motion.div>
        <motion.div 
          className="text-center p-3 bg-white/5 rounded-xl"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: timing.quick }}
        >
          <div className="text-lg font-semibold text-white" data-testid="pool-score">
            {poolScore}%
          </div>
          <div className="text-xs text-white/60 mt-1">
            Pool Score
          </div>
        </motion.div>
      </div>

      {/* Projected Annual Refund with shimmer */}
      <div 
        className="relative overflow-hidden bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 rounded-xl p-5 text-center"
        data-testid="projected-refund-card"
      >
        {/* Shimmer overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          {...loopAnimations.shimmer}
        />
        <div className="relative z-10">
          <div className="text-xs font-medium text-white/60 mb-1">Projected Annual Refund</div>
          <motion.div 
            className="text-3xl font-semibold text-emerald-400 mb-1"
            key={projectedRefund}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 0.3 }}
          >
            £{projectedRefund.toFixed(2)}
          </motion.div>
          <p className="text-xs text-white/60">
            {((projectedRefund / Number(premiumAmount)) * 100).toFixed(1)}% of £{premiumAmount.toLocaleString()} premium
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

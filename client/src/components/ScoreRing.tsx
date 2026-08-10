import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function getScoreColor(score: number): { from: string; to: string } {
  if (score >= 80) return { from: '#10B981', to: '#06B6D4' };
  if (score >= 60) return { from: '#F59E0B', to: '#D97706' };
  return { from: '#EF4444', to: '#DC2626' };
}

export default function ScoreRing({ score, size = 140, strokeWidth = 8, className = '' }: ScoreRingProps) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gradientId = `scoreGrad-${Math.random().toString(36).slice(2, 8)}`;
  const { from, to } = getScoreColor(score);

  useEffect(() => {
    const node = numberRef.current;
    if (!node) return;
    const controls = animate(0, score, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate: (v) => { node.textContent = Math.round(v).toString(); },
    });
    return () => controls.stop();
  }, [score]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
        {/* Glow filter */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          <filter id={`glow-${gradientId}`}>
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Center content */}
      <div className="relative flex flex-col items-center z-10">
        <span ref={numberRef} className="text-4xl font-bold text-white">0</span>
        <span className="text-xs text-white/60 -mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

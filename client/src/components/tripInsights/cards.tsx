/**
 * The pieces the AI trip insight is assembled from: the risk badge, the score
 * delta, and the incident, pattern and historical-comparison cards.
 * Extracted verbatim from client/src/components/TripAIInsights.tsx.
 */
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Activity,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { TripAIIncident, TripAIInsight, TripAIPattern } from '@/lib/firestore';

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export function RiskBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    low: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Low Risk' },
    medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Medium Risk' },
    high: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'High Risk' },
  };
  const c = config[level] ?? config.medium;

  return (
    <Badge variant="outline" className={`${c.bg} ${c.text} border-current/30 text-[10px] font-medium`}>
      {c.label}
    </Badge>
  );
}

export function ScoreDelta({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const isPositive = delta > 0;
  return (
    <span
      className={`text-sm font-semibold flex items-center gap-0.5 ${
        isPositive ? 'text-emerald-400' : 'text-red-400'
      }`}
    >
      {isPositive ? (
        <TrendingUp className="w-3.5 h-3.5" />
      ) : (
        <TrendingDown className="w-3.5 h-3.5" />
      )}
      {isPositive ? '+' : ''}{delta}
    </span>
  );
}

export function IncidentCard({
  incident,
  index,
}: {
  incident: TripAIIncident;
  index: number;
}) {
  const severityConfig: Record<string, { border: string; icon: JSX.Element }> = {
    low: {
      border: 'border-l-emerald-400/50',
      icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
    },
    medium: {
      border: 'border-l-yellow-400/50',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />,
    },
    high: {
      border: 'border-l-red-400/50',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
    },
  };
  const cfg = severityConfig[incident.severity] ?? severityConfig.medium;

  const typeLabel: Record<string, string> = {
    harsh_braking: 'Hard Braking',
    speeding: 'Speeding',
    rapid_acceleration: 'Rapid Accel',
    sharp_turn: 'Sharp Turn',
    phone_usage: 'Phone Use',
    tailgating: 'Tailgating',
    erratic_driving: 'Erratic',
  };

  return (
    <motion.div
      className={`glass-card rounded-lg p-3 border-l-2 ${cfg.border}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-white">
              {typeLabel[incident.type] || incident.type}
            </span>
            <span className="text-[10px] text-gray-500">{incident.timestamp}</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{incident.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function PatternCard({
  pattern,
  index,
}: {
  pattern: TripAIPattern;
  index: number;
}) {
  const severityColor: Record<string, string> = {
    low: 'text-emerald-400 bg-emerald-500/10',
    medium: 'text-yellow-400 bg-yellow-500/10',
    high: 'text-red-400 bg-red-500/10',
  };
  const color = severityColor[pattern.severity] ?? severityColor.medium;

  return (
    <motion.div
      className="glass-card rounded-lg p-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white truncate">
              {pattern.title}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}`}
            >
              {pattern.severity}
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {pattern.description}
          </p>
        </div>
        {pattern.scoreImpact !== 0 && (
          <span
            className={`text-xs font-semibold whitespace-nowrap ${
              pattern.scoreImpact > 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {pattern.scoreImpact > 0 ? '+' : ''}{pattern.scoreImpact}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function HistoricalComparisonCard({
  comparison,
}: {
  comparison: TripAIInsight['historicalComparison'];
}) {
  const trendIcon =
    comparison.trendDirection === 'improving' ? (
      <TrendingUp className="w-4 h-4 text-emerald-400" />
    ) : comparison.trendDirection === 'declining' ? (
      <TrendingDown className="w-4 h-4 text-red-400" />
    ) : (
      <Minus className="w-4 h-4 text-gray-500" />
    );

  const trendColor =
    comparison.trendDirection === 'improving'
      ? 'text-emerald-400'
      : comparison.trendDirection === 'declining'
      ? 'text-red-400'
      : 'text-gray-400';

  const deltaText =
    comparison.vsAverageScore > 0
      ? `+${comparison.vsAverageScore} above`
      : comparison.vsAverageScore < 0
      ? `${comparison.vsAverageScore} below`
      : 'At';

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          vs your average
        </h4>
        <div className="flex items-center gap-1">
          {trendIcon}
          <span className={`text-xs font-medium capitalize ${trendColor}`}>
            {comparison.trendDirection}
          </span>
        </div>
      </div>
      <p className="text-sm text-white font-medium">
        {deltaText} your average
      </p>
      <p className="text-xs text-gray-400 mt-1">{comparison.consistencyNote}</p>
    </div>
  );
}


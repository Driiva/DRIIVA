/**
 * TRIP AI INSIGHTS COMPONENT
 * ==========================
 * Displays Claude Sonnet 4-powered analysis for a specific trip.
 *
 * Sections:
 *   1. Summary + Risk Badge + Overall Score
 *   2. Strengths (good driving behaviors)
 *   3. Improvements (areas to work on)
 *   4. Specific Incidents timeline
 *   5. Safety Tips
 *   6. Comparison to personal average
 *   7. Detailed Patterns (expandable)
 *   8. Context footer
 *
 * States:
 *   - Loading — skeleton pulse
 *   - No insights yet — CTA to request analysis
 *   - Analysis pending — spinner
 *   - Insights available — full breakdown
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Shield,
  Lightbulb,
  BarChart3,
  Clock,
  Sparkles,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  Target,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTripAIInsights } from '@/hooks/useTripAIInsights';
import { useState } from 'react';

// The badge, the delta and the three cards live in
// client/src/components/tripInsights/.
import {
  HistoricalComparisonCard,
  IncidentCard,
  PatternCard,
  RiskBadge,
  ScoreDelta,
} from '@/components/tripInsights/cards';

interface TripAIInsightsProps {
  tripId: string;
  tripStatus?: string;
  className?: string;
}

export default function TripAIInsights({
  tripId,
  tripStatus = 'completed',
  className = '',
}: TripAIInsightsProps) {
  const {
    insights,
    isLoading,
    isFetching,
    requestAnalysis,
    isAnalyzing,
  } = useTripAIInsights({
    tripId,
    enabled: tripStatus === 'completed',
  });

  const [patternsExpanded, setPatternsExpanded] = useState(false);
  const [incidentsExpanded, setIncidentsExpanded] = useState(false);

  // ── Loading state ──
  if (isLoading) {
    return (
      <Card className={`glass-morphism border-0 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <span className="text-white">AI Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl skeleton-pulse" />
          <Skeleton className="h-12 w-full rounded-xl skeleton-pulse" />
          <Skeleton className="h-20 w-full rounded-xl skeleton-pulse" />
        </CardContent>
      </Card>
    );
  }

  // ── No insights — CTA to request ──
  if (!insights) {
    return (
      <Card className={`glass-morphism border-0 ${className}`}>
        <CardContent className="py-6">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center">
              <Brain className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">AI trip analysis</h3>
              <p className="text-gray-400 text-sm mt-1">
                Get detailed driving insights powered by Claude AI
              </p>
            </div>
            <button
              onClick={() => requestAnalysis()}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                bg-gradient-to-r from-purple-500 to-blue-500 text-white
                hover:from-purple-600 hover:to-blue-600 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Trip
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Insights available ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      <Card className="glass-morphism border-0 overflow-hidden">
        {/* ─── HEADER: Score + Risk Level ─── */}
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="text-white">AI Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <RiskBadge level={insights.riskLevel} />
              {isFetching && (
                <RefreshCw className="w-3.5 h-3.5 text-gray-500 animate-spin" />
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ─── SCORE + COMPARISON ─── */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                  {insights.overallScore}
                </span>
                <span className="text-sm text-gray-400">/100</span>
                <ScoreDelta delta={insights.scoreAdjustment.delta} />
              </div>
              <span className="text-[10px] text-gray-500">
                {(insights.scoreAdjustment.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {insights.comparisonToAverage}
            </p>
          </div>

          {/* ─── STRENGTHS ─── */}
          {insights.strengths.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Strengths
              </h4>
              {insights.strengths.map((strength, i) => (
                <motion.div
                  key={i}
                  className="glass-card rounded-lg px-3 py-2.5 flex items-start gap-2.5"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-gray-200 leading-relaxed">{strength}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* ─── IMPROVEMENTS ─── */}
          {insights.improvements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                Areas to Improve
              </h4>
              {insights.improvements.map((improvement, i) => (
                <motion.div
                  key={i}
                  className="glass-card rounded-lg px-3 py-2.5 flex items-start gap-2.5"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-gray-200 leading-relaxed">{improvement}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* ─── SPECIFIC INCIDENTS ─── */}
          {insights.specificIncidents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                Incidents Detected ({insights.specificIncidents.length})
              </h4>
              <AnimatePresence initial={false}>
                {insights.specificIncidents
                  .slice(0, incidentsExpanded ? undefined : 3)
                  .map((incident, i) => (
                    <IncidentCard key={i} incident={incident} index={i} />
                  ))}
              </AnimatePresence>
              {insights.specificIncidents.length > 3 && (
                <button
                  onClick={() => setIncidentsExpanded(!incidentsExpanded)}
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors mx-auto"
                >
                  {incidentsExpanded ? 'Show less' : `+${insights.specificIncidents.length - 3} more`}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${incidentsExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </div>
          )}

          {/* ─── SAFETY TIPS ─── */}
          {insights.safetyTips.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-blue-400" />
                Safety Tips
              </h4>
              {insights.safetyTips.map((tip, i) => (
                <motion.div
                  key={i}
                  className="glass-card rounded-lg p-3 flex items-start gap-2.5"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ x: 3 }}
                >
                  <Shield className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-200 leading-relaxed">{tip}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* ─── DETAILED PATTERNS (expandable) ─── */}
          {insights.patterns.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setPatternsExpanded(!patternsExpanded)}
                className="w-full flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider"
              >
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Detailed Patterns ({insights.patterns.length})
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${patternsExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {patternsExpanded &&
                  insights.patterns.map((pattern, i) => (
                    <PatternCard key={i} pattern={pattern} index={i} />
                  ))}
              </AnimatePresence>
            </div>
          )}

          {/* ─── HISTORICAL COMPARISON ─── */}
          <HistoricalComparisonCard comparison={insights.historicalComparison} />

          {/* ─── CONTEXT FOOTER ─── */}
          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-white/5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {insights.contextFactors.dayOfWeek} {insights.contextFactors.timeOfDay}
              {insights.contextFactors.isNightDriving && ' · Night'}
              {insights.contextFactors.isRushHour && ' · Rush hour'}
            </span>
            <span>
              {insights.contextFactors.estimatedRoadType} · {insights.model.replace('claude-', '').replace(/-\d+$/, '')}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}


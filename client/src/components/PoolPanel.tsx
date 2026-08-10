/**
 * POOL PANEL
 * ==========
 * The Community pool told as a shape over time plus the viewer's share of it.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * The pool money model (D6) is an open decision and there is still no funding
 * path: addPoolContribution has no callers and completing a trip creates no
 * share. So this panel promises nothing in pounds. It shows share PERCENTAGE
 * and score points, which are real and computed today, and where the pool is
 * genuinely empty it says the pool is empty rather than drawing a curve
 * towards a number nobody has committed to.
 *
 * The history chart reads only archived periods. There were none before
 * Wave B, so an empty chart here is the truth, not a loading state.
 */
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, TrendingUp } from 'lucide-react';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { EmptyState, Skeleton } from '@/components/ui/EmptyState';
import { usePoolHistory, type PoolHistoryPoint } from '@/hooks/usePoolHistory';

interface PoolPanelProps {
  /** Live pool figures, already read by the caller. */
  activeParticipants: number;
  /** Null when no pool document exists. Same reason as safetyFactor. */
  averagePoolScore: number | null;
  /** Null when no pool document exists. Rendering 0% would be a measurement. */
  safetyFactor: number | null;
  /** The viewer's share of the pool as a percentage, 0-100. */
  userSharePercentage: number;
  /** The viewer's weighted score, the thing that actually sets their share. */
  userWeightedScore: number;
  loading?: boolean;
}

/** Turns "2026-02" into "Feb", which is all a dense axis has room for. */
function shortPeriod(period: string): string {
  const [, month] = period.split('-');
  const index = Number(month) - 1;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[index] ?? period;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PoolHistoryPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div
      className="px-3 py-2 text-[13px]"
      style={{
        borderRadius: 'var(--radius-md)',
        background: 'var(--app-surface-3)',
        border: '1px solid var(--app-border)',
        color: 'var(--app-text-pri)',
      }}
    >
      <div style={{ color: 'var(--app-text-hero)' }}>{point.period}</div>
      <div className="tabular">
        {point.activeParticipants.toLocaleString('en-GB')} drivers
      </div>
      <div className="tabular">avg score {point.averagePoolScore.toFixed(1)}</div>
    </div>
  );
}

export function PoolPanel({
  activeParticipants,
  averagePoolScore,
  safetyFactor,
  userSharePercentage,
  userWeightedScore,
  loading = false,
}: PoolPanelProps) {
  // usePoolHistory has always tracked a subscription error; nothing read it,
  // so a failed read rendered "No closed periods yet", which asserts the pool
  // has never finished a period. That is a claim about the product, made from
  // a read that failed.
  const { history, loading: historyLoading, error: historyError } = usePoolHistory();
  const reduce = useReducedMotion();

  // The chart plots participation, not money. Participation is real today;
  // pool value is not, while D6 is open.
  const series = useMemo(
    () => history.map((h) => ({ ...h, label: shortPeriod(h.period) })),
    [history],
  );

  return (
    <section
      className="p-5 mb-4"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--app-surface-1)',
        border: '1px solid var(--app-border)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px]" style={{ color: 'var(--app-text-hero)' }}>
          Community pool
        </h2>
        <Users className="w-5 h-5" style={{ color: 'var(--app-primary-text)' }} aria-hidden="true" />
      </div>

      {/* The viewer's standing in the pool: share and the score that sets it. */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div
          className="p-3"
          style={{
            borderRadius: 'var(--radius-md)',
            background: 'var(--app-surface-2)',
          }}
        >
          <span className="stat-label">Your share</span>
          <div className="mt-1">
            {loading ? (
              <Skeleton className="h-7 w-16" style={{ borderRadius: 6 }} />
            ) : (
              <span className="text-[24px]" style={{ color: 'var(--app-text-hero)' }}>
                <AnimatedNumber value={userSharePercentage} decimals={2} suffix="%" />
              </span>
            )}
          </div>
        </div>

        <div
          className="p-3"
          style={{
            borderRadius: 'var(--radius-md)',
            background: 'var(--app-surface-2)',
          }}
        >
          <span className="stat-label">Your points</span>
          <div className="mt-1">
            {loading ? (
              <Skeleton className="h-7 w-16" style={{ borderRadius: 6 }} />
            ) : (
              <span className="text-[24px]" style={{ color: 'var(--app-text-hero)' }}>
                <AnimatedNumber value={userWeightedScore} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live pool figures */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[14px]" style={{ color: 'var(--app-text-sec)' }}>
          Drivers in the pool
        </span>
        <span className="text-[14px] tabular" style={{ color: 'var(--app-text-pri)' }}>
          {activeParticipants.toLocaleString('en-GB')}
        </span>
      </div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[14px]" style={{ color: 'var(--app-text-sec)' }}>
          Average score
        </span>
        <span className="text-[14px] tabular" style={{ color: 'var(--app-text-pri)' }}>
          {averagePoolScore != null ? averagePoolScore.toFixed(1) : 'No data'}
        </span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[14px]" style={{ color: 'var(--app-text-sec)' }}>
          Safety factor
        </span>
        <span className="text-[14px] tabular" style={{ color: 'var(--app-text-pri)' }}>
          {safetyFactor != null ? `${Math.round(safetyFactor * 100)}%` : 'No data'}
        </span>
      </div>

      {/* History */}
      <div>
        <span className="stat-label">Pool over time</span>
        {historyLoading ? (
          <Skeleton className="h-[140px] w-full mt-2" style={{ borderRadius: 'var(--radius-md)' }} />
        ) : historyError ? (
          <EmptyState
            tone="error"
            icon={<TrendingUp size={24} strokeWidth={2} />}
            heading="The pool history did not load"
            subtext="We could not read the closed periods, so we cannot draw the trend. This is a read problem, not an empty pool."
          />
        ) : series.length < 2 ? (
          <EmptyState
            icon={<TrendingUp size={24} strokeWidth={2} />}
            heading="No closed periods yet"
            subtext="The pool is archived when each period finishes. Once two have closed, the trend appears here."
          />
        ) : (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2 h-[140px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--app-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--app-text-mut)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--app-text-mut)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--app-border)' }} />
                <Line
                  type="monotone"
                  dataKey="activeParticipants"
                  stroke="var(--app-primary)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!reduce}
                  animationDuration={450}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>
    </section>
  );
}

export default PoolPanel;

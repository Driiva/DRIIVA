/**
 * BetaEstimateCard
 * ----------------
 * Shows non-binding premium range, estimated refund, and net cost.
 * For beta UX only; later replaced by real Root/MGA quotes.
 */

import { Info, RefreshCw, Loader2 } from 'lucide-react';
import type { BetaEstimateDocument } from '../../../shared/firestore-types';

export interface BetaEstimateCardProps {
  estimate: BetaEstimateDocument | null;
  loading?: boolean;
  error?: Error | null;
  onRefresh?: () => void | Promise<void>;
}

function formatPounds(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function BetaEstimateCard({
  estimate,
  loading = false,
  error = null,
  onRefresh,
}: BetaEstimateCardProps) {
  if (loading) {
    return (
      <div className="dashboard-glass-card mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Beta Estimate</h3>
          <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-3/4 bg-white/10 rounded" />
          <div className="h-4 w-1/2 bg-white/10 rounded" />
          <div className="h-4 w-1/3 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-glass-card mb-4 border border-amber-500/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-white">Beta Estimate</h3>
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/70"
              title="Refresh estimate"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-amber-200/90">{error.message}</p>
        <p className="text-xs text-white/50 mt-2">
          Add your age and postcode in Profile to see an estimate.
        </p>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="dashboard-glass-card mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-white">Beta Estimate</h3>
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/70"
              title="Generate estimate"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-white/70">No estimate yet.</p>
        <p className="text-xs text-white/50 mt-1">
          Add age and postcode in Profile, then refresh.
        </p>
      </div>
    );
  }

  const {
    estimatedPremium,
    minPremium,
    maxPremium,
    estimatedRefund,
    estimatedNetCost,
    refundRate,
  } = estimate;

  const refundPercent = (refundRate * 100).toFixed(1);

  return (
    <div className="dashboard-glass-card mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Beta Estimate</h3>
        {onRefresh && (
          <button
            type="button"
            onClick={() => onRefresh()}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/70"
            title="Refresh estimate"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-white/50 mb-0.5">Estimated premium</p>
          <p className="text-xl font-semibold text-white">
            {formatPounds(estimatedPremium)}
            <span className="text-sm font-normal text-white/70 ml-1">
              (range {formatPounds(minPremium)}–{formatPounds(maxPremium)})
            </span>
          </p>
        </div>

        <div>
          <p className="text-xs text-white/50 mb-0.5">Estimated refund</p>
          <p className="text-lg font-semibold text-emerald-400">
            {formatPounds(estimatedRefund)}/year
            {Number(refundPercent) > 0 && (
              <span className="text-sm font-normal text-white/60 ml-1">
                ({refundPercent}%)
              </span>
            )}
          </p>
        </div>

        <div>
          <p className="text-xs text-white/50 mb-0.5">Estimated net cost after refund</p>
          <p className="text-lg font-semibold text-white">
            {formatPounds(estimatedNetCost)}/year
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/10 flex items-start gap-2">
        <Info className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
        <p className="text-xs text-white/50 leading-relaxed">
          Beta estimate only. Not a final insurance quote. Final pricing will be
          provided by our authorised partners.
        </p>
      </div>
    </div>
  );
}

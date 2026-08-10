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
      <div className="instrument-card mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Beta estimate</h3>
          <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
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
      <div className="instrument-card mb-4 border border-amber-500/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-white">Beta estimate</h3>
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/70"
              aria-label="Refresh estimate"
              title="Refresh estimate"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-amber-200/90">{error.message}</p>
        <p className="text-xs text-white/60 mt-2">
          Add your age and postcode in Profile to see an estimate.
        </p>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="instrument-card mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-white">Beta estimate</h3>
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/70"
              aria-label="More information"
              title="Generate estimate"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-white/70">No estimate yet.</p>
        <p className="text-xs text-white/60 mt-1">
          Add age and postcode in Profile, then refresh.
        </p>
      </div>
    );
  }

  const { estimatedPremium, minPremium, maxPremium } = estimate;

  return (
    <div className="instrument-card mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Beta estimate</h3>
        {onRefresh && (
          <button
            type="button"
            onClick={() => onRefresh()}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/70"
              aria-label="More information"
            title="Refresh estimate"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-white/60 mb-0.5">Estimated premium</p>
          <p className="text-xl font-semibold text-white">
            {formatPounds(estimatedPremium)}
            <span className="text-sm font-normal text-white/70 ml-1">
              (range {formatPounds(minPremium)}–{formatPounds(maxPremium)})
            </span>
          </p>
        </div>

        {/*
          WAVE H: this card also showed "Estimated refund £X/year" in green and
          "Estimated net cost after refund". Both are computed from a refund
          rate that takes the Community pool's safety factor as an input, and
          the pool has no funding path at all: addPoolContribution has never had
          a caller, and when the pool document is missing the safety factor
          silently defaults to 0.5. So the green number was a share of money
          nobody has contributed, and the net cost told the driver what
          insurance would cost them after a refund that cannot be paid.

          The same rule the mobile dashboard and the marketing pool section now
          follow applies here: no pounds figure for a pool refund while the
          money model is undecided. The premium estimate stays, because it is
          an estimate of something that will exist.
        */}
        <p className="text-xs text-white/60 leading-relaxed">
          Refunds depend on the Community pool, which is not funded yet, so
          there is no refund figure to show.
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-white/10 flex items-start gap-2">
        <Info className="w-4 h-4 text-white/60 shrink-0 mt-0.5" />
        <p className="text-xs text-white/60 leading-relaxed">
          Beta estimate only, produced by Driiva's own model. It is not a quote
          and nobody has underwritten it. Real pricing needs an insurer, and
          Driiva is pending FCA authorisation.
        </p>
      </div>
    </div>
  );
}

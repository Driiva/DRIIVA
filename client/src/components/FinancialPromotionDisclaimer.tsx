/**
 * FCA-compliant financial promotion disclaimer.
 * Append to any UI surface that mentions refund percentages.
 *
 * Set at body size. It used to render at 10px in 40% white, which is fine
 * print in the pejorative sense: a promotion whose qualification cannot
 * comfortably be read is not qualified. Wording is unchanged.
 */

interface FinancialPromotionDisclaimerProps {
  className?: string;
}

export function FinancialPromotionDisclaimer({ className = '' }: FinancialPromotionDisclaimerProps) {
  return (
    <p className={`text-white/55 text-[15px] leading-relaxed ${className}`}>
      Refund projections are illustrative. Actual amounts depend on pool
      performance, claims experience, and underwriting criteria.
    </p>
  );
}

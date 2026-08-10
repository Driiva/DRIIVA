import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Info } from "lucide-react";
import { GlassCard } from './GlassCard';
import { FinancialPromotionDisclaimer } from './FinancialPromotionDisclaimer';

interface RefundSimulatorProps {
  currentScore: number;
  premiumAmount: number;
  poolSafetyFactor: number;
}

export default function RefundSimulator({ 
  currentScore, 
  premiumAmount, 
  poolSafetyFactor 
}: RefundSimulatorProps) {
  const [simulatedScore, setSimulatedScore] = useState(currentScore);
  const { toast } = useToast();

  const calculateRefund = (score: number): string => {
    if (score < 70) return "0.00";
    const scoreRange = Math.max(0, score - 70);
    const baseRefund = 5;
    const additionalRefund = (scoreRange / 30) * 10;
    const refundPercentage = Math.min(15, baseRefund + additionalRefund);
    const refundAmount = (premiumAmount * refundPercentage) / 100;
    return refundAmount.toFixed(2);
  };

  const currentRefund = calculateRefund(currentScore);
  const simulatedRefund = calculateRefund(simulatedScore);
  const improvement = Math.max(0, Number(simulatedRefund) - Number(currentRefund));

  const getEligibilityMessage = (score: number): string => {
    if (score < 70) {
      return "Need 70+ score to qualify for refunds";
    }
    const percentile = Math.round(((score - 70) / 30) * 100);
    return `Eligible for refunds (${percentile}% towards max)`;
  };

  return (
    <section>
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-2 text-white">
            <Calculator className="w-5 h-5 text-white/60" />
            Refund Simulator
          </h3>
          <button
            onClick={() => toast({
              title: "Refund Calculator",
              description: "Adjust the score slider to see how improvements could increase your refund. Scores 70+ qualify for refunds up to 15%.",
            })}
            className="min-h-[44px] px-3 text-xs text-white/60 hover:text-white/70 hover:bg-white/5 rounded-xl transition-all duration-200 ease-out flex items-center gap-1"
          >
            <Info className="w-3.5 h-3.5" />
            £{premiumAmount.toLocaleString('en-GB')}
          </button>
        </div>

        <div className="space-y-5">
          {/* Current Score Display */}
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-white/60 mb-1">Current Score</div>
                <div className={`text-xl font-semibold ${currentScore >= 70 ? 'text-emerald-400' : 'text-white'}`}>
                  {currentScore}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/60 mb-1">Current Refund</div>
                <div className="text-xl font-semibold text-emerald-400">
                  £{currentRefund}
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-white/60">
              {getEligibilityMessage(currentScore)}
            </div>
          </div>

          {/* Score Slider */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-white">Simulate Score</label>
              <span className={`text-sm font-semibold ${simulatedScore >= 70 ? 'text-emerald-400' : 'text-white/70'}`}>
                {simulatedScore}
              </span>
            </div>
            <div className="px-1">
              <Slider
                value={[simulatedScore]}
                onValueChange={(value) => setSimulatedScore(value[0])}
                max={100}
                min={50}
                step={1}
                className="w-full [&_[role=slider]]:w-5 [&_[role=slider]]:h-5 [&_[role=slider]]:bg-emerald-400 [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_[role=slider]]:shadow-lg [&_[role=slider]]:cursor-grab [&_[role=slider]]:active:cursor-grabbing [&_[role=slider]]:transition-transform [&_[role=slider]]:duration-200 [&_[role=slider]]:hover:scale-110 [&_[data-orientation=horizontal]]:h-2 [&_[data-orientation=horizontal]]:bg-white/10 [&_[data-orientation=horizontal]]:rounded-full"
              />
            </div>
            <div className="flex justify-between text-xs text-white/60 mt-2">
              <span>50</span>
              <span className="text-emerald-400/70">70 (Min)</span>
              <span>100</span>
            </div>
          </div>

          {/* Simulation Results */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-white/60 mb-1">Potential Refund</div>
                <div className="text-2xl font-semibold text-emerald-400">
                  £{simulatedRefund}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/60 mb-1">Improvement</div>
                <div className={`text-lg font-semibold ${
                  improvement > 0 ? 'text-emerald-400' : 'text-white/60'
                }`}>
                  {improvement > 0 ? `+£${improvement.toFixed(2)}` : '£0.00'}
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-white/60">
              {simulatedScore < 70 ? 
                "Score must be 70+ to qualify for refunds" :
                `Refund rate: ${(((simulatedScore - 70) / 30) * 10 + 5).toFixed(1)}% of premium`
              }
            </div>
          </div>

          {/* Improvement Tips */}
          {improvement > 0 && (
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="text-xs text-emerald-400 font-medium mb-2">
                Tips to achieve this score:
              </div>
              <div className="text-xs text-white/60 space-y-1.5">
                {simulatedScore > currentScore + 10 && (
                  <div>• Reduce hard braking events by 50%</div>
                )}
                {simulatedScore > currentScore + 5 && (
                  <div>• Maintain consistent speeds</div>
                )}
                <div>• Avoid night driving when possible</div>
                <div>• Take smoother corners</div>
              </div>
            </div>
          )}
        </div>
        <FinancialPromotionDisclaimer className="mt-4" />
      </GlassCard>
    </section>
  );
}

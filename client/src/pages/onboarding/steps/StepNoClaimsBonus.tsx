import { motion } from 'framer-motion';
import { Shield, ChevronRight } from 'lucide-react';
import type { OnboardingStepProps } from '../types';

interface StepNoClaimsBonusProps extends OnboardingStepProps {
  noClaimsYears: number | null;
  setNoClaimsYears: (value: number) => void;
}

export function StepNoClaimsBonus({
  nextStep,
  prevStep,
  noClaimsYears,
  setNoClaimsYears,
}: StepNoClaimsBonusProps) {
  return (
    <motion.div
      key="step7-ncb"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#5b4dc9]/20 to-[#5b4dc9]/20 flex items-center justify-center">
        <Shield className="w-12 h-12 text-[#818cf8]" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-3">No-Claims Bonus</h1>
      <p className="text-white/60 mb-8 max-w-sm mx-auto">
        How many years of no-claims bonus do you have? Each year reduces your premium.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[0, 1, 2, 3, 4, 5].map((years) => (
          <button
            key={years}
            onClick={() => setNoClaimsYears(years)}
            className={`py-4 rounded-xl text-sm font-semibold transition-all border ${
              noClaimsYears === years
                ? 'bg-[#5b4dc9]/20 border-[#818cf8]/60 text-[#a5b4fc]'
                : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="block text-xl font-bold mb-0.5">{years === 5 ? '5+' : years}</span>
            <span className="text-xs opacity-70">{years === 0 ? 'none' : years === 1 ? 'year' : 'years'}</span>
          </button>
        ))}
      </div>

      {noClaimsYears !== null && noClaimsYears > 0 && (
        <p className="text-[#818cf8] text-sm mb-6">
          {Math.min(noClaimsYears * 10, 50)}% NCB discount applied to your quote
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={prevStep}
          className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold py-4 rounded-xl transition-colors"
        >
          Back
        </button>
        <button
          onClick={nextStep}
          className="flex-1 bg-[#5b4dc9] hover:bg-[#4d40b3] text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {noClaimsYears !== null ? 'Continue' : 'Skip'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

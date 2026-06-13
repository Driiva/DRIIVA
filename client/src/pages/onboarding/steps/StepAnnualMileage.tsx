import { motion } from 'framer-motion';
import { Car, ChevronRight } from 'lucide-react';
import type { OnboardingStepProps } from '../types';

interface StepAnnualMileageProps extends OnboardingStepProps {
  annualMileage: string;
  setAnnualMileage: (value: string) => void;
}

export function StepAnnualMileage({
  nextStep,
  prevStep,
  annualMileage,
  setAnnualMileage,
}: StepAnnualMileageProps) {
  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#5b4dc9]/20 to-[#5b4dc9]/20 flex items-center justify-center">
        <Car className="w-12 h-12 text-[#818cf8]" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-3">How much do you drive?</h1>
      <p className="text-white/60 mb-8 max-w-sm mx-auto">
        This helps us personalise your insurance estimate.
      </p>

      <div className="grid grid-cols-1 gap-3 mb-8">
        {['Under 5,000', '5,000\u201310,000', '10,000\u201315,000', '15,000+', 'Not sure'].map((option) => (
          <button
            key={option}
            onClick={() => setAnnualMileage(option)}
            className={`w-full py-3.5 px-4 rounded-xl text-sm font-medium text-left transition-all border ${
              annualMileage === option
                ? 'bg-[#5b4dc9]/20 border-[#818cf8]/60 text-[#a5b4fc]'
                : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {option} miles/year
          </button>
        ))}
      </div>

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
          {annualMileage ? 'Continue' : 'Skip'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

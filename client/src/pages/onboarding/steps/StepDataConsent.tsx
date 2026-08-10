import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Check, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import type { OnboardingStepProps } from '../types';

interface StepDataConsentProps extends OnboardingStepProps {
  dataConsentGiven: boolean;
  setDataConsentGiven: (value: boolean) => void;
  persistDataConsent: () => Promise<boolean>;
}

export function StepDataConsent({
  nextStep,
  prevStep,
  dataConsentGiven,
  setDataConsentGiven,
  persistDataConsent,
}: StepDataConsentProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Only advance once consent is safely persisted. If the write fails we keep
  // the user here and surface a toast rather than progressing on a silent error.
  const handleContinue = async () => {
    setSaving(true);
    const ok = await persistDataConsent();
    setSaving(false);
    if (!ok) {
      toast({
        title: "Couldn't save your consent",
        description: 'Something went wrong. Check your connection and try again.',
        variant: 'destructive',
      });
      return;
    }
    nextStep();
  };

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#5b4dc9]/20 to-[#5b4dc9]/20 flex items-center justify-center">
        <Shield className="w-12 h-12 text-[#818cf8]" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-3">Your Data, Your Control</h1>
      <p className="text-white/60 mb-6 max-w-sm mx-auto">
        Before we begin, here's exactly what Driiva collects and why.
      </p>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 mb-5 text-left">
        <h3 className="text-white font-medium mb-3 text-sm">What we collect</h3>
        <ul className="space-y-2.5">
          {[
            { label: 'GPS location', detail: 'During active trips only' },
            { label: 'Accelerometer & gyroscope', detail: 'Braking, acceleration, cornering' },
            { label: 'Speed & heading', detail: 'Safety scoring & route context' },
            { label: 'Trip metadata', detail: 'Start/end time, duration, distance' },
          ].map((item) => (
            <li key={item.label} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#818cf8] mt-1.5 flex-shrink-0" />
              <div>
                <span className="text-white text-sm">{item.label}</span>
                <span className="text-white/60 text-sm"> — {item.detail}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-[#a5b4fc] font-medium">Retention</div>
            <div className="text-white/60 text-xs">Raw GPS: 90 days rolling</div>
            <div className="text-white/60 text-xs">Scores: policy lifetime</div>
          </div>
          <div>
            <div className="text-xs text-[#a5b4fc] font-medium">Who sees it</div>
            <div className="text-white/60 text-xs">Driiva + underwriting partner</div>
            <div className="text-white/60 text-xs">Never sold to third parties</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setLocation('/trust')}
        className="text-[#818cf8] hover:text-[#a5b4fc] text-xs font-medium mb-5 block mx-auto"
      >
        Read full Trust Centre →
      </button>

      <label className="flex items-start gap-3 cursor-pointer mb-6 text-left bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={dataConsentGiven}
            onChange={(e) => setDataConsentGiven(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
            dataConsentGiven
              ? 'bg-[#5b4dc9] border-[#5b4dc9]'
              : 'border-white/30 bg-transparent hover:border-white/50'
          }`}>
            {dataConsentGiven && <Check className="w-4 h-4 text-white" />}
          </div>
        </div>
        <span className="text-white/80 text-sm">
          I consent to Driiva collecting my driving data as described above for the purpose of calculating my driving score and insurance pricing.
        </span>
      </label>

      <div className="flex gap-3">
        <button
          onClick={prevStep}
          className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold py-4 rounded-xl transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!dataConsentGiven || saving}
          className={`flex-1 font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 ${
            dataConsentGiven && !saving
              ? 'bg-[#5b4dc9] hover:bg-[#4d40b3] text-white'
              : 'bg-white/10 text-white/60 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : 'Continue'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

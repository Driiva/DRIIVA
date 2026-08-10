import { motion } from 'framer-motion';
import { MapPin, Check, Loader2, Navigation, AlertCircle, ChevronRight } from 'lucide-react';
import type { OnboardingStepProps, GpsTestResult } from '../types';

interface StepGpsPermissionProps extends OnboardingStepProps {
  gpsStatus: 'idle' | 'testing' | 'success' | 'error';
  gpsResult: GpsTestResult | null;
  testGpsPermission: () => void;
}

export function StepGpsPermission({
  nextStep,
  prevStep,
  gpsStatus,
  gpsResult,
  testGpsPermission,
}: StepGpsPermissionProps) {
  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#5b4dc9]/20 to-[#5b4dc9]/20 flex items-center justify-center">
        <MapPin className="w-12 h-12 text-[#818cf8]" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-3">Enable location access</h1>
      <p className="text-white/60 mb-8 max-w-sm mx-auto">
        Driiva uses GPS to track your trips and calculate your safety score.
        Your location data is encrypted and never sold.
      </p>

      {/* GPS Test Result */}
      {gpsStatus === 'idle' && (
        <button
          onClick={testGpsPermission}
          className="w-full bg-[#5b4dc9] hover:bg-[#4d40b3] text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 mb-4"
        >
          <Navigation className="w-5 h-5" />
          Test Location Access
        </button>
      )}

      {gpsStatus === 'testing' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-4">
          <Loader2 className="w-8 h-8 text-[#818cf8] animate-spin mx-auto mb-3" />
          <p className="text-white/60">Testing GPS access...</p>
        </div>
      )}

      {gpsStatus === 'success' && gpsResult && (
        <div className="bg-[#5b4dc9]/10 border border-[#5b4dc9]/30 rounded-xl p-6 mb-4">
          <div className="flex items-center justify-center gap-2 text-[#818cf8] mb-3">
            <Check className="w-6 h-6" />
            <span className="font-medium">GPS Working!</span>
          </div>
          <p className="text-white/60 text-sm">
            Location detected with {gpsResult.accuracy}m accuracy
          </p>
        </div>
      )}

      {gpsStatus === 'error' && gpsResult && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-4">
          <div className="flex items-center justify-center gap-2 text-amber-400 mb-3">
            <AlertCircle className="w-6 h-6" />
            <span className="font-medium">GPS Issue</span>
          </div>
          <p className="text-white/60 text-sm mb-4">{gpsResult.error}</p>
          <button
            onClick={testGpsPermission}
            className="text-[#818cf8] hover:text-[#a5b4fc] text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      <p className="text-white/60 text-xs mb-6">
        You can continue without GPS, but trip tracking will be limited.
      </p>

      {/* Navigation buttons */}
      <div className="flex gap-3">
        <button
          onClick={prevStep}
          className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold py-4 rounded-xl transition-colors"
        >
          Back
        </button>
        <button
          onClick={nextStep}
          className={`flex-1 font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 ${
            gpsStatus === 'success'
              ? 'bg-[#5b4dc9] hover:bg-[#4d40b3] text-white'
              : 'bg-white/10 hover:bg-white/15 text-white/80'
          }`}
        >
          Continue
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

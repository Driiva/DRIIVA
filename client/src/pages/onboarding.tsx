import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import { auth, db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

const TOTAL_STEPS = 4;

interface FormData {
  fullName: string;
  dateOfBirth: string;
  phone: string;
  vehicleRegistration: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  yearsDriving: string;
  claimsLast5Years: string;
  annualMileage: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user: authUser, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    dateOfBirth: "",
    phone: "",
    vehicleRegistration: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: "",
    yearsDriving: "",
    claimsLast5Years: "0",
    annualMileage: "",
    acceptTerms: false,
    acceptPrivacy: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      setLocation("/signin");
    }
  }, [authUser, authLoading, setLocation]);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isStep1Valid = () => {
    return formData.fullName.trim() !== "" && formData.dateOfBirth !== "";
  };

  const isStep2Valid = () => {
    return (
      formData.vehicleRegistration.trim() !== "" &&
      formData.vehicleMake.trim() !== "" &&
      formData.vehicleModel.trim() !== "" &&
      formData.vehicleYear !== ""
    );
  };

  const isStep3Valid = () => {
    return (
      formData.yearsDriving !== "" &&
      formData.annualMileage !== ""
    );
  };

  const isStep4Valid = () => {
    return formData.acceptTerms && formData.acceptPrivacy;
  };

  const isCurrentStepValid = () => {
    switch (currentStep) {
      case 1: return isStep1Valid();
      case 2: return isStep2Valid();
      case 3: return isStep3Valid();
      case 4: return isStep4Valid();
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS && isCurrentStepValid()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isStep4Valid()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const user = auth?.currentUser;

      if (!user) {
        setLocation("/signin");
        return;
      }

      if (!db) throw new Error('Firestore not initialized');
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth,
        phone: formData.phone,
        vehicleRegistration: formData.vehicleRegistration.toUpperCase(),
        vehicleMake: formData.vehicleMake,
        vehicleModel: formData.vehicleModel,
        vehicleYear: parseInt(formData.vehicleYear),
        yearsDriving: parseInt(formData.yearsDriving),
        claimsLast5Years: parseInt(formData.claimsLast5Years),
        annualMileage: parseInt(formData.annualMileage),
        termsAccepted: true,
        privacyAccepted: true,
        onboardingComplete: true,
        updatedAt: new Date().toISOString(),
      });

      setLocation("/dashboard");
    } catch (err) {
      console.error("Onboarding error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1999 }, (_, i) => currentYear - i);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 flex items-center justify-center">
        <div className="relative z-10">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 flex flex-col relative">
      
      <div className="relative z-10 flex-1 flex flex-col p-6 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`w-8 h-1 rounded-full transition-colors ${
                  i + 1 <= currentStep ? "bg-emerald-500" : "bg-white/20"
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-white/60">Step {currentStep} of {TOTAL_STEPS}</span>
        </div>

        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex-1"
              >
                <h1 className="text-2xl font-bold text-white mt-1 mb-1">Personal Details</h1>
                <p className="text-white/60 mt-0 mb-6">Tell us a bit about yourself</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => updateField("fullName", e.target.value)}
                      className="onboarding-input"
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => updateField("dateOfBirth", e.target.value)}
                      className="onboarding-input"
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 17)).toISOString().split('T')[0]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className="onboarding-input"
                      placeholder="+44 7700 900000"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex-1"
              >
                <h1 className="text-2xl font-bold text-white mt-1 mb-1">Vehicle Details</h1>
                <p className="text-white/60 mt-0 mb-6">Tell us about your car</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Vehicle Registration *
                    </label>
                    <input
                      type="text"
                      value={formData.vehicleRegistration}
                      onChange={(e) => updateField("vehicleRegistration", e.target.value.toUpperCase())}
                      className="onboarding-input uppercase"
                      placeholder="AB12 CDE"
                      maxLength={8}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Make *
                    </label>
                    <input
                      type="text"
                      value={formData.vehicleMake}
                      onChange={(e) => updateField("vehicleMake", e.target.value)}
                      className="onboarding-input"
                      placeholder="Toyota"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Model *
                    </label>
                    <input
                      type="text"
                      value={formData.vehicleModel}
                      onChange={(e) => updateField("vehicleModel", e.target.value)}
                      className="onboarding-input"
                      placeholder="Corolla"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Year *
                    </label>
                    <select
                      value={formData.vehicleYear}
                      onChange={(e) => updateField("vehicleYear", e.target.value)}
                      className="onboarding-input"
                    >
                      <option value="">Select year</option>
                      {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex-1"
              >
                <h1 className="text-2xl font-bold text-white mt-1 mb-1">Driving History</h1>
                <p className="text-white/60 mt-0 mb-6">Help us understand your experience</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Years Driving *
                    </label>
                    <input
                      type="number"
                      value={formData.yearsDriving}
                      onChange={(e) => updateField("yearsDriving", e.target.value)}
                      className="onboarding-input"
                      placeholder="5"
                      min="0"
                      max="80"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Claims in Last 5 Years
                    </label>
                    <input
                      type="number"
                      value={formData.claimsLast5Years}
                      onChange={(e) => updateField("claimsLast5Years", e.target.value)}
                      className="onboarding-input"
                      placeholder="0"
                      min="0"
                      max="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Estimated Annual Mileage *
                    </label>
                    <input
                      type="number"
                      value={formData.annualMileage}
                      onChange={(e) => updateField("annualMileage", e.target.value)}
                      className="onboarding-input"
                      placeholder="10000"
                      min="0"
                      max="100000"
                    />
                    <p className="text-white/40 text-xs mt-1">Average UK driver: 7,400 miles/year</p>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex-1"
              >
                <h1 className="text-2xl font-bold text-white mt-1 mb-1">Terms & Conditions</h1>
                <p className="text-white/60 mt-0 mb-6">Please review and accept to continue</p>

                {error && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative mt-1">
                      <input
                        type="checkbox"
                        checked={formData.acceptTerms}
                        onChange={(e) => updateField("acceptTerms", e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                        formData.acceptTerms 
                          ? "bg-emerald-500 border-emerald-500" 
                          : "border-white/30 bg-transparent"
                      }`}>
                        {formData.acceptTerms && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                    <span className="text-white/80 text-sm">
                      I accept the <a href="#" className="text-emerald-400 underline">Terms and Conditions</a> *
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative mt-1">
                      <input
                        type="checkbox"
                        checked={formData.acceptPrivacy}
                        onChange={(e) => updateField("acceptPrivacy", e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                        formData.acceptPrivacy 
                          ? "bg-emerald-500 border-emerald-500" 
                          : "border-white/30 bg-transparent"
                      }`}>
                        {formData.acceptPrivacy && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                    <span className="text-white/80 text-sm">
                      I accept the <a href="#" className="text-emerald-400 underline">Privacy Policy</a> *
                    </span>
                  </label>
                </div>

                <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-white/60 text-sm">
                    By completing signup, you agree to allow Driiva to track your driving behavior 
                    to calculate your safety score and potential refund. Your data is encrypted and 
                    never sold to third parties.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex gap-3 mt-8 pb-6">
          {currentStep > 1 && (
            <button
              onClick={handleBack}
              disabled={isLoading}
              className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold 
                       py-4 rounded-xl transition-colors min-h-[56px] flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          )}

          {currentStep < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              disabled={!isCurrentStepValid()}
              className={`flex-1 font-semibold py-4 rounded-xl transition-colors min-h-[56px] 
                         flex items-center justify-center gap-2 ${
                isCurrentStepValid()
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              }`}
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!isCurrentStepValid() || isLoading}
              className={`flex-1 font-semibold py-4 rounded-xl transition-colors min-h-[56px] 
                         flex items-center justify-center gap-2 ${
                isCurrentStepValid() && !isLoading
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Complete Setup
                  <Check className="w-5 h-5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

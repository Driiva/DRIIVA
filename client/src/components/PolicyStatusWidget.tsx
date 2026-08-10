import { motion } from "framer-motion";
import { Shield, Calendar, CreditCard, FileText } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { GlassCard } from './GlassCard';
import { timing, easing, loopAnimations, microInteractions } from "@/lib/animations";

interface PolicyStatusWidgetProps {
  policyNumber?: string | null;
  status?: string;
  premiumAmount?: string;
  renewalDate?: string;
}

export default function PolicyStatusWidget({
  policyNumber,
  status = "Active",
  premiumAmount = "—",
  renewalDate = "—"
}: PolicyStatusWidgetProps) {
  const [isActive] = useState(status === "Active"); // Derive isActive from status prop
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const policyData = {
    policyNumber: policyNumber || "—",
    policyType: "Comprehensive Telematics", // Retained from original
    startDate: "Jul 01, 2025", // Retained from original
    renewalDate: renewalDate, // Use prop
    premiumAmount: premiumAmount, // Use prop
    status: status // Add status to policyData
  };

  return (
    <section>
      <GlassCard className="">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Policy Status</h3>
          <motion.button
            onClick={() => toast({
              title: "Policy Status",
              description: "Your policy is active and up to date. Next renewal: July 1, 2026",
            })}
            {...loopAnimations.pulse}
            whileTap={microInteractions.press}
            className={`px-4 py-2 min-h-[44px] rounded-xl font-semibold text-sm flex items-center ${isActive
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
          >
            <motion.div
              {...loopAnimations.glow}
              className={`w-2 h-2 rounded-full mr-2 ${isActive ? 'bg-emerald-400' : 'bg-red-400'
                }`}
            />
            {isActive ? 'Active' : 'Inactive'}
          </motion.button>
        </div>

        <div className="space-y-4">
          {/* Policy Type */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">{policyData.policyType}</div>
              <div className="text-xs text-white/60">Policy No: {policyData.policyNumber}</div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <div className="text-xs text-white/60">Start Date</div>
                <div className="text-sm font-medium text-white">{policyData.startDate}</div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <div className="text-xs text-white/60">Renewal Date</div>
                <div className="text-sm font-medium text-white">{policyData.renewalDate}</div>
              </div>
            </div>
          </div>

          {/* Premium */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Annual Premium</div>
                <div className="text-xs text-white/60">£{Number(policyData.premiumAmount).toLocaleString('en-GB')}</div>
              </div>
            </div>
            <motion.button
              onClick={() => setLocation('/policy')}
              whileHover={microInteractions.hover}
              whileTap={microInteractions.press}
              transition={{ duration: timing.quick }}
              className="px-4 py-2 min-h-[44px] bg-white/5 hover:bg-white/10 rounded-xl text-sm font-semibold text-white/80 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              View Details
            </motion.button>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}

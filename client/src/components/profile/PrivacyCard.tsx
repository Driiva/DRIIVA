/**
 * The privacy and data card: the Trust Centre link, the GDPR export and the
 * account deletion. Extracted verbatim from client/src/pages/profile.tsx.
 */
import { ChevronDown, Shield } from "lucide-react";

import ExportDataButton from "@/components/ExportDataButton";
import DeleteAccount from "@/components/DeleteAccount";

interface PrivacyCardProps {
  userId: string;
  setLocation: (path: string) => void;
}

export function PrivacyCard({ userId, setLocation }: PrivacyCardProps) {
  return (
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span>🔒</span>
            Privacy & Data
          </h3>

          <p className="text-xs text-white/60 mb-3">
            Your data is used only for your score and refund. We don't sell it. Trip data is encrypted in transit and at rest.
          </p>

          <button
            onClick={() => setLocation('/trust')}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors mb-3"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Trust Centre</p>
                <p className="text-xs text-white/60">FCA · GDPR · Your Rights</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-indigo-300 -rotate-90" />
          </button>

          <div className="space-y-3">
            <ExportDataButton userId={userId} />
            <div className="border-t border-white/5 pt-3">
              <DeleteAccount userId={userId} />
            </div>
          </div>
        </div>
  );
}

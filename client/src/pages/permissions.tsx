import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { timing, easing, microInteractions } from "@/lib/animations";

export default function Permissions() {
  const [, setLocation] = useLocation();

  const handleRequestPermissions = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-between p-6">
      {/* Skip button */}
      <div className="w-full flex justify-end">
        <motion.button
          onClick={() => setLocation("/dashboard")}
          whileTap={microInteractions.tap}
          transition={{ duration: timing.quick / 1000 }}
          className="text-white/60 hover:text-white transition-colors min-h-[44px] px-4"
        >
          Skip for now
        </motion.button>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: timing.pageTransition / 1000, ease: easing.smoothDecel }}
        className="text-center max-w-sm"
      >
        <div className="w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 
                      rounded-full flex items-center justify-center mx-auto mb-8
                      border-4 border-emerald-500/30">
          <span className="text-6xl">📍</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Enable location access
        </h1>
        <p className="text-white/60 text-lg mb-8">
          Driiva needs location access to track your trips and calculate your safety score accurately.
        </p>

        {/* Permission cards */}
        <div className="space-y-3 mb-8">
          <PermissionCard
            icon="🚗"
            title="Automatic Trip Detection"
            description="No need to manually start/stop tracking"
          />
          <PermissionCard
            icon="📊"
            title="Accurate Scoring"
            description="Better data = fairer refund calculations"
          />
          <PermissionCard
            icon="🔔"
            title="Notifications"
            description="So we can tell you when your trip is scored and when your refund is ready"
          />
          <PermissionCard
            icon="🔒"
            title="Your Privacy Protected"
            description="Location data is encrypted and never sold. We don't track you 24/7."
          />
        </div>
      </motion.div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: timing.pageTransition / 1000, ease: easing.smoothDecel }}
        onClick={handleRequestPermissions}
        whileTap={microInteractions.tap}
        className="w-full max-w-sm bg-emerald-500 hover:bg-emerald-600 text-white 
                 font-semibold py-4 rounded-2xl transition-all mb-8
                 shadow-lg shadow-emerald-500/20 min-h-[56px]"
      >
        Enable Location Access
      </motion.button>
    </div>
  );
}

function PermissionCard({ icon, title, description }: { 
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <motion.div 
      className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] 
                rounded-xl p-3 flex items-start gap-3 text-left"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: timing.quick / 1000 }}
    >
      <div className="text-2xl">{icon}</div>
      <div>
        <h3 className="text-white font-medium text-sm mb-0.5">{title}</h3>
        <p className="text-xs text-white/60">{description}</p>
      </div>
    </motion.div>
  );
}

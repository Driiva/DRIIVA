/**
 * The two preference switches: location tracking and push notifications.
 * Extracted verbatim from client/src/pages/profile.tsx.
 */
import { motion } from "framer-motion";

import { timing, easing } from "@/lib/animations";

interface PreferencesCardProps {
  locationTracking: boolean;
  setLocationTracking: (next: boolean) => void;
  pushNotifications: boolean;
  setPushNotifications: (next: boolean) => void;
}

export function PreferencesCard({
  locationTracking,
  setLocationTracking,
  pushNotifications,
  setPushNotifications,
}: PreferencesCardProps) {
  return (
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span>⚙️</span>
            Preferences
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-2">
              <div>
                <div className="text-sm font-medium text-white">Location Tracking</div>
                <div className="text-xs text-white/60">Required for trip recording</div>
              </div>
              <motion.button
                onClick={() => setLocationTracking(!locationTracking)}
                role="switch"
                aria-checked={locationTracking}
                aria-label="Location tracking"
                className={`w-12 h-7 rounded-full transition-colors duration-200 relative ${locationTracking ? 'bg-emerald-500' : 'bg-white/20'
                  }`}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                  animate={{ left: locationTracking ? 24 : 4 }}
                  transition={{ duration: timing.interaction / 1000, ease: easing.button }}
                />
              </motion.button>
            </div>
            <div className="flex justify-between items-center py-2">
              <div>
                <div className="text-sm font-medium text-white">Push Notifications</div>
                <div className="text-xs text-white/60">Trip summaries and alerts</div>
              </div>
              <motion.button
                onClick={() => setPushNotifications(!pushNotifications)}
                role="switch"
                aria-checked={pushNotifications}
                aria-label="Push notifications"
                className={`w-12 h-7 rounded-full transition-colors duration-200 relative ${pushNotifications ? 'bg-emerald-500' : 'bg-white/20'
                  }`}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                  animate={{ left: pushNotifications ? 24 : 4 }}
                  transition={{ duration: timing.interaction / 1000, ease: easing.button }}
                />
              </motion.button>
            </div>
          </div>
        </div>
  );
}

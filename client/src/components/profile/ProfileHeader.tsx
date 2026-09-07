/**
 * Profile header: brand lockup, greeting, and the account dropdown carrying
 * the member ID and logout. Extracted verbatim from
 * client/src/pages/profile.tsx.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ChevronDown } from "lucide-react";

interface ProfileHeaderProps {
  greeting: string;
  greetingName: string;
  avatarInitial: string;
  memberId: string;
  showDropdown: boolean;
  setShowDropdown: (next: boolean) => void;
  handleLogout: () => void;
}

export function ProfileHeader({
  greeting,
  greetingName,
  avatarInitial,
  memberId,
  showDropdown,
  setShowDropdown,
  handleLogout,
}: ProfileHeaderProps) {
  return (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-start justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-700/30 border border-white/10 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Driiva" className="w-full h-full object-cover" />
            </div>
            <div style={{ marginTop: '2px' }}>
              <h1 className="text-xl font-bold text-white">Driiva</h1>
              <p className="text-sm text-white/60">{greeting}, {greetingName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
            <button className="p-2 rounded-full hover:bg-white/5 transition-colors" aria-label="Notifications">
              <Bell className="w-5 h-5 text-white/60" />
            </button>

            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{avatarInitial}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showDropdown && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowDropdown(false)}
                    className="fixed inset-0 z-40"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-12 right-0 w-56 z-50 backdrop-blur-2xl bg-[#1a1a2e]/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                  >
                    <div className="p-4">
                      <p className="text-xs text-white/60 mb-1">Member ID</p>
                      <p className="text-sm font-medium text-white">{memberId}</p>
                    </div>
                    <div className="border-t border-white/10">
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-white/5 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
  );
}

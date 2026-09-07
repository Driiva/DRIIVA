/**
 * Dashboard header: brand lockup, refresh, the notifications tray and the
 * account dropdown. Extracted verbatim from client/src/pages/dashboard.tsx;
 * the open/closed state stays on the page so the two trays keep closing each
 * other exactly as before.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ChevronDown, RefreshCw } from 'lucide-react';
import { DemoBadge } from '@/components/DemoBadge';

interface DashboardHeaderProps {
  isDemoMode: boolean;
  displayName: string;
  policyNumber: string | null;
  dataLoading: boolean;
  refresh: () => void;
  showDropdown: boolean;
  setShowDropdown: (next: boolean) => void;
  showNotifications: boolean;
  setShowNotifications: (next: boolean) => void;
  handleLogout: () => void;
}

export function DashboardHeader({
  isDemoMode,
  displayName,
  policyNumber,
  dataLoading,
  refresh,
  showDropdown,
  setShowDropdown,
  showNotifications,
  setShowNotifications,
  handleLogout,
}: DashboardHeaderProps) {
  return (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-start justify-between mb-6"
        >
          {/* Left side - Logo and greeting */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-700/30 border border-white/10 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Driiva" className="w-full h-full object-cover" />
            </div>
            <div style={{ marginTop: '2px' }}>
              <h1 className="text-xl font-bold text-white">Driiva</h1>
              <p className="text-sm text-white/60">Beta Programme</p>
              {isDemoMode && (
                <DemoBadge />
              )}
            </div>
          </div>

          {/* Right side - Bell, refresh, and avatar with dropdown */}
          <div className="flex items-center gap-2 relative">
            {!isDemoMode && (
              <button 
                onClick={refresh}
                className="p-2 rounded-full hover:bg-white/5 transition-colors"
                aria-label="Refresh dashboard data"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 text-white/60 ${dataLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowDropdown(false); }}
              className="p-2 rounded-full hover:bg-white/5 transition-colors"
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <Bell className="w-5 h-5 text-white/60" aria-hidden="true" />
            </button>
            
            <button 
              onClick={() => { setShowDropdown(!showDropdown); setShowNotifications(false); }}
              className="flex items-center gap-1"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {displayName[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowNotifications(false)}
                    className="fixed inset-0 z-40"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-12 right-0 w-[280px] z-50 backdrop-blur-2xl bg-[#1a1a2e]/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                  >
                    <div className="p-4 border-b border-white/10">
                      <h3 className="text-sm font-semibold text-white">Notifications</h3>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
                          <Bell className="w-5 h-5 text-white/60" />
                        </div>
                        <p className="text-sm text-white/70 mb-1">No new notifications</p>
                        <p className="text-xs text-white/60">We'll notify you when something happens</p>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Dropdown Menu */}
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
                      <p className="text-xs text-white/60 mb-1">Policy No:</p>
                      <p className="text-sm font-medium text-white">{policyNumber ?? '—'}</p>
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

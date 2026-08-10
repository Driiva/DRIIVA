import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ChevronDown } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLocation } from "wouter";
import { timing, easing, microInteractions } from "@/lib/animations";

interface DashboardHeaderProps {
  user?: {
    firstName?: string;
    lastName?: string;
    username: string;
    email: string;
    premiumAmount: string;
    policyNumber?: string | null;
  };
  policyNumber?: string | null;
  memberSince?: string;
}

export default function DashboardHeader({ user, policyNumber, memberSince }: DashboardHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { logout } = useAuth();
  const [location, setLocation] = useLocation();

  const isHomePage = location === '/dashboard';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const profileData = {
    name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Driver',
    email: user?.email || 'driver@driiva.co.uk',
    vehicle: "2023 Tesla Model 3",
    policyNumber: policyNumber || user?.policyNumber || '—',
    memberSince: memberSince || "January 2024"
  };

  const handleNavigate = (path: string) => {
    setMenuOpen(false);
    setLocation(path);
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    setLocation("/");
    await logout();
  };

  return (
    <>
      {/* Header - NO dropdown inside */}
      <div className="backdrop-blur-xl bg-[#1E293B]/40 border border-white/[0.05] 
                    rounded-2xl p-4 mb-6 mx-4 mt-4">
        <div className="flex items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setLocation('/dashboard')}
              whileTap={microInteractions.tap}
              className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-emerald-500/20 backdrop-blur-sm"
            >
              <img
                src="/logo.png"
                alt="Driiva"
                className="w-full h-full object-cover"
              />
            </motion.button>
            <div>
              <h1 className="text-xl font-semibold text-white">Driiva</h1>
              <p className="text-sm text-white/60">{getGreeting()}, {user?.firstName || user?.username || 'Driver'}</p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Bell - transparent */}
            <motion.button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setMenuOpen(false);
              }}
              whileTap={microInteractions.tap}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              className="p-2 text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
            </motion.button>

            {/* Profile - radial blur, no hover */}
            <motion.button
              onClick={() => {
                setMenuOpen(!menuOpen);
                setNotificationsOpen(false);
              }}
              whileTap={microInteractions.tap}
              className="flex items-center gap-1 min-h-[44px]"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold border-2 border-emerald-500/60"
                style={{
                  background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 70%, transparent 100%)',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.15), inset 0 0 20px rgba(16, 185, 129, 0.1)'
                }}
              >
                {profileData.name.charAt(0).toUpperCase()}
              </div>
              <motion.div
                animate={{ rotate: menuOpen ? 180 : 0 }}
                transition={{ duration: timing.interaction / 1000 }}
              >
                <ChevronDown className="w-4 h-4 text-white/60" />
              </motion.div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Notifications Dropdown - OUTSIDE header */}
      <AnimatePresence>
        {notificationsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotificationsOpen(false)}
              className="fixed inset-0 z-40"
            />

            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: easing.smoothDecel }}
              className="fixed top-24 right-4 w-[280px] z-50 
                       backdrop-blur-2xl bg-[#1E293B]/95 border border-white/[0.08] 
                       rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-white/[0.08]">
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

      {/* Profile Dropdown - OUTSIDE header */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40"
            />

            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: easing.smoothDecel }}
              className="fixed top-24 right-4 w-[280px] z-50 
                       backdrop-blur-2xl bg-[#1E293B]/95 border border-white/[0.08] 
                       rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold border-2 border-emerald-500/60"
                    style={{
                      background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 70%, transparent 100%)',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.15), inset 0 0 20px rgba(16, 185, 129, 0.1)'
                    }}
                  >
                    {profileData.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{profileData.name}</p>
                    <p className="text-xs text-white/60 truncate">{profileData.email}</p>
                  </div>
                </div>

                {!isHomePage && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-white/60">Vehicle</p>
                        <p className="text-white">{profileData.vehicle}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Policy</p>
                        <p className="text-white">{profileData.policyNumber}</p>
                      </div>
                    </div>

                    <div className="mt-2 px-2 py-1 bg-emerald-500/10 rounded-lg 
                                  flex items-center justify-between">
                      <span className="text-xs text-white/70">Member Since</span>
                      <span className="text-xs font-semibold text-emerald-400">{profileData.memberSince}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="p-2">
                <button
                  onClick={() => handleNavigate('/documents')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 
                           hover:bg-white/5 rounded-lg transition-colors text-left min-h-[44px]"
                >
                  <span className="text-white/70">📄</span>
                  <span className="text-sm text-white">Documents</span>
                </button>

                <button
                  onClick={() => handleNavigate('/profile')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 
                           hover:bg-white/5 rounded-lg transition-colors text-left min-h-[44px]"
                >
                  <span className="text-white/70">📊</span>
                  <span className="text-sm text-white">Export Data</span>
                </button>

                <button
                  onClick={() => handleNavigate('/support')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 
                           hover:bg-white/5 rounded-lg transition-colors text-left min-h-[44px]"
                >
                  <span className="text-white/70">💬</span>
                  <span className="text-sm text-white">Support</span>
                </button>

                <div className="h-px bg-white/[0.08] my-2" />

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 
                           hover:bg-red-500/10 rounded-lg transition-colors text-left min-h-[44px]"
                >
                  <span className="text-red-400">🚪</span>
                  <span className="text-sm text-red-400">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

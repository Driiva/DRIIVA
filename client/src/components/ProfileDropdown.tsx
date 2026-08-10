import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLocation } from "wouter";
import { timing, easing, microInteractions } from "@/lib/animations";

interface ProfileDropdownProps {
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

export default function ProfileDropdown({ user, policyNumber, memberSince }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();
  const [currentPath, navigate] = useLocation();

  const isHomePage = currentPath === '/' || currentPath === '/dashboard';

  const profileData = {
    name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Driver',
    vehicle: "2023 Tesla Model 3",
    policyNumber: policyNumber || user?.policyNumber || '—',
    email: user?.email || 'driver@driiva.co.uk',
    memberSince: memberSince || "January 2024"
  };

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    navigate("/");
    await logout();
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 p-1 min-h-[44px]"
        whileTap={microInteractions.tap}
        transition={{ duration: timing.quick / 1000 }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-emerald-500/60"
          style={{
            background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 70%, transparent 100%)',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.15), inset 0 0 20px rgba(16, 185, 129, 0.1)'
          }}
        >
          <span className="text-xs font-semibold text-white">
            {profileData.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: timing.interaction / 1000 }}
        >
          <ChevronDown className="w-4 h-4 text-white/60" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: easing.smoothDecel }}
              className="fixed top-14 right-4 w-[280px] z-50 
                       backdrop-blur-2xl bg-[#1E293B]/95 border border-white/[0.08] 
                       rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* User info section */}
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

                {/* Conditional: Only show policy details if NOT on home page */}
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

              {/* Menu items */}
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

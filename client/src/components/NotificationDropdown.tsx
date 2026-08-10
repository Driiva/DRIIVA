import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { timing, easing, microInteractions } from "@/lib/animations";

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileTap={microInteractions.tap}
        transition={{ duration: timing.quick / 1000 }}
        className="relative p-2 text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <Bell className="w-5 h-5" />
        {hasUnread && (
          <motion.div 
            className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />
            
            {/* Dropdown menu */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: easing.smoothDecel }}
              className="fixed top-14 right-4 w-[280px] max-w-[calc(100vw-32px)] z-50 
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
    </>
  );
}

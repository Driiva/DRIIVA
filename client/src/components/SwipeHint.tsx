import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

export default function SwipeHint() {
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    // Hide hint after 3 seconds
    const timer = setTimeout(() => {
      setShowHint(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {showHint && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40"
        >
          <div className="glass-morphism rounded-xl px-4 py-2" style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(16px)',
          }}>
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ x: [-5, 5, -5] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <ChevronLeft className="w-4 h-4 text-white/80" />
              </motion.div>
              
              <span className="text-xs text-white/90 font-medium" style={{
                fontFamily: 'var(--font-body)',
                textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
              }}>
                Swipe to navigate pages
              </span>
              
              <motion.div
                animate={{ x: [-5, 5, -5] }}
                transition={{ repeat: Infinity, duration: 2, delay: 1 }}
              >
                <ChevronRight className="w-4 h-4 text-white/80" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
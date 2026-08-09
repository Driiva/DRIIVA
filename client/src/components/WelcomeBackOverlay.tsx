import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedScore } from './AnimatedScore';

interface WelcomeBackOverlayProps {
  name: string;
  score?: number;
  lastTrip?: string;
  onDismiss: () => void;
}

export default function WelcomeBackOverlay({ name, score, lastTrip, onDismiss }: WelcomeBackOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 1800);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const initial = name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={() => { setVisible(false); setTimeout(onDismiss, 400); }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(10, 10, 25, 0.85)', backdropFilter: 'blur(24px)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.1 }}
            className="flex flex-col items-center gap-5 px-8 py-10 max-w-xs w-full rounded-3xl text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(32px)',
              boxShadow: '0 0 80px rgba(var(--app-primary-rgb), 0.15), 0 0 160px rgba(var(--app-primary-rgb), 0.08)',
            }}
          >
            {/* Avatar ring */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.2 }}
              className="relative"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <span className="text-white font-bold text-3xl">{initial}</span>
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#0a0a19] flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            </motion.div>

            {/* Greeting */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
            >
              <p className="text-white/50 text-sm mb-1">Welcome back</p>
              <h2 className="text-white text-2xl font-bold">{name}</h2>
            </motion.div>

            {/* Score + last trip */}
            {(score !== undefined && score > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white/50 text-sm">Your score</span>
                  <span className="text-emerald-400 text-2xl font-bold">
                    <AnimatedScore value={score} />
                  </span>
                  <span className="text-white/40 text-sm">/100</span>
                </div>
                {lastTrip && (
                  <p className="text-white/40 text-xs mt-1">Last trip: {lastTrip}</p>
                )}
              </motion.div>
            )}

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-white/30 text-xs"
            >
              Tap anywhere to continue
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

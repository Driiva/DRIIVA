import { useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Map, Gift, User } from 'lucide-react';
import { haptic } from '@/hooks/useHaptics';
import { FixedLayer } from '@/components/motion/FixedLayer';

const navItems = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Map, label: 'Trips', path: '/trips' },
  { icon: Gift, label: 'Rewards', path: '/rewards' },
  { icon: User, label: 'Profile', path: '/profile' },
] as const;

interface BottomNavProps {
  /** Badge counts keyed by path */
  badges?: Record<string, number>;
}

export const BottomNav: React.FC<BottomNavProps> = ({ badges }) => {
  const [location] = useLocation();

  // Portalled to the body: PageTransition animates transform and filter on the
  // routed subtree, and either property would make this nav a child of that
  // containing block instead of the viewport, so it would slide on every
  // navigation.
  return (
    <FixedLayer>
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    >
      <div
        className="border-t"
        style={{
          background: 'var(--app-surface-1)',
          borderColor: 'var(--app-border)',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        }}
      >
        <div className="max-w-md mx-auto flex justify-around py-1.5 px-2">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive = location === path ||
              (path === '/trips' && location.startsWith('/trips/'));
            const badge = badges?.[path];

            return (
              <Link
                key={path}
                href={path}
                onClick={() => {
                  if (!isActive) haptic('selection');
                }}
                className="relative min-h-[48px] min-w-[48px]"
              >
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="flex flex-col items-center gap-0.5 px-4 py-1.5 justify-center"
                >
                  <div className="relative w-10 h-8 flex items-center justify-center">
                    {/* Active indicator. A chamfered tile, not a capsule, and
                        tinted with the one accent rather than emerald: green
                        on this product means a positive driving signal. */}
                    {isActive && (
                      <motion.div
                        layoutId="nav-active-tile"
                        className="absolute inset-x-0 -inset-y-0.5"
                        style={{
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(var(--app-primary-rgb), 0.16)',
                          border: '1px solid rgba(var(--app-primary-rgb), 0.22)',
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      />
                    )}

                    <Icon
                      className={`w-[22px] h-[22px] relative z-10 transition-all duration-200 ${
                        isActive
                          ? 'text-[var(--app-primary-text)]'
                          : 'text-white/60'
                      }`}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />

                    {/* Notification badge */}
                    {badge && badge > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center px-1"
                        style={{
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--err)',
                          border: '1px solid var(--app-bg)',
                        }}
                      >
                        <span className="text-[9px] font-bold text-white leading-none">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      </motion.div>
                    )}
                  </div>

                  <span className={`text-[10px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-[var(--app-primary-text)]'
                      : 'text-white/55'
                  }`}>
                    {label}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
    </FixedLayer>
  );
};

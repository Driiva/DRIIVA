/**
 * The small building blocks the profile page is assembled from: the loading
 * skeleton, a label/value row, a stat tile and a policy feature line.
 * Extracted verbatim from client/src/pages/profile.tsx.
 */
import { motion } from "framer-motion";

import { Shimmer } from '@/components/Shimmer';
import { AnimatedNumber } from '@/components/AnimatedNumber';

export function Skeleton({ className = "" }: { className?: string }) {
  return <Shimmer className={className} />;
}

export function DetailRow({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-white/60">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-28" />
      ) : (
        <span className="text-sm font-medium text-white text-right">{value}</span>
      )}
    </div>
  );
}

export function StatCard({ value, label, loading, numericValue }: { value: string | number; label: string; loading?: boolean; numericValue?: number }) {
  return (
    <motion.div
      className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 text-center"
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {loading ? (
        <>
          <Skeleton className="h-7 w-12 mx-auto mb-2" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </>
      ) : (
        <>
          {numericValue !== undefined ? (
            <AnimatedNumber value={numericValue} className="text-2xl font-bold text-white mb-1" />
          ) : (
            <p className="text-2xl font-bold text-white mb-1">{value}</p>
          )}
          <p className="text-xs text-white/60">{label}</p>
        </>
      )}
    </motion.div>
  );
}

export function PolicyFeature({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-white/60">{description}</p>
      </div>
    </div>
  );
}


/**
 * The full-screen wait.
 *
 * This used to be two counter-rotating rings in blue-500 and purple-500, which
 * are not Driiva colours and were the only place either appeared. It is now the
 * house ArcTracer, so a pending reading looks the same everywhere in the app
 * and occupies the same 270 degree sweep the score gauge does.
 */
import React from 'react';

import { ArcTracer } from '@/components/motion/Instrument';

export const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-screen">
    <ArcTracer size={48} label="Loading" />
  </div>
);

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ className = '', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-lg ${className}`}
          style={{ background: 'var(--app-surface-2)' }}
        />
      ))}
    </>
  );
};

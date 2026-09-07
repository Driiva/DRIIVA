/**
 * First-paint skeletons for the dashboard's three heaviest cards.
 * Extracted verbatim from client/src/pages/dashboard.tsx.
 */
import { Skeleton, SkeletonList } from '@/components/ui/EmptyState';
import { ScoreCardShimmer } from '@/components/Shimmer';

export function ScoreCardSkeleton() {
  return <ScoreCardShimmer />;
}

// Both skeletons use the shared shimmer so the dashboard waits in the same
// visual language as trips, the leaderboard and rewards.
export function TripsSkeleton() {
  return (
    <div className="instrument-card mb-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-5 w-5" />
      </div>
      <SkeletonList count={3} />
    </div>
  );
}

export function PoolSkeleton() {
  return (
    <div className="instrument-card mb-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-5 w-5" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
        <Skeleton className="h-2 w-full mt-2" />
      </div>
    </div>
  );
}


/**
 * First-paint skeletons for the leaderboard. Extracted verbatim from
 * client/src/pages/leaderboard.tsx.
 */
import { SkeletonList, SkeletonStat } from '@/components/ui/EmptyState';

export function LeaderboardSkeleton() {
  return <SkeletonList count={8} />;
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

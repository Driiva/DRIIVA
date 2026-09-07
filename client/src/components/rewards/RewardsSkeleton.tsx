/**
 * The Rewards page's shimmer placeholder. Extracted verbatim from
 * client/src/pages/rewards.tsx.
 */
import { Shimmer } from "@/components/Shimmer";

export function Skeleton({ className = "" }: { className?: string }) {
  return <Shimmer className={className} />;
}

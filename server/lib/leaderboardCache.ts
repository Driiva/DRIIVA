/**
 * In-memory TTL cache for the public leaderboard (read-heavy, rarely changes).
 *
 * Shared by the leaderboard route (routes/community.ts) and the dashboard
 * (routes/telematics.ts), which embeds the weekly top ten. One process, one
 * map: a cache hit on either route serves the other.
 */
const leaderboardCache = new Map<string, { data: unknown; expiresAt: number }>();
const LEADERBOARD_CACHE_TTL_MS = 60_000; // 60 seconds

export function getCachedLeaderboard(key: string): unknown | null {
  const entry = leaderboardCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    leaderboardCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedLeaderboard(key: string, data: unknown): void {
  leaderboardCache.set(key, { data, expiresAt: Date.now() + LEADERBOARD_CACHE_TTL_MS });
}

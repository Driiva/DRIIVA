/**
 * In-memory TTL cache for the leaderboard (public, read-heavy, rarely changes).
 * Extracted from server/routes.ts; the cache instance is module-scoped exactly
 * as it was before, so it is shared by every reader in the process.
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

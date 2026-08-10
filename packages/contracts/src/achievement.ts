/**
 * ACHIEVEMENT DEFINITIONS
 * =======================
 * The catalogue, shared by every surface that renders it.
 *
 * WHY THIS MOVED HERE
 * The definitions used to live only in functions/src/utils/achievements.ts,
 * and the client read them from a top-level `achievements` Firestore
 * collection that is populated exclusively by an admin-triggered callable. If
 * nobody had run that callable in an environment, the collection was empty and
 * the achievements page rendered nothing at all, even for a user with real
 * unlocks sitting in their subcollection. Static metadata that ships with the
 * code should not depend on somebody remembering to run a seeding job.
 *
 * The unlock PREDICATES stay server-side. They read trip documents and decide
 * what is earned, which is an authority the client must never hold. What lives
 * here is only the metadata needed to draw the thing: name, description, icon,
 * category, and how progress is measured.
 *
 * These are recognition badges, not redeemable rewards. None of them carries a
 * cash value or a partner brand, and none should be added until a reward can
 * actually be handed over.
 */

export type AchievementCategory = 'safety' | 'community' | 'refund' | 'milestone';

/** The profile fields progress can be measured against. */
export interface AchievementProgressInput {
  totalTrips: number;
  totalMiles: number;
  streakDays: number;
  currentScore: number;
}

export interface AchievementMeta {
  id: string;
  name: string;
  description: string;
  /** Lucide icon name on web, mapped to an Ionicon on mobile. Never an emoji. */
  icon: string;
  category: AchievementCategory;
  /**
   * The target a progress bar counts towards, or null for achievements that
   * simply happen (a night trip, a perfect trip) and cannot be part-completed.
   */
  maxProgress: number | null;
  /**
   * Current progress towards maxProgress. Null when maxProgress is null, so a
   * caller cannot accidentally render "0 of null".
   */
  progressOf: (profile: AchievementProgressInput) => number | null;
}

export const ACHIEVEMENT_META: readonly AchievementMeta[] = [
  {
    id: 'first-trip',
    name: 'First Journey',
    description: 'Complete your first tracked trip',
    icon: 'Car',
    category: 'milestone',
    maxProgress: null,
    progressOf: () => null,
  },
  {
    id: 'smooth-operator',
    name: 'Smooth Operator',
    description: '10 trips without hard braking',
    icon: 'Shield',
    category: 'safety',
    maxProgress: 10,
    progressOf: (p) => Math.min(p.totalTrips, 10),
  },
  {
    id: 'century-club',
    name: 'Century Club',
    description: 'Complete 100 safe trips',
    icon: 'Target',
    category: 'milestone',
    maxProgress: 100,
    progressOf: (p) => Math.min(p.totalTrips, 100),
  },
  {
    id: 'high-scorer',
    name: 'High Scorer',
    description: 'Achieve a driving score of 90 or above',
    icon: 'Star',
    category: 'safety',
    maxProgress: null,
    progressOf: () => null,
  },
  {
    id: 'road-warrior',
    name: 'Road Warrior',
    description: 'Drive 500 miles safely',
    icon: 'Route',
    category: 'milestone',
    maxProgress: 500,
    progressOf: (p) => Math.min(Math.floor(p.totalMiles), 500),
  },
  {
    id: 'streak-master',
    name: 'Streak Master',
    description: 'Maintain a 7-day driving streak',
    icon: 'Flame',
    category: 'safety',
    maxProgress: 7,
    progressOf: (p) => Math.min(p.streakDays, 7),
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Complete a safe night trip after 9pm',
    icon: 'Moon',
    category: 'safety',
    maxProgress: null,
    progressOf: () => null,
  },
  {
    id: 'perfect-score',
    name: 'Perfect Score',
    description: 'Score 100 on a single trip',
    icon: 'Award',
    category: 'safety',
    maxProgress: null,
    progressOf: () => null,
  },
] as const;

export function achievementMetaById(id: string): AchievementMeta | undefined {
  return ACHIEVEMENT_META.find((a) => a.id === id);
}

export interface AchievementView extends AchievementMeta {
  unlocked: boolean;
  unlockedAt: Date | null;
  progress: number | null;
}

/**
 * Merges the catalogue with a user's unlock records into what a list renders.
 * Unlocked first, most recent first within that, then locked ones ordered by
 * how close they are, so the next thing within reach sits at the top of the
 * locked group rather than the alphabetically luckiest one.
 */
export function buildAchievementViews(
  unlocked: ReadonlyArray<{ achievementId: string; unlockedAt: Date | null }>,
  profile: AchievementProgressInput,
): AchievementView[] {
  const unlockedById = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));

  const views: AchievementView[] = ACHIEVEMENT_META.map((meta) => ({
    ...meta,
    unlocked: unlockedById.has(meta.id),
    unlockedAt: unlockedById.get(meta.id) ?? null,
    progress: meta.progressOf(profile),
  }));

  const closeness = (v: AchievementView) =>
    v.maxProgress && v.progress !== null ? v.progress / v.maxProgress : -1;

  return views.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (a.unlocked && b.unlocked) {
      return (b.unlockedAt?.getTime() ?? 0) - (a.unlockedAt?.getTime() ?? 0);
    }
    return closeness(b) - closeness(a);
  });
}

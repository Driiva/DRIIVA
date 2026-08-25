/**
 * The weekly leaderboard period ID, derived once.
 *
 * This was hand-copied into app/leaderboard.tsx and app/(tabs)/dashboard.tsx,
 * each carrying the same warning comment about keeping them in step. The
 * Community screen would have been a third copy, which is the point at which a
 * convention stops being a convention.
 *
 * THE THING THAT MUST NOT DRIFT
 * The week YEAR is the year of the week's Thursday, not the calendar year of
 * the date. Around New Year those disagree, so a calendar-year derivation
 * subscribes to leaderboard/2027-W53_weekly while the scheduled function has
 * written leaderboard/2026-W53_weekly. The board goes empty with no error
 * anywhere, every New Year, for a handful of days.
 *
 * Mirrors getIsoWeekPeriod in functions/src/utils/helpers.ts and
 * getCurrentWeekPeriod in client/src/hooks/useCommunityData.ts. Change all
 * three or none; tests/unit/week-period-convention.test.ts holds them to it.
 */

/** ISO week period, e.g. "2026-W06". */
export function isoWeekPeriod(now: Date): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export type PeriodType = 'weekly' | 'monthly' | 'all_time';

/** The document ID for a board, e.g. "2026-W06_weekly". */
export function periodIdFor(type: PeriodType, now: Date = new Date()): string {
  if (type === 'weekly') return `${isoWeekPeriod(now)}_weekly`;
  if (type === 'monthly') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}_monthly`;
  }
  return 'all_time_all_time';
}

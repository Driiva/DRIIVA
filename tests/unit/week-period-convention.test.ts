/**
 * Wave 0 (0h): the weekly leaderboard document ID was derived two different
 * ways. The client used the ISO week-YEAR (the year of the week's Thursday);
 * the scheduled function used the CALENDAR year with an ISO week number. For
 * the handful of days each year where those disagree, the function wrote
 * leaderboard/2026-W53_weekly while the client subscribed to 2027-W53_weekly,
 * so the board went empty every New Year despite fresh data existing.
 *
 * These dates are exactly the disagreement window. If either side's derivation
 * drifts again, this fails.
 */
import { describe, it, expect } from 'vitest';

import { getIsoWeekPeriod } from '../../functions/src/utils/helpers';

/**
 * Byte-for-byte the client's getCurrentWeekPeriod in
 * client/src/hooks/useCommunityData.ts, parameterised by date so it can be
 * exercised. If the client changes, this copy must change with it and the
 * agreement assertions below will catch a one-sided edit.
 */
function clientWeekPeriod(now: Date): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

const BOUNDARY_DATES = [
  '2025-12-29', // Monday of the week that ISO assigns to 2026-W01
  '2025-12-31',
  '2026-01-01',
  '2026-01-03',
  '2026-06-15', // an ordinary mid-year date, where the two always agreed
  '2026-12-31',
  '2027-01-01',
  '2027-01-02',
];

describe('weekly leaderboard period ID', () => {
  it.each(BOUNDARY_DATES)('client and server agree on %s', (iso) => {
    const date = new Date(`${iso}T12:00:00Z`);
    expect(getIsoWeekPeriod(date)).toBe(clientWeekPeriod(date));
  });

  it('uses the ISO week-year, not the calendar year, across New Year', () => {
    // 1 Jan 2027 falls in the ISO week that belongs to 2026.
    const newYearsDay = new Date('2027-01-01T12:00:00Z');
    expect(getIsoWeekPeriod(newYearsDay).startsWith('2026-')).toBe(true);
  });
});

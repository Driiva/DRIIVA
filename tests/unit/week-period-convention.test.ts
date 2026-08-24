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
import { isoWeekPeriod as mobileWeekPeriod, periodIdFor } from '../../mobile/lib/isoWeek';

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

  /**
   * The mobile derivation was hand-copied into app/leaderboard.tsx and
   * app/(tabs)/dashboard.tsx, and the Community screen would have made three
   * copies of it. It is one module now (mobile/lib/isoWeek.ts) and, unlike the
   * two copies it replaced, it is actually held to the server's answer.
   */
  it.each(BOUNDARY_DATES)('mobile and server agree on %s', (iso) => {
    const date = new Date(`${iso}T12:00:00Z`);
    expect(mobileWeekPeriod(date)).toBe(getIsoWeekPeriod(date));
  });

  it('builds the document ID the scheduled function writes', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    expect(periodIdFor('weekly', date)).toBe(`${getIsoWeekPeriod(date)}_weekly`);
  });

  it('uses the ISO week-year, not the calendar year, across New Year', () => {
    // 1 Jan 2027 falls in the ISO week that belongs to 2026.
    const newYearsDay = new Date('2027-01-01T12:00:00Z');
    expect(getIsoWeekPeriod(newYearsDay).startsWith('2026-')).toBe(true);
  });
});

/**
 * Wave B: the same divergence survived in getPreviousPeriod inside
 * functions/src/scheduled/leaderboard.ts, which is what the movement
 * indicators are computed against. That one fails quietly: the previous-week
 * lookup simply misses, every `change` becomes 0, and the board looks frozen
 * rather than broken. These pin the previous-week ID to the same derivation.
 */
describe('previous weekly period ID', () => {
  /** Byte-for-byte the derivation now used by getPreviousPeriod. */
  function previousWeekPeriod(now: Date): string {
    return getIsoWeekPeriod(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  }

  /**
   * The retired derivation: calendar year of the previous-week date, paired
   * with an ISO week number. Kept here ONLY so the cases below can prove they
   * discriminate. The first draft of this test used 5 Jan, where both
   * derivations happen to agree, so it would have passed against the bug.
   */
  function retiredDerivation(now: Date): string {
    const prev = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d = new Date(Date.UTC(prev.getFullYear(), prev.getMonth(), prev.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${prev.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  // Dates where the two derivations genuinely disagree, with the answer the
  // leaderboard documents actually use.
  const DISCRIMINATING: ReadonlyArray<readonly [string, string, string]> = [
    ['2027-01-08', '2026-W53', '2027-W53'],
    ['2026-01-07', '2026-W01', '2025-W01'],
  ];

  it.each(DISCRIMINATING)('%s resolves to %s, not %s', (iso, expected, retired) => {
    const date = new Date(`${iso}T12:00:00Z`);
    expect(previousWeekPeriod(date)).toBe(expected);
    // Proves the case is load-bearing: the old derivation really did differ.
    expect(retiredDerivation(date)).toBe(retired);
    expect(previousWeekPeriod(date)).not.toBe(retiredDerivation(date));
  });

  it('always names a real week immediately before the current one', () => {
    for (const iso of BOUNDARY_DATES) {
      const date = new Date(`${iso}T12:00:00Z`);
      const previous = previousWeekPeriod(date);
      expect(previous).not.toBe(getIsoWeekPeriod(date));
      expect(previous).toMatch(/^\d{4}-W\d{2}$/);
    }
  });
});

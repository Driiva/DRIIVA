/**
 * The onboarding trip demo shows four score deltas: braking, speed,
 * acceleration, and the late-night drive. They were written out by hand in two
 * places, with different labels and identical numbers:
 *
 *   mobile/components/onboarding/TripReplay.tsx   EVENTS[].delta
 *   mobile/app/onboarding/trip-demo.tsx           BreakdownRow value props
 *
 * Two hand-maintained copies of one set of numbers is the shape that drifts.
 * Retune the demo in one file and the replay animation and the summary card
 * disagree about what the same simulated trip scored, which nothing in the
 * build would notice.
 *
 * mobile/hooks/useTripSeed.ts now holds the single source. This suite fails if
 * either screen's numbers stop matching it, whether the screen still spells
 * them out or has moved to importing the constant.
 *
 * On the extraction being real: a source-scanning guard that quietly matches
 * nothing compares an empty list against an empty list and passes forever,
 * which is worse than no guard because it reads as protection. Every file that
 * has not migrated must therefore yield exactly as many deltas as the constant
 * declares, and that count is asserted before the values are compared.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { DEMO_SCORE_DELTAS } from '../../mobile/hooks/useTripSeed';

const ROOT = join(__dirname, '..', '..');

/** Screens that render the demo deltas, and how each spells one out today. */
const COPIES = [
  {
    file: 'mobile/components/onboarding/TripReplay.tsx',
    // EVENTS: [{ label: '...', delta: '+8', delay: 1200 }, ...]
    pattern: /delta:\s*'\+(\d+)'/g,
  },
  {
    file: 'mobile/app/onboarding/trip-demo.tsx',
    // <BreakdownRow label="..." value="+8 pts" />
    pattern: /value="\+(\d+) pts"/g,
  },
] as const;

function read(file: string): string {
  return readFileSync(join(ROOT, file), 'utf-8');
}

describe('DEMO_SCORE_DELTAS: the single source', () => {
  it('declares four positive whole-point deltas', () => {
    expect(DEMO_SCORE_DELTAS).toHaveLength(4);
    for (const entry of DEMO_SCORE_DELTAS) {
      expect(Number.isInteger(entry.delta)).toBe(true);
      expect(entry.delta).toBeGreaterThan(0);
    }
  });

  it('gives every delta a distinct id', () => {
    const ids = DEMO_SCORE_DELTAS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reveals the rows in order', () => {
    const delays = DEMO_SCORE_DELTAS.map((d) => d.delay);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
  });
});

describe('the screens agree with the single source', () => {
  const expected = DEMO_SCORE_DELTAS.map((d) => d.delta);

  for (const { file, pattern } of COPIES) {
    it(`${file} renders exactly the shared deltas`, () => {
      const source = read(file);

      if (source.includes('DEMO_SCORE_DELTAS')) {
        // Migrated: the numbers come from the constant, so there is nothing
        // left to drift. Pin the import so a later edit cannot quietly swap it
        // for a local array of the same name.
        expect(source).toMatch(/import\s*\{[^}]*DEMO_SCORE_DELTAS[^}]*\}\s*from\s*'@\/hooks\/useTripSeed'/);
        return;
      }

      const found = [...source.matchAll(pattern)].map((m) => Number(m[1]));

      // Prove the scanner is alive before believing what it found. A pattern
      // that stopped matching would otherwise report a clean run forever.
      expect(found).toHaveLength(expected.length);
      expect(found).toEqual(expected);
    });
  }
});

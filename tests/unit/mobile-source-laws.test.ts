/**
 * The mobile design laws, run as part of the default suite.
 *
 * The web laws (tests/design-laws.mjs) need a Chrome on :9222 and a dev server,
 * so they cannot run in CI. The mobile half is a static source lint precisely
 * so that it can, which matters more here: mobile copy had never been linted
 * for anything, and seventeen em dashes, two exclamation marks and four rgba()
 * tints of a retired accent all reached shipped screens.
 *
 * The planted case is the point of the second test. A lint that passes because
 * its matcher stopped matching is worse than no lint, so every law must still
 * fire on a file written to break it.
 */
import { describe, expect, it } from 'vitest';

// @ts-expect-error - the harness is plain ESM with no type declarations.
import { runMobileSourceLaws, lintSource } from '../mobile-source-laws.mjs';

interface LawResult {
  id: string;
  title: string;
  violations: Array<{ file: string; line: number; detail: string }>;
}

interface LawRun {
  fileCount: number;
  laws: LawResult[];
  total: number;
}

describe('mobile design laws', () => {
  it('the real mobile source breaks none of them', () => {
    const result = runMobileSourceLaws() as LawRun;

    expect(result.fileCount).toBeGreaterThan(40);

    const broken = result.laws
      .filter((law) => law.violations.length > 0)
      .map((law) => `${law.title}\n${law.violations
        .map((v) => `    ${v.file}:${v.line}  ${v.detail}`)
        .join('\n')}`);

    expect(broken.join('\n')).toBe('');
  });

  it('every law still fires on a file planted to break it', () => {
    const result = runMobileSourceLaws({ planted: true }) as LawRun;

    const silent = result.laws.filter((law) => law.violations.length === 0).map((law) => law.id);
    expect(silent).toEqual([]);
  });
});

/**
 * The exclamation law had a false positive that made it red on the whole
 * branch. Its JSX-text pattern reads "text between a tag that closes and a tag
 * that opens", and TypeScript spends angle brackets on comparisons too, so it
 * opened at the `>` of `>=`, ran across the newline to the `<` of the next
 * element, and reported the `!==` in between as a shout in driver-facing copy.
 *
 * These cases are pinned here rather than left to the real source. The proof
 * that the bug is gone used to be "mobile/app/trips/[tripId].tsx no longer
 * trips it", which stops being proof the moment that screen is edited. The
 * shape of the line is what matters, so the shape is what gets tested, in both
 * directions: the comparison must pass and a real shout must still fail.
 */
describe('the exclamation law reads copy, not comparisons', () => {
  function exclamationHits(source: string): string[] {
    const laws = lintSource('mobile/app/probe.tsx', source) as LawResult[];
    const law = laws.find((l) => l.id === 'exclamations');
    return (law?.violations ?? []).map((v) => v.detail);
  }

  it('does not flag a comparison spanning a JSX branch', () => {
    // The exact shape from the screen that was red.
    const source = [
      'export function Probe() {',
      '  return points === undefined ? (',
      '    <Skeleton />',
      '  ) : route.length >= 2 && region && MapView !== null ? (',
      '    <View>',
      '      <MapView />',
      '    </View>',
      '  ) : null;',
      '}',
    ].join('\n');

    expect(exclamationHits(source)).toEqual([]);
  });

  it('does not flag the other comparison operators either', () => {
    const source = [
      'const a = x !== y;',
      'const b = x != y;',
      'const c = list.length >= 2;',
      'const d = list.length <= 2;',
      'const e = items.map((i) => i.id);',
    ].join('\n');

    expect(exclamationHits(source)).toEqual([]);
  });

  it('still flags a shout in JSX text', () => {
    const source = 'export const A = () => <Text>Great news, your score went up!</Text>;';
    expect(exclamationHits(source)).toHaveLength(1);
  });

  it('still flags a shout in a string literal', () => {
    const source = "export const copy = 'Nice one!';";
    expect(exclamationHits(source)).toHaveLength(1);
  });

  it('still flags a shout in a file that also contains comparisons', () => {
    // The fix must not be "ignore any file or line containing an operator".
    const source = [
      'const ready = list.length >= 2 && thing !== null;',
      'export const A = () => <Text>Nice one!</Text>;',
    ].join('\n');

    expect(exclamationHits(source)).toHaveLength(1);
  });

  /*
   * A KNOWN GAP, recorded rather than quietly left for someone to rediscover.
   *
   * The extractor only starts a JSX-text run at a `>`, so text that follows an
   * embedded expression is invisible to it: in
   *
   *     <Text>Hi {name}, welcome!</Text>
   *
   * the "welcome!" sits after a `}` and no law ever sees it. That predates this
   * fix; the original pattern had the same character class.
   *
   * It is not closed here because the obvious fix, also starting a run at `}`,
   * makes every TypeScript non-null assertion a candidate shout, and there is
   * already one in the tree (`user!.id`, mobile/app/(tabs)/record.tsx). Turning
   * a false negative into a false positive on a screen this branch does not own
   * is the wrong trade today. Closing it properly means teaching the exclamation
   * check to tell `x!.y` from a shout, which is its own change with its own
   * proof.
   */
  it.todo('flags a shout that follows an embedded expression, as in <Text>Hi {name}, welcome!</Text>');
});

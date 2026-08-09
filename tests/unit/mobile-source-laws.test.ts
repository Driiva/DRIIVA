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
import { runMobileSourceLaws } from '../mobile-source-laws.mjs';

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

/**
 * The web fabrication laws, run as part of the default suite.
 *
 * The mobile equivalent (tests/unit/mobile-source-laws.test.ts) proved the
 * shape works: a static lint over source, with a planted case so the lint
 * cannot quietly stop matching. This is the same idea aimed at the class that
 * matters most on a pre-launch insurtech, which is a claim about money,
 * people or regulatory status that nobody can trace to a source.
 *
 * If this test fails, the fix is one of exactly two things. Either the hit is
 * a fabrication and it should be deleted, or it is true and it belongs in
 * ALLOWED with the reason it is true written next to it.
 */
import { describe, expect, it } from 'vitest';

import { runFabricationLaws } from '../fabrication-laws.mjs';

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

describe('web fabrication laws', () => {
  it('every claim about money, people or regulation is accounted for', () => {
    const result = runFabricationLaws() as LawRun;

    expect(result.fileCount).toBeGreaterThan(200);

    const unaccounted = result.laws
      .filter((law) => law.violations.length > 0)
      .map((law) => `${law.title}\n${law.violations
        .map((v) => `    ${v.file}:${v.line}  ${v.detail}`)
        .join('\n')}`);

    expect(unaccounted.join('\n')).toBe('');
  });

  it('every law still fires on a file planted to break it', () => {
    const result = runFabricationLaws({ planted: true }) as LawRun;

    const silent = result.laws.filter((law) => law.violations.length === 0).map((law) => law.id);
    expect(silent).toEqual([]);
  });
});

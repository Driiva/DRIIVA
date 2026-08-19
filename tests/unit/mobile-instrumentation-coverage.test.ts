/**
 * INSTRUMENTATION COVERAGE
 * ========================
 * The beta brief sets "core loop actions instrumented: 100%". A percentage
 * nobody measures is a number that is true on the day it is written and
 * quietly false a fortnight later, so this measures it.
 *
 * The rule: every event declared in the taxonomy must actually be emitted from
 * somewhere in mobile/ source. An event that exists only in the union is a
 * metric that reads as zero forever, which is indistinguishable from a step
 * users never take. That is the exact failure this repo has been bitten by
 * before, where a dead Resend tracking flag made real conversion look like 0%.
 *
 * The reverse direction matters just as much: nothing may emit an event that
 * is not in the taxonomy, or the funnel grows a column nobody declared.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { LOOP_EVENTS } from '../../mobile/lib/analyticsCore';

const MOBILE_ROOT = join(__dirname, '../../mobile');
const SEARCH_DIRS = ['app', 'lib', 'components', 'contexts', 'hooks'];

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out = out.concat(sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = SEARCH_DIRS.flatMap((d) => sourceFiles(join(MOBILE_ROOT, d)));

// The taxonomy module itself declares the names; it is not a call site.
const callSites = files.filter((f) => !f.endsWith('analyticsCore.ts'));
const corpus = callSites.map((f) => readFileSync(f, 'utf8')).join('\n');

describe('instrumentation coverage', () => {
  it('finds mobile source to inspect', () => {
    // Assert on arrival before asserting on content. An empty corpus would
    // make every check below pass while proving nothing, which is how a
    // harness reports "never got there" as "clean".
    expect(callSites.length).toBeGreaterThan(20);
    expect(corpus.length).toBeGreaterThan(10_000);
  });

  it('emits every event in the taxonomy from somewhere in the app', () => {
    const missing = LOOP_EVENTS.filter((event) => !corpus.includes(`'${event}'`));
    expect(missing, `declared but never emitted: ${missing.join(', ')}`).toEqual([]);
  });

  it('emits nothing that is not in the taxonomy', () => {
    const emitted = new Set<string>();
    for (const match of corpus.matchAll(/\btrack\(\s*'([a-z_]+)'/g)) {
      emitted.add(match[1]);
    }

    // Sanity: the regex must actually be finding call sites.
    expect(emitted.size).toBeGreaterThan(5);

    const undeclared = [...emitted].filter(
      (event) => !(LOOP_EVENTS as readonly string[]).includes(event),
    );
    expect(undeclared, `emitted but never declared: ${undeclared.join(', ')}`).toEqual([]);
  });
});

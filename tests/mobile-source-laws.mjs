#!/usr/bin/env node
/**
 * Driiva's machine-checkable design laws for the MOBILE app.
 *
 * The web laws in tests/design-laws.mjs attach to a running Chrome and measure
 * rendered pages. There is no equivalent for a React Native screen without a
 * simulator, so mobile copy and mobile tokens have never been linted for
 * anything, and it showed: seventeen em dashes in onboarding, two exclamation
 * marks on shipped screens, and four rgba() tints of an accent colour the
 * brand stopped using.
 *
 * This is the static half of the same harness. Zero dependencies, no simulator,
 * no Metro bundler, so it runs anywhere the repo does, including CI.
 *
 * Usage:
 *   node tests/mobile-source-laws.mjs                   # lint the real source
 *   PLANT_VIOLATION=1 node tests/mobile-source-laws.mjs # prove it can fail
 *
 * THE LAWS
 *   1. No em dashes, en dashes or double hyphens. Anywhere, comments included:
 *      CLAUDE.md's UK-spelling rule covers code comments too, and a dash that
 *      lives in a comment today gets copied into a string tomorrow.
 *   2. No exclamation marks in anything a driver reads. Insurance copy that
 *      shouts reads as a marketing site, not an instrument.
 *   3. No emoji. Icons are Ionicons at a fixed size and stroke.
 *   4. Colour comes from tokens. No hex and no rgb()/rgba() literal outside
 *      the one file that defines the palette. This is the law that earns its
 *      keep: a pasted colour passes tsc, passes review, and stays invisible
 *      until someone retunes the brand and one card does not move.
 *   5. No fontWeight. Three weights means three FAMILIES: React Native picks a
 *      face by family name, so a weight on top of a named face either does
 *      nothing or synthesises a fake bold.
 *   6. No capsules. A borderRadius of R.full or 9999 is only allowed on a box
 *      the same style object makes square, which is a dot or an avatar.
 *   7. The legacy theme is gone. Nothing imports @/constants/theme.
 *
 * Adding a law: add it to LAWS, and add a matching sample to PLANTED so the
 * planted run proves the new law can actually fail.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The repo root. Under a bundler (the vitest wrapper around this harness)
 * import.meta.url is not a file URL, and the suite runs from the repo root
 * anyway, so cwd is the same directory.
 */
function repoRoot() {
  try {
    const here = new URL('..', import.meta.url);
    if (here.protocol === 'file:') return fileURLToPath(here);
  } catch {
    // fall through to cwd
  }
  return process.cwd();
}

const ROOT = repoRoot();
const MOBILE_DIRS = ['mobile/app', 'mobile/components'];

/** The palette lives in exactly one file, and that file may hold literals. */
const PALETTE_SOURCE = 'mobile/components/ui/theme.ts';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * Everything a driver could read: string literals, template-literal text and
 * JSX text nodes. Template expressions are dropped so `${a !== b}` is not
 * mistaken for a shout.
 */
function readableStrings(source) {
  const found = [];
  const patterns = [
    /'((?:[^'\\\n]|\\.)*)'/g,
    /"((?:[^"\\\n]|\\.)*)"/g,
    /`((?:[^`\\]|\\.)*)`/g,
    />([^<>{}]*[A-Za-z][^<>{}]*)</g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      found.push({ text: match[1].replace(/\$\{[^}]*\}/g, ''), index: match.index });
    }
  }
  return found;
}

const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

const LAWS = [
  {
    id: 'dashes',
    title: 'No em dashes, en dashes or double hyphens',
    check(file, source) {
      const hits = [];
      for (const match of source.matchAll(/\u2014|\u2013|(?<![-:!<>=])--(?!>)/gu)) {
        // `--ease-fast` and `--flag` are a CSS custom property and a CLI flag,
        // not the typographic dash people reach for instead of a comma.
        if (match[0] === '--' && /^[a-zA-Z]/.test(source.slice(match.index + 2))) continue;
        hits.push({ line: lineOf(source, match.index), detail: JSON.stringify(match[0]) });
      }
      return hits;
    },
  },
  {
    id: 'exclamations',
    title: 'No exclamation marks in copy',
    check(file, source) {
      const hits = [];
      for (const { text, index } of readableStrings(source)) {
        // `!` only shouts when it follows a word or closing punctuation.
        if (/[\w)"'.,]\s*!/.test(text)) {
          hits.push({ line: lineOf(source, index), detail: text.trim().slice(0, 60) });
        }
      }
      return hits;
    },
  },
  {
    id: 'emoji',
    title: 'No emoji',
    check(file, source) {
      const hits = [];
      source.split('\n').forEach((line, i) => {
        if (EMOJI.test(line)) hits.push({ line: i + 1, detail: line.trim().slice(0, 60) });
      });
      return hits;
    },
  },
  {
    id: 'colour-tokens',
    title: 'Colour comes from tokens, never a pasted literal',
    check(file, source) {
      if (file === PALETTE_SOURCE) return [];
      const hits = [];
      const pattern = /'(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))'|"(#[0-9a-fA-F]{3,8})"/g;
      for (const match of source.matchAll(pattern)) {
        hits.push({ line: lineOf(source, match.index), detail: match[0] });
      }
      return hits;
    },
  },
  {
    id: 'font-weight',
    title: 'No fontWeight: the weight is the family',
    check(file, source) {
      const hits = [];
      for (const match of source.matchAll(/\bfontWeight\s*:/g)) {
        hits.push({ line: lineOf(source, match.index), detail: 'fontWeight' });
      }
      return hits;
    },
  },
  {
    id: 'capsules',
    title: 'No capsules: a full radius is only for a square box',
    check(file, source) {
      const hits = [];
      for (const match of source.matchAll(/borderRadius\s*:\s*(R\.full|9999)/g)) {
        // Look at the enclosing style object. A square box at a full radius is
        // a circle, which is a dot or an avatar, and is deliberate.
        const open = source.lastIndexOf('{', match.index);
        const close = source.indexOf('}', match.index);
        const block = source.slice(open, close === -1 ? source.length : close);
        const width = block.match(/\bwidth\s*:\s*(\d+)/);
        const height = block.match(/\bheight\s*:\s*(\d+)/);
        if (width && height && width[1] === height[1]) continue;
        hits.push({ line: lineOf(source, match.index), detail: match[0] });
      }
      return hits;
    },
  },
  {
    id: 'type-scale',
    title: 'Type comes from the scale, not from a typed number',
    /**
     * Now the whole of mobile/, screens included. It was scoped to the
     * primitives while the screens still carried 108 hardcoded sizes, which is
     * exactly how those 108 survived a law named after them: a law that
     * exempts the place the problem lives reports green forever. The debt is
     * paid, so the exemption goes with it.
     *
     * The theme is the one file allowed to state a number, because it is where
     * the ladder is defined.
     */
    check(file, source) {
      if (file === PALETTE_SOURCE || file === 'mobile/components/ui/theme.ts') return [];
      const hits = [];
      for (const match of source.matchAll(/\bfontSize\s*:\s*(\d+(?:\.\d+)?)/g)) {
        hits.push({ line: lineOf(source, match.index), detail: match[0] });
      }
      return hits;
    },
  },
  {
    id: 'legacy-theme',
    title: 'The legacy theme is gone',
    check(file, source) {
      const hits = [];
      for (const match of source.matchAll(/@\/constants\/theme|@\/constants\/Colors/g)) {
        hits.push({ line: lineOf(source, match.index), detail: match[0] });
      }
      return hits;
    },
  },
];

/**
 * One planted sample per law. The planted run has to fail EVERY law, otherwise
 * a law that can no longer fire would sit there looking green forever.
 */
const PLANTED = `
/** A planted file - it breaks every law on purpose. */
import { Colors } from '@/constants/theme';
const styles = {
  shout: { color: '#ff00ff', fontWeight: '800', fontSize: 17 },
  pill: { width: 120, height: 32, borderRadius: 9999 },
};
export const copy = 'Great news, your score went up!';
export const wrong = 'A dash - an em dash \u2014 and an en dash \u2013 and a double hyphen --';
export const badge = 'All done \u2705';
`;

export function runMobileSourceLaws({ planted = false } = {}) {
  const files = MOBILE_DIRS.flatMap((dir) => walk(join(ROOT, dir))).map((f) =>
    relative(ROOT, f).split('\\').join('/'),
  );

  const targets = planted
    ? [
        ...files.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]),
        ['mobile/app/planted.tsx', PLANTED],
      ]
    : files.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]);

  const byLaw = new Map(LAWS.map((law) => [law.id, []]));
  for (const [file, source] of targets) {
    for (const law of LAWS) {
      for (const hit of law.check(file, source)) {
        byLaw.get(law.id).push({ file, ...hit });
      }
    }
  }

  return {
    fileCount: files.length,
    laws: LAWS.map((law) => ({ id: law.id, title: law.title, violations: byLaw.get(law.id) })),
    total: [...byLaw.values()].reduce((n, v) => n + v.length, 0),
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (!process.env.VITEST && process.argv[1] && process.argv[1].endsWith('mobile-source-laws.mjs')) {
  const planted = process.env.PLANT_VIOLATION === '1';
  if (planted) {
    console.log('PLANT_VIOLATION=1: a file breaking every law is being linted alongside the real source.\n');
  }
  const result = runMobileSourceLaws({ planted });
  console.log(`mobile source laws: ${result.fileCount} files\n`);

  let failed = 0;
  for (const law of result.laws) {
    if (law.violations.length === 0) {
      console.log(`  pass  ${law.title}`);
      continue;
    }
    failed += 1;
    console.log(`  FAIL  ${law.title} (${law.violations.length})`);
    for (const v of law.violations.slice(0, 12)) {
      console.log(`          ${v.file}:${v.line}  ${v.detail}`);
    }
    if (law.violations.length > 12) {
      console.log(`          ... and ${law.violations.length - 12} more`);
    }
  }

  console.log('');
  if (planted) {
    const clean = result.laws.filter((l) => l.violations.length === 0);
    if (clean.length > 0) {
      console.log(`planted run did NOT trip: ${clean.map((l) => l.id).join(', ')}`);
      process.exit(1);
    }
    console.log('planted run tripped every law, as it must.');
    process.exit(0);
  }
  process.exit(failed ? 1 : 0);
}

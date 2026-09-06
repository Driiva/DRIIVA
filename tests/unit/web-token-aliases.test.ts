/**
 * The client's tokens converge on the design system, checked statically.
 *
 * ROADMAP's "Client SPA token alignment" ticket: `client/` was to stop using
 * legacy variable names and converge on `design-system/colors_and_type.css`.
 * The canonical block landed in `client/src/index.css` a while ago, but it was
 * followed by a "compatibility aliases" block - `--success-green`,
 * `--primary-blue`, `--ease-smooth`, `--neutral-100` and friends - each one
 * pointing AT a canonical token so the old rules kept resolving. Two palettes
 * with one set of values is still two palettes: the next rule written against
 * `--primary-blue` reads as if the app had a blue, and the next person retuning
 * the accent has to know that six other names move with it.
 *
 * The law is simply: the client speaks the canonical names and nothing else.
 * The second test is the safety net for the rename itself. A `var(--x)` whose
 * `--x` is declared nowhere does not error, it silently falls back to nothing,
 * so a rename that leaves one dangling reference would ship as an invisible
 * regression. Every referenced custom property must be one the app declares,
 * or one a runtime the app does not own (Radix, Tailwind) is known to set.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WEB_DIR = 'client/src';

/**
 * The legacy names the ticket retires. Each was declared in index.css as an
 * alias of a canonical token and is now expected to appear nowhere in
 * client/src, neither declared nor referenced.
 */
const LEGACY_ALIASES = [
  'neutral-50',
  'neutral-100',
  'neutral-200',
  'neutral-300',
  'neutral-400',
  'neutral-500',
  'neutral-600',
  'neutral-700',
  'neutral-800',
  'neutral-900',
  'font-medium',
  'ease-smooth',
  'ease-bounce',
  'ease-out',
  'success-green',
  'warning-amber',
  'warning-yellow',
  'error-red',
  'info-accent',
  'primary-purple',
  'secondary-blue',
  'primary-blue',
  'glass-overlay',
  'glass-overlay-subtle',
  'glass-border',
  'glass-shadow',
  'font-heading',
  'font-caption',
  'blur-glass',
  'radius-container',
];

const LEGACY_ALIAS_PATTERN = new RegExp(`--(${LEGACY_ALIASES.join('|')})\\b`, 'g');

/**
 * Custom properties set by code the app does not own. Radix writes its
 * measurement variables onto its own elements at runtime; Tailwind's `--tw-*`
 * are its internal plumbing.
 */
const RUNTIME_PREFIXES = ['--radix-', '--tw-'];

/**
 * Pre-existing dangling references this ticket did not create and does not
 * widen itself to fix. `components/ui/sidebar.tsx` is the stock shadcn sidebar
 * primitive; it reads the `--sidebar-*` theme tokens shadcn expects an app's
 * :root to declare, and this app never declared them. No route imports the
 * sidebar, so nothing renders against the gap today. Listed exactly so that a
 * NEW dangling reference still fails, and so that fixing or deleting the
 * sidebar makes this list wrong and forces it to shrink.
 */
const KNOWN_UNRESOLVED = ['--sidebar-border', '--sidebar-accent'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') walk(full, out);
    } else if (/\.(tsx?|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function sources(): Array<[string, string]> {
  return walk(join(ROOT, WEB_DIR)).map((f) => [
    relative(ROOT, f).split('\\').join('/'),
    readFileSync(f, 'utf8'),
  ]);
}

/** Every `--name` that a source declares, in CSS (`--name:`) or as an inline style key (`'--name':`). */
function declaredProperties(source: string): string[] {
  return [...source.matchAll(/(--[a-zA-Z0-9-]+)['"]?\s*:/g)].map((m) => m[1]);
}

/** Every `--name` a source reads through `var(--name`. */
function referencedProperties(source: string): string[] {
  return [...source.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((m) => m[1]);
}

function legacyHits(file: string, source: string): string[] {
  const hits: string[] = [];
  source.split('\n').forEach((line, i) => {
    const matches = line.match(LEGACY_ALIAS_PATTERN);
    if (matches) hits.push(`${file}:${i + 1}  ${matches.join(' ')}`);
  });
  return hits;
}

describe('web token alignment', () => {
  it('no legacy alias is declared or referenced anywhere in client/src', () => {
    const hits = sources().flatMap(([file, source]) => legacyHits(file, source));

    expect(hits.join('\n')).toBe('');
  });

  it('every custom property the client reads is one it declares, or one a runtime sets', () => {
    const all = sources();
    const declared = new Set(all.flatMap(([, source]) => declaredProperties(source)));

    const dangling: string[] = [];
    for (const [file, source] of all) {
      for (const name of new Set(referencedProperties(source))) {
        if (declared.has(name)) continue;
        if (RUNTIME_PREFIXES.some((p) => name.startsWith(p))) continue;
        dangling.push(`${file}  ${name}`);
      }
    }

    const unexpected = dangling.filter((d) => !KNOWN_UNRESOLVED.some((k) => d.endsWith(`  ${k}`)));
    expect(unexpected.join('\n')).toBe('');

    // The known list is a record, not a licence: it must describe what still dangles.
    const stillDangling = dangling.map((d) => d.split('  ').pop());
    expect([...stillDangling].sort()).toEqual([...KNOWN_UNRESOLVED].sort());
  });

  it('the alias law fires on a planted reference and on a planted declaration', () => {
    expect(legacyHits('planted.css', '.x { color: var(--success-green); }')).toHaveLength(1);
    expect(legacyHits('planted.css', ':root { --primary-blue: #000; }')).toHaveLength(1);
    expect(legacyHits('planted.css', '.x { color: var(--app-primary); }')).toHaveLength(0);
  });

  it('the resolution check fires on a planted dangling reference', () => {
    const declared = new Set(declaredProperties(':root { --app-primary: #5b4dc9; }'));
    const referenced = referencedProperties('.x { color: var(--app-primary); border-color: var(--nowhere); }');

    expect(referenced.filter((n) => !declared.has(n))).toEqual(['--nowhere']);
  });
});

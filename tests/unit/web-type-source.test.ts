/**
 * The web half of the type laws, checked statically.
 *
 * tests/design-laws.mjs measures a rendered page and so needs a Chrome and a
 * dev server, which means it cannot run in CI and never caught this: eight
 * elements across the app set `fontFamily: 'Inter, sans-serif'` inline, and one
 * set `system-ui`. Inter is not one of the three faces the site loads, so every
 * one of those elements rendered in the browser's fallback sans. That is the
 * legacy system font people kept seeing on surfaces that had supposedly been
 * migrated to Instrument Sans.
 *
 * A font family named in a component is the failure mode, not the styling, so
 * the law is simply: families come from tokens.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WEB_DIR = 'client/src';

/** The three faces the site actually loads, from client/src/index.css. */
const LOADED_FAMILIES = ['Instrument Sans', 'Inter Tight', 'JetBrains Mono'];

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

describe('web type laws', () => {
  it('no component names a font family, they all come from tokens', () => {
    const hits: string[] = [];

    for (const [file, source] of sources()) {
      if (file.endsWith('index.css')) continue; // the one file that declares the faces
      source.split('\n').forEach((line, i) => {
        const match = line.match(/font-?[Ff]amily\s*[:=]\s*['"`]([^'"`]+)['"`]/);
        if (!match) return;
        if (match[1].includes('var(--font-')) return;
        hits.push(`${file}:${i + 1}  ${match[1]}`);
      });
    }

    expect(hits.join('\n')).toBe('');
  });

  it('the only families declared anywhere are the three that are loaded', () => {
    const css = readFileSync(join(ROOT, WEB_DIR, 'index.css'), 'utf8');
    const declared = [...css.matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'/g)].map(
      (m) => m[1],
    );

    expect([...new Set(declared)].sort()).toEqual([...LOADED_FAMILIES].sort());
  });

  it('every declared face is self-hosted, with no external font request', () => {
    const css = readFileSync(join(ROOT, WEB_DIR, 'index.css'), 'utf8');
    const remote = [...css.matchAll(/@import\s+url\(['"]?(https?:[^'")]+)/g)].map((m) => m[1]);

    expect(remote).toEqual([]);
  });

  it('the law fires on a component that names a family', () => {
    const planted = `const s = { fontFamily: 'Inter, sans-serif' };`;
    const match = planted.match(/font-?[Ff]amily\s*[:=]\s*['"`]([^'"`]+)['"`]/);

    expect(match?.[1]).toBe('Inter, sans-serif');
    expect(match?.[1].includes('var(--font-')).toBe(false);
  });
});

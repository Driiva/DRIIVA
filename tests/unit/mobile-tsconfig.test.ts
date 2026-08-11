/**
 * mobile/tsconfig.json must stay resolvable without mobile's node_modules, and
 * must not silently drift from Expo's base.
 *
 * The history: the file used to say `extends: "expo/tsconfig.base"`. That
 * resolves through mobile/node_modules, and CI installs dependencies at the
 * root and in functions/ only. The root vitest suite imports four mobile
 * modules on purpose, so vite found this tsconfig, could not resolve the
 * extends, and killed five test files at transform time with
 * "[TSCONFIG_ERROR] Tsconfig not found" before any assertion ran. Tests, Lint
 * and E2E were red on main for that single reason, so nothing in this repo
 * could go green and CI stopped carrying information.
 *
 * The fix inlines Expo's base. The risk that creates is drift, so this is the
 * guard for it. Two laws:
 *
 *   1. No `extends` on a bare package specifier. That is the exact shape that
 *      broke, and it would break again silently.
 *   2. Every option inlined here still matches the real expo/tsconfig.base.
 *      Only checkable when mobile's dependencies are installed, so it skips in
 *      CI and holds locally and on any machine that has run `npm i` in mobile.
 *
 * Law 2 skipping in CI is the weak point, so law 1 - the one that actually
 * protects CI - deliberately runs everywhere.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..');
const MOBILE_TSCONFIG = resolve(REPO_ROOT, 'mobile', 'tsconfig.json');
const EXPO_BASE = resolve(REPO_ROOT, 'mobile', 'node_modules', 'expo', 'tsconfig.base.json');

/** tsconfig.json is JSONC: strip comments before parsing. */
function readJsonc(path: string): Record<string, unknown> {
  const raw = readFileSync(path, 'utf8');
  const stripped = raw
    .replace(/"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
      m.startsWith('"') ? m : '',
    )
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(stripped) as Record<string, unknown>;
}

describe('mobile/tsconfig.json', () => {
  const config = readJsonc(MOBILE_TSCONFIG);

  it('does not extend a bare package specifier, which CI cannot resolve', () => {
    const ext = config.extends;
    if (ext === undefined) {
      expect(ext).toBeUndefined();
      return;
    }
    // A relative extends is fine, it resolves without node_modules. A bare
    // specifier is the thing that broke CI.
    const specifiers = Array.isArray(ext) ? ext : [ext];
    for (const s of specifiers) {
      expect(
        typeof s === 'string' && (s.startsWith('.') || s.startsWith('/')),
        `mobile/tsconfig.json extends "${String(s)}", which resolves through ` +
          'mobile/node_modules. CI does not install those, so every root test ' +
          'that imports a mobile module dies at transform time. Inline the ' +
          'options or extend a relative path instead.',
      ).toBe(true);
    }
  });

  it('keeps the options the mobile app relies on', () => {
    const opts = (config.compilerOptions ?? {}) as Record<string, unknown>;
    expect(opts.strict).toBe(true);
    expect(opts.jsx).toBe('react-native');
    expect(opts.moduleResolution).toBe('bundler');
    expect((opts.paths as Record<string, unknown>)['@shared/*']).toEqual(['../shared/*']);
  });

  // Drift guard. Skips where expo is not installed (CI), runs everywhere else.
  const hasExpo = existsSync(EXPO_BASE);
  it.skipIf(!hasExpo)('has not drifted from the real expo/tsconfig.base', () => {
    const expo = readJsonc(EXPO_BASE);
    const expoOpts = (expo.compilerOptions ?? {}) as Record<string, unknown>;
    const ourOpts = (config.compilerOptions ?? {}) as Record<string, unknown>;

    const drifted: string[] = [];
    for (const [key, expected] of Object.entries(expoOpts)) {
      if (JSON.stringify(ourOpts[key]) !== JSON.stringify(expected)) {
        drifted.push(
          `${key}: expo says ${JSON.stringify(expected)}, ours says ${JSON.stringify(ourOpts[key])}`,
        );
      }
    }
    expect(
      drifted,
      'mobile/tsconfig.json inlines Expo\'s base (see the comment in that file ' +
        'for why). Expo has since changed it. Copy the new values across:\n  ' +
        drifted.join('\n  '),
    ).toEqual([]);

    expect(config.exclude, 'expo base exclude list changed').toEqual(expo.exclude);
  });
});

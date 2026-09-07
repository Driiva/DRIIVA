/**
 * Source law for the server route modules.
 *
 * `server/routes.ts` grew to 1,500 lines holding auth, telematics, community,
 * GDPR, AI, payments and both webhooks in one function. The split into
 * `server/routes/<domain>.ts` only stays a split if something holds it there,
 * so this law says: the monolith does not come back, no route module grows
 * past the repo's 500-line file ceiling, and every module that exports a
 * `register*Routes` function is actually called from `server/routes/index.ts`.
 * The last one is the failure mode a move invites: a module written, exported,
 * and never mounted, so its routes 404 with green tests.
 *
 * The route inventory itself is pinned by server/__tests__/route-inventory.test.ts.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const ROUTES_DIR = join(ROOT, 'server', 'routes');
const MAX_LINES = 500;

function routeModules(): Array<[string, string]> {
  return readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => [f, readFileSync(join(ROUTES_DIR, f), 'utf8')]);
}

describe('server route modules', () => {
  it('the routes monolith is gone and the directory exists', () => {
    expect(existsSync(join(ROOT, 'server', 'routes.ts'))).toBe(false);
    expect(existsSync(join(ROUTES_DIR, 'index.ts'))).toBe(true);
  });

  it(`no route module exceeds ${MAX_LINES} lines`, () => {
    const oversized = routeModules()
      .map(([file, source]) => [file, source.split('\n').length] as const)
      .filter(([, lines]) => lines > MAX_LINES)
      .map(([file, lines]) => `${file}: ${lines} lines`);
    expect(oversized).toEqual([]);
  });

  it('index.ts mounts every register*Routes function its siblings export', () => {
    const index = readFileSync(join(ROUTES_DIR, 'index.ts'), 'utf8');
    const unmounted: string[] = [];
    for (const [file, source] of routeModules()) {
      if (file === 'index.ts') continue;
      const exported = [...source.matchAll(/export function (register\w+Routes)\b/g)].map((m) => m[1]);
      expect(exported.length, `${file} exports no register*Routes function`).toBeGreaterThan(0);
      for (const name of exported) {
        if (!index.includes(`${name}(app)`)) unmounted.push(`${file}: ${name}`);
      }
    }
    expect(unmounted).toEqual([]);
  });

  it('only index.ts is imported by the app', () => {
    const app = readFileSync(join(ROOT, 'server', 'app.ts'), 'utf8');
    expect(app).toMatch(/from ["']\.\/routes(\/index)?["']/);
  });
});

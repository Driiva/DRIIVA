/**
 * Metro configuration.
 *
 * mobile/tsconfig.json has always declared an `@shared/*` path alias pointing
 * at the repo-root `shared/` directory, but nothing taught Metro about it. A
 * TypeScript-only alias typechecks clean and then fails at bundle time, so the
 * alias was unusable and unused. Wave C needs the cursor pagination core from
 * shared/pagination.ts on all three surfaces rather than a third copy of the
 * same off-by-one-prone logic, so the alias is made real here:
 *
 *   watchFolders     - shared/ lives outside the Metro project root, so Metro
 *                      will not read it unless it is watched explicitly.
 *   extraNodeModules - maps the `@shared` specifier to that directory.
 *
 * Only add pure TypeScript with no Node or DOM dependencies to shared/ if
 * mobile is going to import it. shared/pagination.ts hand-rolls its base64
 * codec for exactly this reason: Hermes has neither Buffer nor btoa.
 */
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

/**
 * Where a path really is, following symlinks, or the path itself if it is not
 * one. Git worktrees in this repo symlink node_modules to the shared checkout
 * rather than installing a second copy (they are created that way on purpose;
 * a full Expo dependency tree per worktree is gigabytes). Metro follows the
 * symlink, lands on a directory OUTSIDE the project root, and then refuses to
 * read it because it is not watched, so the bundle dies at the first import:
 *
 *   Unable to resolve module ./mobile/node_modules/expo-router/entry
 *   None of these files exist: mobile/node_modules/expo-router/entry(.ios.ts|...)
 *
 * with entry.js sitting right there through the link. Watching the real
 * directories fixes it, and is a no-op in a normal checkout where the real
 * path and the path are the same.
 */
function real(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

config.watchFolders = [
  ...new Set([
    ...(config.watchFolders ?? []),
    path.resolve(repoRoot, 'shared'),
    path.resolve(repoRoot, 'packages'),
    real(path.resolve(repoRoot, 'shared')),
    real(path.resolve(repoRoot, 'packages')),
    real(path.resolve(projectRoot, 'node_modules')),
    real(path.resolve(repoRoot, 'node_modules')),
  ]),
];

// Sources under packages/ are watched but live outside the Metro project root,
// so Metro walks up from THEIR directory looking for node_modules and never
// reaches mobile/node_modules. packages/contracts imports zod, which made
// `expo export` fail to resolve it the moment a screen imported @driiva/contracts,
// while tsc stayed clean because TypeScript resolves it from the repo root.
// Both roots are searched explicitly.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@shared': path.resolve(repoRoot, 'shared'),
  // The scoring package is the single source of truth for SCORE_WEIGHTS and the
  // refund arithmetic. The mobile trip detail and refund moment display both,
  // and the marketing site has already shipped transposed weights once because
  // someone retyped them. Resolve the real module instead of copying values.
  '@driiva/scoring': path.resolve(repoRoot, 'packages', 'scoring', 'src'),
  '@driiva/contracts': path.resolve(repoRoot, 'packages', 'contracts', 'src'),
};

module.exports = config;

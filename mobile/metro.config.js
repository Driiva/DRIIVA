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

// Only directories that exist. On EAS there is no repo-root node_modules
// (dependencies are installed in mobile/ only), and a watch folder that does
// not exist fails the bundle before a single module is read.
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
].filter((dir) => fs.existsSync(dir));

/**
 * SYMLINKED DEPENDENCIES, WHICH IS HOW EVERY WORKTREE IN THIS REPO IS SET UP.
 *
 * CLAUDE.md mandates one git worktree per task, and the worktrees symlink
 * node_modules back to the shared checkout rather than installing a second
 * copy of a 1 GB Expo tree per branch. That breaks the dev client, and the
 * error it produces points at the wrong thing entirely:
 *
 *   Unable to resolve module ./mobile/node_modules/expo-router/entry
 *   from <worktree>/mobile/. : None of these files exist
 *
 * The named file exists. What happens is that Metro resolves the entry point
 * through the symlink to its REAL path in the shared checkout, then
 * @expo/metro-config's request rewriter takes `path.relative(serverRoot,
 * entry)` to build the bundle URL. The real entry sits outside the worktree,
 * so that relative path starts with `../../..`, and normalising it into a URL
 * silently eats those segments and leaves a path that resolves nowhere.
 *
 * The fix is to give Metro a server root that actually contains both the
 * project and the real dependency tree, and to watch the real tree. Both are
 * derived, not hardcoded, and both are skipped entirely when node_modules is a
 * real directory, so an ordinary checkout is untouched by any of this.
 */
function symlinkTarget(dir) {
  try {
    if (!fs.lstatSync(dir).isSymbolicLink()) return null;
    const real = fs.realpathSync(dir);
    return real === dir ? null : real;
  } catch {
    return null;
  }
}

/** Deepest directory containing every one of the given absolute paths. */
function commonAncestor(dirs) {
  const split = dirs.map((d) => d.split(path.sep));
  const shortest = Math.min(...split.map((parts) => parts.length));
  const shared = [];
  for (let i = 0; i < shortest; i++) {
    const segment = split[0][i];
    if (!split.every((parts) => parts[i] === segment)) break;
    shared.push(segment);
  }
  return shared.join(path.sep) || path.sep;
}

const symlinkedModuleRoots = [
  symlinkTarget(path.resolve(projectRoot, 'node_modules')),
  symlinkTarget(path.resolve(repoRoot, 'node_modules')),
].filter(Boolean);

if (symlinkedModuleRoots.length > 0) {
  config.watchFolders = [...config.watchFolders, ...symlinkedModuleRoots];
  config.server = {
    ...(config.server ?? {}),
    unstable_serverRoot: commonAncestor([projectRoot, ...symlinkedModuleRoots]),
  };
}

// Sources under packages/ are watched but live outside the Metro project root,
// so Metro walks up from THEIR directory looking for node_modules and never
// reaches mobile/node_modules. packages/contracts imports zod, which made
// `expo export` fail to resolve it the moment a screen imported @driiva/contracts,
// while tsc stayed clean because TypeScript resolves it from the repo root.
// Both roots are searched explicitly.
// zod (imported by packages/contracts) is a direct dependency of mobile so the
// EAS build, which installs mobile/ alone, can resolve it without a root tree.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
].filter((dir) => fs.existsSync(dir));

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

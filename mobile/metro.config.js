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
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(repoRoot, 'shared'),
  path.resolve(repoRoot, 'packages'),
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

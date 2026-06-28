// apps/mobile is intentionally excluded from the root npm workspaces (see CLAUDE.md),
// so Metro's default project-root sandbox can't see sibling monorepo packages that
// feature code imports via relative paths (e.g. packages/engine/src/baseline/*).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// zustand's ESM build (esm/middleware.mjs) contains bare `import.meta.env` in its
// unused `devtools` export. Metro bundles whole modules (no tree-shaking) and
// serves web bundles as classic scripts, so that `import.meta` is a parse-time
// SyntaxError that blocks the entire app on web. Disabling package "exports"
// resolution falls back to the CJS build (middleware.js), which has no import.meta.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;

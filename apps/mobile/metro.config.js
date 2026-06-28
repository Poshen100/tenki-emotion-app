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
// SyntaxError that blocks the entire app on web. Force zustand's subpath imports
// to resolve via the "require"/"default" export condition (the CJS build, no
// import.meta) instead of "import" (ESM). Scoped to zustand only — globally
// disabling package exports would also break Expo's web `react-native` ->
// `react-native-web` aliasing, which depends on conditional exports resolution.
const { resolveRequest: defaultResolveRequest } = config.resolver;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand/middleware' || moduleName.startsWith('zustand/middleware/')) {
    return context.resolveRequest({ ...context, isESMImport: false }, moduleName, platform);
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

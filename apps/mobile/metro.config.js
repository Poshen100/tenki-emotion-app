/**
 * Metro config — lets the app import from the monorepo's `packages/` and
 * `domain/` at runtime (e.g. FingerPrecisionScreen → packages/engine
 * multi-modal-blend; features/devices → domain wearable contracts).
 * tsc resolves these via tsconfig paths; Metro additionally needs the folder
 * watched. (Known gap since the 2026-06-19 fusion work — see MEMORY.md.)
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.join(repoRoot, 'packages'), path.join(repoRoot, 'domain')];

// zustand v5's ESM build uses `import.meta`, which breaks Metro web bundles
// (SyntaxError → blank page). Its package exports pick ESM under the web
// 'import' condition, so pin zustand imports to the CJS files directly.
// Everything else keeps default resolution (react-native → react-native-web
// aliasing depends on package exports staying on).
const zustandRoot = path.dirname(require.resolve('zustand/package.json'));
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const sub = moduleName === 'zustand' ? 'index' : moduleName.match(/^zustand\/(.+)$/)?.[1];
  if (sub) {
    return { type: 'sourceFile', filePath: path.join(zustandRoot, `${sub}.js`) };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

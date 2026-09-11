#!/usr/bin/env node
/**
 * Generates the browser-loadable copy of the camera PPG pipeline that
 * `apps/preview/` runs.
 *
 * 🔴 Why this is generated rather than hand-mirrored. This repo has paid for
 * mirror drift three times (PLAYBOOK §6), and the existing mirror —
 * `apps/preview/drift.js` — is 835 hand-written lines shadowing 342 lines of
 * engine, held in step by a harness that compares literal constants. The PPG
 * pipeline is several times larger, and a hand mirror of it would be a
 * standing invitation for the preview to measure something the engine does not.
 *
 * So the preview runs the engine's own source, compiled. `scripts/preview-ppg-sync.mjs`
 * regenerates and diffs, so a change to the TypeScript that is not rebuilt
 * fails the merge gate.
 *
 * ⚠️ `replay.ts` is deliberately NOT compiled. It is the synthetic generator —
 * a test instrument — and nothing it produces may reach a user-facing reading.
 * Keeping it out of the browser bundle makes that structural rather than
 * remembered.
 *
 * Usage: node scripts/build-preview-ppg.mjs [--check]
 *   --check  Build to a temp dir and report whether the committed output differs.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'packages/engine/src');
const OUT = join(ROOT, 'apps/preview/engine');

/**
 * Entry points. `index.ts` is not among them on purpose: it re-exports the
 * synthetic generator, and compiling it would pull `replay.ts` into the page.
 */
const ENTRIES = [
  'biometric/ppg/analyze.ts',
  'biometric/ppg/to-reading.ts',
  'biometric/scan-modes.ts',
  'baseline/noise-floor.ts',
];

const BANNER = `/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
`;

/** Adds the .js extensions browsers require on relative ESM specifiers. */
function addExtensions(code) {
  return code.replace(
    /(\bfrom\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
    (match, open, spec, close) => (spec.endsWith('.js') ? match : `${open}${spec}.js${close}`),
  );
}

function build(outDir) {
  const tsconfig = join(mkdtempSync(join(tmpdir(), 'ppg-tsconfig-')), 'tsconfig.json');
  writeFileSync(
    tsconfig,
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'node',
        declaration: false,
        removeComments: false,
        outDir,
        rootDir: SRC,
      },
      files: ENTRIES.map((entry) => join(SRC, entry)),
    }),
  );

  execFileSync('npx', ['tsc', '-p', tsconfig], { cwd: ROOT, stdio: 'inherit' });

  for (const file of walk(outDir)) {
    const code = readFileSync(file, 'utf8');
    writeFileSync(file, BANNER + addExtensions(code));
  }
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function snapshot(dir) {
  if (!existsSync(dir)) return new Map();
  return new Map(walk(dir).map((file) => [relative(dir, file), readFileSync(file, 'utf8')]));
}

const check = process.argv.includes('--check');

if (check) {
  const tmp = mkdtempSync(join(tmpdir(), 'ppg-check-'));
  build(tmp);

  const fresh = snapshot(tmp);
  const committed = snapshot(OUT);
  const problems = [];

  for (const [name, code] of fresh) {
    if (!committed.has(name)) problems.push(`missing from apps/preview/engine: ${name}`);
    else if (committed.get(name) !== code) problems.push(`out of date: ${name}`);
  }
  for (const name of committed.keys()) {
    if (!fresh.has(name)) problems.push(`stale file, no longer generated: ${name}`);
  }

  rmSync(tmp, { recursive: true, force: true });

  if (problems.length > 0) {
    console.error('🔴 apps/preview/engine 與 packages/engine 不同步：');
    for (const p of problems) console.error(`   - ${p}`);
    console.error('\n   修法：node scripts/build-preview-ppg.mjs');
    process.exit(1);
  }
  console.log('✓ preview PPG bundle 與 engine 同步');
} else {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  build(OUT);
  console.log(`✓ 已產生 ${walk(OUT).length} 個檔案到 apps/preview/engine/`);
}

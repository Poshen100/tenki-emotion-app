#!/usr/bin/env node
/**
 * 守門：`api/` 執行期 import 的每一個外部套件，都必須宣告在
 * `api/package.json` 的 **`dependencies`** 裡。
 *
 * ## 為什麼需要這條
 *
 * 2026-11-09 實例（#304）：`web-push` 只宣告在**根** package.json，而 `api/`
 * 在 #293（10-30）變成一個 workspace、有了自己的 package.json —— 那份裡面沒有
 * `dependencies`。函式的 bundle 以最近的 package.json 當邊界，於是套件沒有被
 * 打進 lambda：
 *
 *     Cannot find module 'web-push'
 *     Require stack: /var/task/api/_lib/push.js ← /var/task/api/digest.js
 *
 * 後果是 `/api/alert`（TradingView 快訊的入口）與 `/api/digest`（L2 收束提醒）
 * **在正式站回了 10 天的 500**。
 *
 * 🔴 **這個形狀的可怕之處是它在本機完全沉默**：根 `node_modules` 有那個套件，
 * 所以 tsc 綠、jest 綠、`npm run verify` 綠。唯一看得到它的地方是部署後的那個
 * 函式 —— 而發現它的唯一方法是真的打一次那條端點。這條守門就是把那件事
 * 搬到 merge 之前。
 *
 * ## 範圍：為什麼只管 `api/`
 *
 * `api/` 是唯一會變成 lambda 的 workspace，也就是唯一「漏宣告會在正式站沉默
 * 地炸掉」的地方。其他 workspace 也有漏宣告（量過，不是推論）：
 *   · `packages/shared/src/components/` → react / three / @react-three/fiber /
 *     framer-motion，而那個目錄在 `packages/shared/tsconfig.json` 裡被
 *     **明文 exclude**（註解寫著「their deps are not installed」）
 *   · `domain/contracts/ILocalStorage.ts` → `@tenki/engine`，而這個檔案在
 *     `domain/src/**` 之外，不在 domain 的 tsc program 裡
 * 那兩處漏宣告會在 build/tsc 當場**大聲**失敗，不是沉默的；把它們一起圈進來
 * 只會讓這條守門一出生就是紅的，而紅燈久了就會被關掉。所以範圍就是 `api/`。
 *
 * ## 兩個刻意的判準
 *
 * 1. **只認 `dependencies`，不認 `devDependencies`。** lambda 只拿得到前者 ——
 *    一個執行期 import 宣告在 devDependencies 一樣會在正式站炸掉，所以這裡
 *    把它當未宣告。
 * 2. **跳過測試檔**（`__tests__/`、`*.test.ts`）。測試檔不會被打進 lambda，
 *    而且它漏宣告的話 jest 當場就 red —— 那是會自己現形的路徑。這條守門存在
 *    的理由是「沉默」，所以它只看沉默的那一半。
 *
 * ⚠️ 用 TypeScript 自己的 `preProcessFile` 取 import，不用正則。第一版用
 *    `grep -oE "from ['\"]..."` 掃出一堆英文散文（字串字面值裡的
 *    `from 'this is not your HRV now'`）—— 正則分不出程式與散文。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

/** The workspace this guard covers, relative to the repo root. */
const WORKSPACE = 'api';

const BUILTINS = new Set(builtinModules);

/**
 * Collects every `.ts`/`.tsx` file under a directory, skipping `node_modules`
 * and build output.
 *
 * @param {string} dir - Directory to walk.
 * @param {string[]} [out] - Accumulator.
 * @returns {string[]} Repo-relative file paths.
 */
function collectSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collectSourceFiles(full, out);
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * True for a file that never reaches the lambda bundle.
 *
 * @param {string} file - Repo-relative path.
 * @returns {boolean} Whether the file is a test.
 */
function isTestFile(file) {
  return file.includes(`__tests__${path.sep}`) || file.endsWith('.test.ts');
}

/**
 * The npm package name a module specifier belongs to, keeping a scope together
 * and dropping any subpath (`web-push/x` → `web-push`, `@a/b/c` → `@a/b`).
 *
 * @param {string} specifier - A module specifier as written in the source.
 * @returns {string} The package name.
 */
export function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * True when a specifier refers to an external npm package, rather than a
 * relative file or a Node built-in.
 *
 * @param {string} specifier - A module specifier as written in the source.
 * @returns {boolean} Whether it must be declared in package.json.
 */
export function isExternalPackage(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return false;
  if (specifier.startsWith('node:')) return false;
  return !BUILTINS.has(packageNameOf(specifier));
}

const manifest = JSON.parse(readFileSync(path.join(WORKSPACE, 'package.json'), 'utf8'));
// 🔴 `dependencies` only — see judgement call 1 in the header.
const declared = new Set(Object.keys(manifest.dependencies ?? {}));

/** @type {Map<string, string[]>} package name → the files importing it */
const required = new Map();
for (const file of collectSourceFiles(WORKSPACE).sort()) {
  if (isTestFile(file)) continue;
  const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), true, true);
  for (const { fileName: specifier } of importedFiles) {
    if (!isExternalPackage(specifier)) continue;
    const name = packageNameOf(specifier);
    if (!required.has(name)) required.set(name, []);
    if (!required.get(name).includes(file)) required.get(name).push(file);
  }
}

const missing = [...required].filter(([name]) => !declared.has(name));

// Print what was actually checked, not just the verdict: a guard whose output
// is only "ok" cannot be told apart from a guard that measured nothing.
console.log(`api/ 執行期外部套件：${required.size} 個（測試檔不計）`);
for (const [name, files] of [...required].sort()) {
  const mark = declared.has(name) ? '✓' : '✗';
  console.log(`  ${mark} ${name}  ←  ${files.join(', ')}`);
}

if (missing.length > 0) {
  console.error('');
  console.error('🚫 這些套件被 api/ 的執行期程式 import，卻沒有宣告在 api/package.json 的 dependencies：');
  for (const [name, files] of missing) {
    console.error(`   · ${name}  ←  ${files.join(', ')}`);
  }
  console.error('');
  console.error('   後果不是本機紅燈，是**正式站的 500**：lambda 的 bundle 以 api/package.json');
  console.error('   當邊界，沒宣告的套件不會被打進去 → Cannot find module（#304 實例，10 天）。');
  console.error('   修法：把它加進 api/package.json 的 dependencies（不是 devDependencies —— ');
  console.error('   lambda 只拿得到 dependencies），然後 npm install --package-lock-only。');
  process.exit(1);
}

if (required.size === 0) {
  // Not a pass worth trusting silently: zero externals is plausible today, but
  // it is also what a broken walker or parser would report.
  console.log('（api/ 目前沒有任何執行期外部 import —— 如果這不符預期，先懷疑這支腳本）');
}
console.log('✅ api/ 的執行期外部 import 全部有宣告在 dependencies');

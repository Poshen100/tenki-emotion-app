#!/usr/bin/env node
/**
 * preview-finger.mjs — merge gate for `/finger/`（手指基線實走頁）。
 *
 * 這一頁是 CI 盲區（PLAYBOOK §3），而它比其他 preview 頁更需要守門，
 * 因為它會**對使用者宣稱量測結果**。守三件事：
 *
 *  1. **鏡射漂移**：頁面跑的是 `apps/preview/engine/`，那是從
 *     `packages/engine/src` 編出來的。改了 TS 沒重建就紅。
 *  2. **拒答要真的拒答**：訊號不足時不得出現讀數，而且**不准上 gold**
 *     （gold = SECURED，`docs/VISUAL-DIRECTION.md` §3）。
 *  3. **版面**：390px 無橫向溢出、無 runtime error。
 *
 * 🔴 斷言的資料來自**真的 pipeline**：harness 用合成器造 frames 餵進頁面的
 * `window.__tenkiFingerHarness.renderFrames()`，頁面照常跑 `analyzePpgScan`
 * 再渲染。不是往 DOM 填數字 —— 那種 harness 守不住任何東西。
 *
 * 合成器**不在瀏覽器 bundle 裡**（刻意），所以這裡自己編一份到暫存目錄。
 */

import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getChromium } from './lib/playwright.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = '/apps/preview/finger-baseline.html';

let passed = 0;
let failed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const bad = (name, detail) => { failed++; console.log(`  ✗ ${name}\n      ${detail}`); };
const check = (name, cond, detail) => (cond ? ok(name) : bad(name, detail));

// ── 1. 鏡射同步 ─────────────────────────────────────────────────────────────
console.log('── 鏡射同步 ──');
try {
  execFileSync('node', [join(ROOT, 'scripts/build-preview-ppg.mjs'), '--check'], {
    cwd: ROOT, stdio: 'pipe',
  });
  ok('apps/preview/engine 與 packages/engine 同步');
} catch (err) {
  bad('apps/preview/engine 與 packages/engine 同步', String(err.stderr || err).trim());
}

// ── 合成器（harness 專用，不進瀏覽器）────────────────────────────────────────
const replayDir = mkdtempSync(join(tmpdir(), 'ppg-replay-'));
const tsconfig = join(replayDir, 'tsconfig.json');
writeFileSync(tsconfig, JSON.stringify({
  compilerOptions: {
    strict: true, target: 'ES2022', module: 'ES2022', moduleResolution: 'node',
    declaration: false, outDir: replayDir, rootDir: join(ROOT, 'packages/engine/src'),
  },
  files: [join(ROOT, 'packages/engine/src/biometric/ppg/replay.ts')],
}));
execFileSync('npx', ['tsc', '-p', tsconfig], { cwd: ROOT, stdio: 'inherit' });
const replayFile = join(replayDir, 'biometric/ppg/replay.js');
writeFileSync(
  replayFile,
  readFileSync(replayFile, 'utf8').replace(
    /(\bfrom\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
    (m, a, s, b) => (s.endsWith('.js') ? m : `${a}${s}.js${b}`),
  ),
);
const { synthesizePpg, PPG_FIXTURES } = await import(replayFile);

// ── 靜態伺服器 ───────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } else { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const chromium = await getChromium();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${base}${PAGE}`, { waitUntil: 'networkidle' });

/** 用合成 frames 讓頁面真的跑一次 pipeline，回傳畫面上的結果。 */
async function runScan(options) {
  const { frames } = synthesizePpg({ durationSec: 90, ...options });
  return page.evaluate((f) => {
    window.__tenkiFingerHarness.renderFrames(f);
    const text = (id) => document.getElementById(id).textContent.trim();
    const stage = document.getElementById('stage');
    return {
      phase: stage.dataset.phase,
      secured: stage.dataset.secured,
      verdict: text('verdict'),
      verdictColor: getComputedStyle(document.getElementById('verdict')).color,
      hr: text('hr'),
      quality: text('qualityScore'),
      derivation: text('derivation'),
      bodyText: document.getElementById('stage').innerText,
      reasons: [...document.querySelectorAll('#resultReasons .reason')].map((n) => n.textContent),
      withheld: [...document.querySelectorAll('#withheld .reason')].map((n) => n.textContent),
      withheldHead: text('withheldHead'),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, frames);
}

// ── 2. 乾淨訊號：脈搏讀到，而且只有脈搏 ────────────────────────────────────
console.log('\n── 乾淨訊號 ──');
const clean = await runScan({});
check('進入結果階段', clean.phase === 'result', `phase=${clean.phase}`);
check('脈搏有讀數', /^\d+ bpm$/.test(clean.hr), `hr=${clean.hr}`);
check('品質分數是數字', /^\d+$/.test(clean.quality), `quality=${clean.quality}`);
check('列出了品質理由', clean.reasons.length > 0, '一條都沒有');
check(
  '立住讀數時才標示 SECURED',
  clean.secured === 'yes',
  `secured=${clean.secured}`,
);
check('390px 無橫向溢出', clean.overflowX === 0, `多出 ${clean.overflowX}px`);

// 🔴 相機 HRV / 呼吸率是關掉的（feature flag `camera_hrv_estimates` 預設 false）。
// 關掉的意思是**畫面上不得出現那兩個數字**，不是引擎算了但沒人看。
check(
  '🔴 沒有任何心律變異數值',
  !/\d+(\.\d+)?\s*ms/.test(clean.bodyText),
  `頁面上出現了 ms 數值：${clean.bodyText.match(/.{0,24}\d+(\.\d+)?\s*ms.{0,24}/)?.[0]}`,
);
check(
  '🔴 沒有任何呼吸率數值',
  !/brpm/.test(clean.bodyText),
  '頁面上出現了 brpm',
);
check(
  '講明讀數怎麼來的，並且講明相機做不到什麼',
  clean.derivation.includes('相機指尖 PPG') && clean.derivation.includes('不報心律變異'),
  `derivation=${clean.derivation}`,
);
check(
  '⚠️ 成功的校準不得把相機本來就不報的項目列成「這次沒報」',
  clean.withheld.length === 0 && !clean.withheldHead.includes('沒有報'),
  `head=${clean.withheldHead} withheld=${JSON.stringify(clean.withheld)}`,
);
check(
  '一次校準不得自稱基線',
  !/一次.{0,6}基線/.test(clean.bodyText) && !clean.derivation.includes('基線'),
  `bodyText 提到基線的地方：${clean.bodyText.match(/.{0,20}基線.{0,20}/)?.[0]}`,
);

// ── 3. 訊號不足：必須拒答，而且不准上 gold ─────────────────────────────────
console.log('\n── 訊號不足（低灌流）──');
const weak = await runScan(PPG_FIXTURES.lowPerfusion);
check('沒有脈搏讀數', weak.hr === '—', `hr=${weak.hr}`);
check('說明了為什麼沒報', weak.withheld.length > 0, '沒有列出任何 withheld');
// 🔴 這一條在守 engine 的早退路徑：心率立不住時，HRV 的理由也必須是
// 「這個模式不報」而不是「節律不穩」—— 否則相機 HRV 明明關著，畫面卻會
// 冒出兩行更弱的理由。⚠️ 只斷言「沒有出現某句話」擋不住它（那句話被頁面
// 過濾掉了，兩種寫法都會通過），所以這裡斷言**列出的條數**。
check(
  '扣住的只有脈搏本身，不多不少',
  weak.withheld.length === 1 && weak.withheld[0].includes('脈搏'),
  `withheld=${JSON.stringify(weak.withheld)}`,
);
check(
  '🔴 沒有讀數就不准上 gold',
  weak.secured === 'no' && weak.verdictColor !== clean.verdictColor,
  `secured=${weak.secured} color=${weak.verdictColor}（乾淨時 ${clean.verdictColor}）`,
);
check(
  '低灌流的理由講得出可以怎麼改',
  weak.reasons.some((r) => r.includes('太冰') || r.includes('施力')),
  `reasons=${JSON.stringify(weak.reasons)}`,
);
check(
  '⚠️ 建議不得與同時顯示的正面理由自相矛盾',
  !(weak.reasons.some((r) => r.includes('覆蓋完整')) && weak.reasons.some((r) => r.includes('蓋住鏡頭'))),
  `reasons=${JSON.stringify(weak.reasons)}`,
);

// ── 4. 掉幀：脈搏仍然立得住 ────────────────────────────────────────────────
// 掉幀會毀掉毫秒級的拍間距，但不會毀掉每分鐘幾拍。相機只報後者，所以這一格
// 是「該報的還是報得出來」，不是「又少一項」。
console.log('\n── 掉幀 ──');
const drops = await runScan(PPG_FIXTURES.frameDrops);
check('脈搏仍然讀得到', /^\d+ bpm$/.test(drops.hr), `hr=${drops.hr}`);
check('掉幀被講出來', drops.reasons.some((r) => r.includes('掉幀')), `reasons=${JSON.stringify(drops.reasons)}`);

// ── 5. runtime ─────────────────────────────────────────────────────────────
console.log('\n── 執行時期 ──');
check('沒有 runtime error', errors.length === 0, errors.join(' | '));

// ── 截圖（給人看，不是斷言）─────────────────────────────────────────────────
const shot = process.env.FINGER_SHOT;
if (shot) {
  await runScan({});
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`\n  📸 ${shot}`);
}
const shotWeak = process.env.FINGER_SHOT_WEAK;
if (shotWeak) {
  await runScan(PPG_FIXTURES.lowPerfusion);
  await page.screenshot({ path: shotWeak, fullPage: true });
  console.log(`  📸 ${shotWeak}`);
}

await browser.close();
server.close();

console.log(`\n══════════ preview-finger ══════════`);
console.log(` ${passed} passed, ${failed} failed`);
console.log(`════════════════════════════════════`);
process.exit(failed > 0 ? 1 : 0);

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
// 這一頁是 CI 盲區，而 module-level 的 SyntaxError 會讓所有斷言以
// 「__tenkiFingerHarness undefined」的形式失敗 —— 看不出真正原因。
if (process.env.FINGER_DEBUG) {
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
  page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
}

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
      stageTerm: text('stageTerm'),
      stageName: text('stageName'),
      stageNote: text('stageNote'),
      bandShown: document.getElementById('bandRow').offsetParent !== null,
      band: text('band'),
      howText: document.getElementById('how').textContent,
      prv: text('prv'),
      prvShown: !document.getElementById('prvRow').hidden,
      prvNote: text('prvNote'),
      prvCompare: text('prvCompare'),
      // 🔴 PRV 只能待在證據層。這裡問的是 DOM 的歸屬，不是可見性 ——
      // 收起來的 <details> 裡的節點 offsetParent 仍然不是 null。
      report: document.getElementById('validationReport').textContent,
      channelNote: document.getElementById('channelNote').textContent,
      reportInEvidenceLayer: document.getElementById('how').contains(
        document.getElementById('validationReport'),
      ),
      scenarioPressed: [...document.querySelectorAll('.scenario')]
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map((b) => b.dataset.scenario),
      prvInEvidenceLayer: document.getElementById('how').contains(
        document.getElementById('prvRow'),
      ),
      headlineCardText: document.getElementById('hr').closest('section').innerText,
      advisories: [...document.querySelectorAll('#advisories .reason')].map((n) => n.textContent),
      advisoryColor: document.querySelector('#advisories .reason')
        ? getComputedStyle(document.querySelector('#advisories .reason')).color
        : null,
      withheldHeadShown: document.getElementById('withheldHead').offsetParent !== null,
      frameNote: text('frameNote'),
      dims: [...document.querySelectorAll('#resultDims .dim')].map((row) => ({
        key: row.dataset.key,
        label: row.querySelector('.dimLabel').textContent,
        value: Number.parseInt(row.querySelector('.dimValue').textContent, 10),
        // ⚠️ 量**真的幾何**，不是 style.width。第一版讀 inline style，所以
        // 四條 bar 因為 inline span 忽略 width 而完全沒渲染時，斷言照樣綠。
        width: Math.round(
          (row.querySelector('.dimFill').getBoundingClientRect().width /
            row.querySelector('.dimTrack').getBoundingClientRect().width) * 100,
        ),
        trackWidth: Math.round(row.querySelector('.dimTrack').getBoundingClientRect().width),
        fillHeight: Math.round(row.querySelector('.dimFill').getBoundingClientRect().height),
        low: row.dataset.low,
        animation: getComputedStyle(row.querySelector('.dimFill')).animationName,
      })),
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
  '🔴 沒有任何東西被標成「心律變異」',
  !/心律變異(?!是兩個量)/.test(clean.bodyText.replace(/這不是心律變異[^。]*。/g, '')),
  `頁面上出現了心律變異：${clean.bodyText.match(/.{0,30}心律變異.{0,30}/)?.[0]}`,
);
check(
  '🔴 有 ms 數值時，它必須被說清楚不是心律變異',
  !/\d+(\.\d+)?\s*ms/.test(clean.bodyText) ||
    (clean.prvNote.includes('不是心律變異') && clean.prvNote.includes('相機')),
  `prvNote=${clean.prvNote}`,
);
check(
  '🔴 沒有任何呼吸率數值',
  !/brpm/.test(clean.bodyText),
  '頁面上出現了 brpm',
);
check(
  '講明讀數怎麼來的，並且講明相機做不到什麼',
  clean.derivation.includes('相機指尖 PPG') && clean.derivation.includes('不報呼吸率'),
  `derivation=${clean.derivation}`,
);
check(
  '⚠️ 成功的校準不得把相機本來就不報的項目列成「這次沒報」',
  clean.withheld.length === 0 && !clean.withheldHeadShown,
  `head 顯示中=${clean.withheldHeadShown} withheld=${JSON.stringify(clean.withheld)}`,
);
// 🔴 沒有補光燈是**記錄**，不是拒收條件（founder 2026-09-11）。harness 跑在
// 沒有相機的無頭瀏覽器裡，所以 torch 一定不可用 —— 正好是這條的實走條件。
check(
  '沒有補光燈會被說出來',
  clean.advisories.some((a) => a.includes('補光燈')),
  JSON.stringify(clean.advisories),
);
check(
  '🔴 但它不會讓一個立住的讀數變得不算數',
  clean.secured === 'yes' && clean.hr !== '—',
  `secured=${clean.secured} hr=${clean.hr}`,
);
check(
  '而且它不吃警示色（那不是錯）',
  clean.advisoryColor !== null &&
    clean.reasons.length > 0 &&
    clean.advisoryColor !== 'rgb(255, 160, 40)',
  `color=${clean.advisoryColor}`,
);
check(
  '一次校準不得自稱基線',
  !/一次.{0,6}基線/.test(clean.bodyText) && !clean.derivation.includes('基線'),
  `bodyText 提到基線的地方：${clean.bodyText.match(/.{0,20}基線.{0,20}/)?.[0]}`,
);

// ── 2b. Signal Integrity 儀表 ──────────────────────────────────────────────
// 🔴 這一頁對使用者宣稱量測品質，所以儀表必須是**引擎算出來的值**，不是動畫。
console.log('\n── 訊號完整度儀表 ──');
check(
  '四個維度都在',
  clean.dims.length === 4 &&
    clean.dims.map((d) => d.key).join() ===
      'contactCoverage,lightStability,motionArtifact,rhythmicCoherence',
  `dims=${JSON.stringify(clean.dims.map((d) => d.key))}`,
);
check(
  'bar 真的畫出來了（有高度、軌道有寬度）',
  clean.dims.every((d) => d.fillHeight > 0 && d.trackWidth > 100),
  JSON.stringify(clean.dims.map((d) => [d.key, d.fillHeight, d.trackWidth])),
);
check(
  'bar 畫出來的長度就是顯示的數字（不是另外一個動畫值）',
  clean.dims.every((d) => Math.abs(d.width - d.value) <= 2),
  JSON.stringify(clean.dims.map((d) => [d.key, d.value, d.width])),
);
check(
  '乾淨訊號四個維度都不算低',
  clean.dims.every((d) => d.low === 'no' && d.value >= 60),
  JSON.stringify(clean.dims.map((d) => [d.key, d.value])),
);
check(
  '🔴 沒有任何律動動效（拒答時演一個沒發生的量測）',
  clean.dims.every((d) => d.animation === 'none'),
  JSON.stringify(clean.dims.map((d) => [d.key, d.animation])),
);
check(
  '講出有多少幀真的能用',
  /^\d+ \/ \d+ 幀/.test(clean.frameNote) && clean.frameNote.includes('秒'),
  `frameNote=${clean.frameNote}`,
);

// 維度要對條件有反應 —— 晃動的擷取必須在「穩定」上讀得比較差。
const shaky = await runScan({ motionAmplitude: 1.2 });
const stillness = (r) => r.dims.find((d) => d.key === 'motionArtifact').value;
check(
  '晃動的擷取在「穩定」維度上讀得比較差',
  stillness(shaky) < stillness(clean),
  `晃動 ${stillness(shaky)}% vs 乾淨 ${stillness(clean)}%`,
);
check(
  '讀得差的維度被標出來，使用者才知道要改哪裡',
  shaky.dims.some((d) => d.low === 'yes'),
  JSON.stringify(shaky.dims.map((d) => [d.key, d.value, d.low])),
);

// ── 2b2. 就位閘（90 秒的鐘還沒開始）────────────────────────────────────────
// 🔴 這一段守的是實機第一次燒掉兩次完整擷取的那個結構問題：按下去就起跑。
// 最重要的一條是「飽和不擋開始」—— 擋了就會把 channels.ts 剛修好的閃光燈
// 情境原地打回去，而那條錯誤在畫面上長得**像是更嚴謹**。
console.log('\n── 就位閘 ──');

/** 把幀切成不重疊的窗口餵進閘，回傳每一步畫面上的狀態。 */
async function replayGate(options, windows) {
  const { frames } = synthesizePpg({ durationSec: 30, ...options });
  await page.evaluate(() => window.__tenkiFingerHarness.resetGate());
  return page.evaluate(
    ({ all, windows: n }) => {
      const h = window.__tenkiFingerHarness;
      const width = h.readinessWindowSec() * 1000;
      const steps = [];
      const t0 = all[0].timestampMs;
      for (let i = 0; i < n; i++) {
        const from = t0 + i * width;
        const gate = h.renderGateWindow(
          all.filter((f) => f.timestampMs >= from && f.timestampMs <= from + width),
        );
        const advisory = document.getElementById('readyAdvisory');
        steps.push({
          gate,
          coach: document.getElementById('coach').textContent.trim(),
          rail: [...document.querySelectorAll('.railStep')].map((n2) => ({
            step: n2.dataset.step,
            state: n2.dataset.state,
          })),
          dots: [...document.querySelectorAll('.holdDot')].map((n2) => n2.dataset.on),
          dims: [...document.querySelectorAll('#readyDims .dim')].map((row) => ({
            key: row.dataset.key,
            value: row.querySelector('.dimValue').textContent.trim(),
            width: row.querySelector('.dimFill').getBoundingClientRect().width,
          })),
          advisoryShown: !advisory.hidden && advisory.getBoundingClientRect().height > 0,
          advisoryText: advisory.textContent.trim(),
          skipShown: !document.getElementById('skipGate').hidden,
          elapsed: document.getElementById('elapsed').textContent.trim(),
          scanVisible: document.querySelector('.only-scan').getBoundingClientRect().height > 0,
          coachVisible: document.getElementById('coach').getBoundingClientRect().height > 0,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        });
      }
      return steps;
    },
    { all: frames, windows },
  );
}

const holdWindows = await page.evaluate(() =>
  window.__tenkiFingerHarness.readinessHoldWindows(),
);

const gateClean = await replayGate({}, holdWindows + 1);
check(
  '乾淨訊號：撐滿 hold 之後才 ready，之前不是',
  gateClean.slice(0, holdWindows - 1).every((s2) => s2.gate.ready === false) &&
    gateClean[holdWindows - 1].gate.ready === true,
  JSON.stringify(gateClean.map((s2) => s2.gate)),
);
check(
  '🔴 就位期間 90 秒的鐘沒有在走（掃描區塊不在畫面上，計時停在 0s）',
  gateClean.every((s2) => s2.scanVisible === false && s2.elapsed.startsWith('0s')),
  JSON.stringify(gateClean.map((s2) => ({ scan: s2.scanVisible, t: s2.elapsed }))),
);
check(
  'hold 的進度是看得見的（點亮的點數 = held）',
  gateClean.every((s2) => s2.dots.filter((d) => d === 'yes').length === s2.gate.held),
  JSON.stringify(gateClean.map((s2) => ({ held: s2.gate.held, dots: s2.dots }))),
);
check(
  '階段軌指到現在這一階，前面的標成完成',
  gateClean[0].rail.find((r) => r.step === 'hold')?.state === 'now' &&
    gateClean[0].rail.find((r) => r.step === 'approach')?.state === 'done' &&
    gateClean[holdWindows - 1].rail.find((r) => r.step === 'ready')?.state === 'now',
  JSON.stringify([gateClean[0].rail, gateClean[holdWindows - 1].rail]),
);
check(
  '三條 bar 真的畫出來了（量幾何，不是量 style 字串）',
  gateClean[0].dims.length === 3 && gateClean[0].dims.every((d) => d.width > 0),
  JSON.stringify(gateClean[0].dims),
);
check(
  '逃生口一開始不出現',
  gateClean.every((s2) => s2.skipShown === false),
  JSON.stringify(gateClean.map((s2) => s2.skipShown)),
);

const gateOff = await replayGate({ coverage: 0.1 }, 2);
check(
  '手指不在鏡頭上：說得出要做什麼，而且 hold 歸零',
  gateOff.every((s2) => s2.gate.blocker === 'no_contact' && s2.gate.held === 0) &&
    gateOff[0].coach.includes('指腹'),
  JSON.stringify(gateOff.map((s2) => ({ b: s2.gate.blocker, c: s2.coach }))),
);
check(
  '只蓋一半：跟「沒放上去」是不同的一句話',
  (await replayGate({ coverage: 0.45 }, 1))[0].gate.blocker === 'partial_contact',
  '',
);

// 🔴 這一條是整段最重要的。紅通道打飽和（閃光燈）的擷取在 90 秒後**有讀數**
// （走綠通道），所以就位閘不准擋它 —— 擋了就是把 channels.ts 的修正撤掉。
const gateClipped = await replayGate(PPG_FIXTURES.clipped, holdWindows);
check(
  '🔴 紅通道飽和：講，但不擋 —— 而且講的是「會改走綠通道」',
  gateClipped.every((s2) => s2.gate.blocker === null) &&
    gateClipped[0].gate.advisories.includes('over_exposed') &&
    gateClipped[0].advisoryShown &&
    gateClipped[0].advisoryText.includes('綠通道') &&
    gateClipped[holdWindows - 1].gate.ready === true,
  JSON.stringify(gateClipped.map((s2) => ({ b: s2.gate.blocker, a: s2.gate.advisories }))),
);
check(
  '🔴 晃動：一樣是講不是擋（motion fixture 90 秒後也有讀數）',
  (await replayGate(PPG_FIXTURES.motion, 1))[0].gate.advisories.includes('moving'),
  '',
);
check(
  '就位畫面在 390px 下不橫向溢出，教練句看得見',
  gateClean.every((s2) => s2.overflowX <= 0 && s2.coachVisible),
  JSON.stringify(gateClean.map((s2) => ({ o: s2.overflowX, v: s2.coachVisible }))),
);
// ⚠️ 「看得見」擋不住空字串：`.coach` 有 min-height，沒有字照樣有高度。
// 第一版就是這樣 —— 使用者**做對的時候**那一行是空白的（截圖抓到，不是斷言）。
const everyGateStep = [...gateClean, ...gateOff, ...gateClipped];
check(
  '🔴 每一步都有話說 —— 包含「沒有東西擋著」那一步',
  everyGateStep.every((s2) => s2.coach.length > 0),
  JSON.stringify(everyGateStep.map((s2) => ({ b: s2.gate.blocker, c: s2.coach }))),
);

// ── 2b3. 覆蓋地圖（手指「哪裡」沒蓋到）──────────────────────────────────────
// 🔴 這一段餵的是**真的像素**進真的取樣器（`renderSampledCells`）。合成器
// 給的是已經化簡完的 PpgFrame，所以像素 → 格子的索引換算沒有別的路徑驗得到，
// 而那正是 off-by-one 會住的地方 —— 指錯邊的地圖比沒有地圖更糟。
console.log('\n── 覆蓋地圖 ──');

await page.evaluate(() => window.__tenkiFingerHarness.resetGate());
const grid = await page.evaluate(() => window.__tenkiFingerHarness.coverageGrid());
const sampleSize = await page.evaluate(() => window.__tenkiFingerHarness.sampleSize());
const cellPx = sampleSize / grid;

/** 餵一塊留白矩形，回傳畫面狀態＋地圖。 */
const sampleCover = (bare) =>
  page.evaluate((b) => {
    const out = window.__tenkiFingerHarness.renderSampledCells(b);
    const cells = [...document.querySelectorAll('#coverGrid .coverCell')];
    return {
      ...out,
      cellCount: cells.length,
      uncoveredIndexes: cells.flatMap((c, i) => (c.dataset.covered === 'no' ? [i] : [])),
      geometry: cells.map((c) => {
        const r = c.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }),
      wellGap: document.getElementById('coverWell').dataset.gap,
      wellBorder: getComputedStyle(document.getElementById('coverWell')).borderTopColor,
      cellColours: [...new Set(cells.map((c) => getComputedStyle(c).backgroundColor))],
      legendVisible:
        document.querySelector('.coverLegend').getBoundingClientRect().height > 0,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, bare);

const fullCover = await sampleCover(null);
check(
  `格子真的畫出來了（${grid}×${grid} 個，每個都有幾何）`,
  fullCover.cellCount === grid * grid && fullCover.geometry.every((g) => g.w > 0 && g.h > 0),
  JSON.stringify({ n: fullCover.cellCount, g: fullCover.geometry.slice(0, 3) }),
);
check(
  '蓋滿時沒有任何一格標成漏光，井框也不是警示色',
  fullCover.uncoveredIndexes.length === 0 && fullCover.wellGap === 'no',
  JSON.stringify({ u: fullCover.uncoveredIndexes, gap: fullCover.wellGap }),
);

// 🔴 索引換算：留白整條**上緣**，標出來的必須剛好是第一列。
const topBare = await sampleCover({ x: 0, y: 0, w: sampleSize, h: cellPx });
check(
  '🔴 上緣漏光 → 標出來的剛好是第一列（像素 → 格子的換算沒有錯位）',
  JSON.stringify(topBare.uncoveredIndexes) ===
    JSON.stringify(Array.from({ length: grid }, (_, i) => i)),
  JSON.stringify(topBare.uncoveredIndexes),
);
check(
  '上緣漏光時井框變警示色',
  topBare.wellGap === 'yes' && topBare.wellBorder !== fullCover.wellBorder,
  JSON.stringify({ gap: topBare.wellGap, border: topBare.wellBorder }),
);

// 🔴 而且左緣要標成左緣，不是上緣 —— 轉置寫錯的話這兩條剛好互換。
const leftBare = await sampleCover({ x: 0, y: 0, w: cellPx, h: sampleSize });
check(
  '🔴 左緣漏光 → 標出來的剛好是第一欄（row/col 沒有互換）',
  JSON.stringify(leftBare.uncoveredIndexes) ===
    JSON.stringify(Array.from({ length: grid }, (_, i) => i * grid)),
  JSON.stringify(leftBare.uncoveredIndexes),
);

// 🔴 地圖與閘門讀同一個數字 —— 在真的像素上，不只在單元測試的算術上。
// ⚠️ 留白**故意不對齊格線**（半格高）。第一版用整格的圖樣，而整格圖樣下
// 「像素比例」與「蓋到的格子比例」剛好相等（0.75 = 0.75）—— 那條斷言把
// coverage 改成 covered-cell 比例照樣綠，是裝飾。半格才分得開：
// 像素 0.875，格子比例 0.75。
const halfCellBare = await sampleCover({ x: 0, y: 0, w: sampleSize, h: cellPx / 2 });
const coveredCellRatio =
  (grid * grid - halfCellBare.uncoveredIndexes.length) / (grid * grid);
check(
  '🔴 地圖的 coverage 就是這一幀的 coverage（不是第二個估計值）',
  Math.abs(halfCellBare.frameCoverage - halfCellBare.map.coverage) < 1e-9 &&
    Math.abs(halfCellBare.map.coverage - coveredCellRatio) > 1e-6,
  JSON.stringify({
    frame: halfCellBare.frameCoverage,
    map: halfCellBare.map.coverage,
    cellRatio: coveredCellRatio,
  }),
);

check(
  '🔴 地圖上不出現語意綠（綠 = 跟著流程完成，這裡還沒有結果）',
  topBare.cellColours.every((c) => !/rgb\(\s*52,\s*199,\s*89/.test(c)),
  JSON.stringify(topBare.cellColours),
);
check(
  '圖例看得見（不然兩種顏色沒人知道哪個是哪個）',
  fullCover.legendVisible,
  '',
);
check(
  '覆蓋地圖在 390px 下不橫向溢出',
  fullCover.overflowX <= 0 && topBare.overflowX <= 0,
  JSON.stringify([fullCover.overflowX, topBare.overflowX]),
);

// 🔴 地圖的產品價值：使用者不必先看懂那張圖。
await sampleCover({ x: 0, y: 0, w: cellPx, h: sampleSize });
const coachEdge = await page.evaluate(() =>
  window.__tenkiFingerHarness.renderGateWithBlocker('partial_contact'),
);
check(
  '教練句講得出缺口長什麼樣（不是「再蓋滿一點」），並把使用者導向那張圖',
  coachEdge.includes('漏光') && coachEdge.includes('圖') && coachEdge.includes('一邊'),
  coachEdge,
);
// 左上角 2×2 格：上緣 2 格、左緣 2 格 —— 平手才是真的角落（單邊漏光會只報一邊）。
await sampleCover({ x: 0, y: 0, w: cellPx * 2, h: cellPx * 2 });
const coachCorner = await page.evaluate(() =>
  window.__tenkiFingerHarness.renderGateWithBlocker('partial_contact'),
);
check(
  '一個角跟一邊講的不是同一句（跟方位無關，所以講得起）',
  coachCorner.includes('角') && !coachCorner.includes('一邊'),
  coachCorner,
);
// 🔴 而且**不准講方向**：影像座標的上緣對應到手機的哪一邊還沒在真機驗過
// （驗收清單第 20 條）。叫使用者往錯的方向移動比什麼都不說更糟。
check(
  '🔴 沒有在真機驗過影像↔實體方位以前，文案不得講方向',
  ![coachEdge, coachCorner].some((line) => /往[上下左右]|[上下左右]邊還在|[上下左右]移/.test(line)),
  JSON.stringify([coachEdge, coachCorner]),
);
await sampleCover({ x: cellPx, y: cellPx, w: cellPx, h: cellPx });
const coachCentre = await page.evaluate(() =>
  window.__tenkiFingerHarness.renderGateWithBlocker('partial_contact'),
);
check(
  '中間沒貼到跟邊緣漏光是不同的一句話（手指拱起來，不是放歪）',
  coachCentre.includes('拱') && !coachCentre.includes('漏光'),
  coachCentre,
);
// 🔴 截圖抓到的：閘門看 1.5 秒窗口、地圖看現在，所以窗口過得了的同時畫面上
// 可以有一格是亮的 —— 而「維持住，不要動」印在看得見的缺口旁邊是自相矛盾。
await sampleCover({ x: 0, y: 0, w: cellPx, h: cellPx });
const coachNoBlocker = await page.evaluate(() =>
  window.__tenkiFingerHarness.renderGateWithBlocker(null),
);
check(
  '🔴 地圖上還有缺口時，教練句不得說「維持住」',
  !coachNoBlocker.includes('維持住') && coachNoBlocker.includes('漏光'),
  coachNoBlocker,
);
await sampleCover(null);
const coachClean = await page.evaluate(() =>
  window.__tenkiFingerHarness.renderGateWithBlocker(null),
);
check(
  '真的蓋滿了才說「維持住」',
  coachClean.includes('維持住'),
  coachClean,
);

// ── 2c. 掃描進行中 ─────────────────────────────────────────────────────────
// 🔴 掃描階段以前完全沒有 harness 走過。那個盲區藏住過一個真的 bug（即時層
// 用整段的時長門檻評 20 秒窗口 → 每次即時回饋都說「時間不足」），所以現在
// 把整段擷取當成使用者實際看到的序列走一遍。
console.log('\n── 掃描進行中 ──');

/** 把一段擷取當成使用者看到的序列走一遍，回傳每一步畫面上的狀態。 */
async function replayLive(options) {
  const { frames } = synthesizePpg({ durationSec: 90, ...options });
  await page.evaluate(() => window.__tenkiFingerHarness.resetLock());
  return page.evaluate((all) => {
    const steps = [];
    const t0 = all[0].timestampMs;
    for (let end = 2; end <= 90; end += 2) {
      window.__tenkiFingerHarness.renderLiveFrames(
        all.filter((f) => f.timestampMs <= t0 + end * 1000),
      );
      const stage = document.getElementById('stage');
      steps.push({
        endSec: end,
        locked: stage.dataset.locked,
        lockText: document.getElementById('lock').textContent.trim(),
        quality: document.getElementById('liveQuality').textContent.trim(),
        reasons: [...document.querySelectorAll('#liveReasons .reason')].map((n) => n.textContent),
        dims: [...document.querySelectorAll('#liveDims .dim')].map((row) => ({
          key: row.dataset.key,
          value: row.querySelector('.dimValue').textContent.trim(),
          pending: row.dataset.pending,
        })),
        elapsed: document.getElementById('elapsed').textContent.trim(),
        arcPercent: Number(
          getComputedStyle(document.getElementById('arc')).getPropertyValue('--p'),
        ),
        arcOpacity: Number(getComputedStyle(document.getElementById('arc')).opacity),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      });
    }
    return steps;
  }, frames);
}

const liveClean = await replayLive({});
const first = liveClean[0];
const last = liveClean[liveClean.length - 1];
const rhythmOf = (step) => step.dims.find((d) => d.key === 'rhythmicCoherence');

check(
  '第一步就給接觸與光的回饋（不必等窗口長到能找節律）',
  first.dims.filter((d) => d.pending === 'no').length >= 3,
  JSON.stringify(first.dims),
);
check(
  '🔴 窗口還不夠長時，節律寫「累積中」而不是 0%',
  rhythmOf(first).pending === 'yes' && rhythmOf(first).value === '累積中',
  JSON.stringify(rhythmOf(first)),
);
check(
  '窗口夠長之後節律給得出數字',
  rhythmOf(last).pending === 'no' && /^\d+%$/.test(rhythmOf(last).value),
  JSON.stringify(rhythmOf(last)),
);
check(
  '⚠️ 即時回饋不得說整段掃描「時間不足」',
  liveClean.every((s) => !s.reasons.some((r) => r.includes('時間不足'))),
  JSON.stringify(liveClean.find((s) => s.reasons.some((r) => r.includes('時間不足')))),
);
check(
  '即時品質分數不是被整段門檻壓平的低分',
  Number(last.quality) > 20,
  `quality=${last.quality}`,
);
check(
  '乾淨訊號會穩住（Pulse Lock）',
  liveClean.some((s) => s.locked === 'yes') && last.locked === 'yes',
  `locked 序列=${liveClean.map((s) => s.locked).join('')}`,
);
check(
  '穩住不是第一步就發生 —— 要先持續幾個窗口',
  liveClean[0].locked === 'no' && liveClean[1].locked === 'no',
  `前兩步=${liveClean.slice(0, 2).map((s) => s.locked).join()}`,
);
check(
  '進度環反映實際經過的時間',
  /^\d+s \/ 90s$/.test(last.elapsed) && last.arcPercent > 90 && last.arcOpacity === 1,
  `elapsed=${last.elapsed} arc=${last.arcPercent}% opacity=${last.arcOpacity}`,
);
check(
  '390px 掃描中也無橫向溢出',
  liveClean.every((s) => s.overflowX === 0),
  `最大溢出 ${Math.max(...liveClean.map((s) => s.overflowX))}px`,
);

// 🔴 最重要的一條：會被拒答的擷取，掃描期間不得出現「穩住了」。
const liveWeak = await replayLive(PPG_FIXTURES.lowPerfusion);
check(
  '🔴 最終會被拒答的擷取，掃描期間從沒說過訊號穩住',
  liveWeak.every((s) => s.locked === 'no'),
  `locked 序列=${liveWeak.map((s) => s.locked).join('')}`,
);
check(
  '而且掃描期間就講得出可以怎麼改',
  liveWeak.some((s) => s.reasons.some((r) => r.includes('太冰') || r.includes('施力'))),
  JSON.stringify(liveWeak[liveWeak.length - 1].reasons),
);

// 🔴 PRV 有自己的閘門（拍形穩定度），而那個閘門是唯一看得到感光雜訊的東西。
check(
  '乾淨擷取會報脈搏節律',
  clean.prvShown && /^\d+(\.\d+)? ms$/.test(clean.prv),
  `顯示=${clean.prvShown} prv=${clean.prv}`,
);
check(
  '🔴 PRV 只出現在證據層，不是頭條讀數',
  clean.prvInEvidenceLayer && !/ms/.test(clean.headlineCardText),
  `在證據層=${clean.prvInEvidenceLayer} 頭條卡=${clean.headlineCardText.replace(/\n/g, ' | ')}`,
);
check(
  '用的是核准的名字（脈搏節律／相機推導的靜息脈搏變化）',
  clean.prvNote.includes('相機推導的靜息脈搏變化'),
  `prvNote=${clean.prvNote}`,
);
check(
  '而且每次都講明它不是心律變異、不能跟手錶比、不進分數',
  clean.prvNote.includes('不是心律變異') &&
    clean.prvNote.includes('拍形穩定度') &&
    clean.prvNote.includes('不進你的分數'),
  `prvNote=${clean.prvNote}`,
);
check(
  '🔴 PRV 的說法不得沾上壓力／恢復／準備度／自律神經',
  !/(壓力|恢復|準備度|交感|副交感|迷走)/.test(`${clean.prvNote}${clean.prvCompare}`),
  `prv 文案=${clean.prvNote} / ${clean.prvCompare}`,
);
check(
  '沒有足夠可比較的紀錄之前，不跟使用者自己比',
  clean.prvCompare.includes('還在累積') && /\d+\/\d+/.test(clean.prvCompare),
  `prvCompare=${clean.prvCompare}`,
);

// ── 2c2. 前 15 秒的誠實，與曝光診斷 ────────────────────────────────────────
// 🔴 兩條都是 founder 實機回報的：
//   1.「一條橫杠，使用者的感受可能會覺得壞掉了」—— 品質分數在前 15 秒是 null。
//   2.「找不到穩定的脈搏節律（跑一半了仍然是零%）」—— 畫面上沒有任何數字
//      說得出為什麼。曝光擺動就是那個數字。
console.log('\n── 掃描中的誠實 ──');

/** 走到指定秒數，回傳中央讀數與曝光那一行。 */
async function liveAt(options, endSec) {
  const { frames } = synthesizePpg({ durationSec: 90, ...options });
  await page.evaluate(() => window.__tenkiFingerHarness.resetLock());
  return page.evaluate(
    ({ all, end }) => {
      const t0 = all[0].timestampMs;
      window.__tenkiFingerHarness.renderLiveFrames(
        all.filter((f) => f.timestampMs <= t0 + end * 1000),
      );
      const h = window.__tenkiFingerHarness;
      return {
        quality: h.qualityCentre(),
        exposure: h.exposureNote(),
        dims: [...document.querySelectorAll('#liveDims .dim')].map((row) => ({
          key: row.dataset.key,
          value: row.querySelector('.dimValue').textContent.trim(),
        })),
      };
    },
    { all: frames, end: endSec },
  );
}

const early = await liveAt({}, 6);
check(
  '🔴 前 15 秒不畫一條橫槓 —— 用跟「節律」同一個字說「累積中」',
  early.quality.pending === 'yes' &&
    early.quality.text === '累積中' &&
    !early.quality.text.includes('—'),
  JSON.stringify(early.quality),
);
const settled = await liveAt({}, 40);
check(
  '窗口夠長之後中央就是真的分數（不再是累積中）',
  settled.quality.pending === 'no' && /^\d+$/.test(settled.quality.text),
  JSON.stringify(settled.quality),
);

check(
  '乾淨擷取：曝光那一行說亮度穩定，而且不上警示色',
  settled.exposure.tone === 'neutral' &&
    settled.exposure.text.includes('亮度穩定') &&
    settled.exposure.text.includes('fps'),
  JSON.stringify(settled.exposure),
);
check(
  '🔴 幀還不夠時說「累積中」，不說「穩定」（null 不是穩定）',
  (await liveAt({}, 0.3)).exposure.text.includes('累積中'),
  JSON.stringify((await liveAt({}, 0.3)).exposure),
);

// 🔴 實機那個簽名：階梯式曝光擾動 → 節律崩掉，而曝光那一行講得出為什麼。
const hunting = await page.evaluate(
  ({ all }) => {
    const t0 = all[0].timestampMs;
    // 交替的階梯（auto-exposure 的形狀），疊在同一批幀上。
    const stepped = all.map((f) => {
      const sec = (f.timestampMs - t0) / 1000;
      const step = Math.floor(sec / 1.4) % 2 === 0 ? 0 : 0.35;
      return { ...f, red: f.red * (1 + step), green: f.green * (1 + step) };
    });
    window.__tenkiFingerHarness.renderLiveFrames(stepped);
    const h = window.__tenkiFingerHarness;
    return {
      exposure: h.exposureNote(),
      dims: [...document.querySelectorAll('#liveDims .dim')].map((row) => ({
        key: row.dataset.key,
        value: row.querySelector('.dimValue').textContent.trim(),
      })),
    };
  },
  { all: synthesizePpg({ durationSec: 45 }).frames },
);
const huntingRhythm = hunting.dims.find((d) => d.key === 'rhythmicCoherence');
check(
  '🔴 相機在自己調亮度時：節律掉下來，而曝光那一行說得出為什麼',
  hunting.exposure.tone === 'bad' &&
    hunting.exposure.text.includes('重新調亮度') &&
    hunting.exposure.text.includes('門檻'),
  JSON.stringify({ exposure: hunting.exposure, rhythm: huntingRhythm }),
);
// 🔴 畫面不得同時說「脈搏清楚」與「找不到穩定的脈搏節律」。實機第二次就是
// 這一對，而強的其實是曝光干擾不是脈搏 —— strong_pulse 量的是帶內 AC/DC。
const huntingReasons = await page.evaluate(() =>
  [...document.querySelectorAll('#liveReasons .reason')].map((n) => n.textContent),
);
check(
  '🔴 說「找不到節律」的同時，不得有另一行宣稱脈搏清楚',
  !huntingReasons.some((r) => r.includes('找不到穩定的脈搏節律')) ||
    !huntingReasons.some((r) => r.includes('脈搏') && r.includes('清楚')),
  JSON.stringify(huntingReasons),
);

// ⚠️ 這一條第一版是我自己寫壞的：右邊拿一個由無意義三元式算出來的常數 100
// 去比，等於「節律 < 100」——永遠成立。要比的是**同樣長度的乾淨擷取**。
const cleanRhythm = (await liveAt({}, 45)).dims.find((d) => d.key === 'rhythmicCoherence');
check(
  '而且那正是實機看到的組合 —— 節律讀得比同樣長度的乾淨擷取差',
  Number.parseInt(huntingRhythm.value, 10) < Number.parseInt(cleanRhythm.value, 10),
  JSON.stringify({ hunting: huntingRhythm, clean: cleanRhythm }),
);

// ── 3. 訊號不足：必須拒答，而且不准上 gold ─────────────────────────────────
console.log('\n── 訊號不足（低灌流）──');
const weak = await runScan(PPG_FIXTURES.lowPerfusion);
check('沒有脈搏讀數', weak.hr === '—', `hr=${weak.hr}`);
check(
  '說明了為什麼沒報',
  weak.withheld.length > 0 && weak.withheldHeadShown && weak.withheldHead.includes('沒有報'),
  `head=${weak.withheldHead} 顯示中=${weak.withheldHeadShown} withheld=${JSON.stringify(weak.withheld)}`,
);
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
  '沒有脈搏時也不會冒出一個脈搏間期變化',
  !weak.prvShown && weak.prv === '—',
  `顯示=${weak.prvShown} prv=${weak.prv}`,
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

// ── 2d. 實機驗收儀表 ───────────────────────────────────────────────────────
// 🔴 §12 有三條檢查要真手指才答得出來。頁面把每次擷取記下來（只記推導值），
// 這幾條驗的是那個紀錄本身可不可信。
console.log('\n── 實機驗收儀表 ──');
await page.evaluate(() => window.__tenkiFingerHarness.resetValidationLog());

const firstLogged = await runScan({});
check(
  '驗收報告在證據層，不在頭條',
  firstLogged.reportInEvidenceLayer,
  `在證據層=${firstLogged.reportInEvidenceLayer}`,
);
check(
  '一次擷取就開始累積，而且報出三條檢查',
  firstLogged.report.includes('#15') &&
    firstLogged.report.includes('#6') &&
    firstLogged.report.includes('#14'),
  `report=${firstLogged.report.slice(0, 80)}`,
);
check(
  '🔴 報告裡沒有時間戳，只有統計',
  !/\d{13}/.test(firstLogged.report) && !/\d{4}-\d{2}-\d{2}/.test(firstLogged.report),
  `report=${firstLogged.report}`,
);
check(
  '🔴 報告說得出脈搏讀自哪個通道，以及另一個通道長什麼樣',
  /紅 節律 [\d.]+／亮度 [\d.]+/.test(firstLogged.channelNote) &&
    /綠 節律 [\d.]+／亮度 [\d.]+/.test(firstLogged.channelNote),
  `channelNote=${firstLogged.channelNote}`,
);
check(
  '驗收報告有通道那一段，而且排在編號檢查之前',
  firstLogged.report.includes('通道') &&
    firstLogged.report.indexOf('通道') < firstLogged.report.indexOf('#15'),
  `report=${firstLogged.report.slice(0, 120)}`,
);
check(
  '預設情境是靜坐，而且只有一個被選起來',
  firstLogged.scenarioPressed.length === 1 && firstLogged.scenarioPressed[0] === 'resting',
  `pressed=${JSON.stringify(firstLogged.scenarioPressed)}`,
);

// 🔴 最重要的一條：被拒答的擷取**也要進紀錄**。第 6 條問的是「lock 出現但最終
// 沒有讀數」，而那種擷取根本不會產生 anchor —— 只看 anchor 的話這條永遠是空的。
await page.evaluate(() => {
  window.__tenkiFingerHarness.resetValidationLog();
  window.__tenkiFingerHarness.setScenario('walking');
  window.__tenkiFingerHarness.setLockAchieved(true);
});
const refusedWithLock = await runScan(PPG_FIXTURES.lowPerfusion);
check(
  '🔴 拒答的擷取也進紀錄，而且「lock 出現但沒有讀數」會被判定不過',
  refusedWithLock.report.includes('這條不過'),
  `report=${refusedWithLock.report}`,
);
check(
  '而且邊走的那次有被算成邊走',
  /邊走 1 次/.test(refusedWithLock.report),
  `report=${refusedWithLock.report}`,
);

// ⚠️ 上面那個 fixture 走的是「analysed 但沒讀數」那條路。**連分析都跑不動**
// 的擷取是另一條 return，而第一版的斷言完全沒碰到它 —— 把那行記錄拿掉，
// 上面兩條照樣綠。這一條專門走那條路。
const tooFew = await page.evaluate(() => {
  window.__tenkiFingerHarness.resetValidationLog();
  window.__tenkiFingerHarness.renderFrames([]);
  return document.getElementById('validationReport').textContent;
});
check(
  '🔴 連分析都跑不動的擷取也要進紀錄',
  /1 次擷取/.test(tooFew),
  `report=${tooFew}`,
);

await page.evaluate(() => {
  window.__tenkiFingerHarness.resetValidationLog();
  window.__tenkiFingerHarness.setScenario('resting');
  window.__tenkiFingerHarness.setLockAchieved(false);
});

// ── 3b. 一次校準不是基線（brief §5）────────────────────────────────────────
// 🔴 這一段守的是**用詞**：同一天做幾次都還只是「第一個脈搏參考」，而「基線」
// 這個詞只有最後一階能用。
console.log('\n── 基線階段 ──');
await page.evaluate(() => window.__tenkiFingerHarness.resetAnchors());

const anchor1 = await runScan({});
check(
  '第一次是「第一個脈搏參考」，不是基線',
  anchor1.stageName === '第一個脈搏參考' && anchor1.stageTerm === 'FIRST PULSE REFERENCE',
  `term=${anchor1.stageTerm} name=${anchor1.stageName}`,
);
check(
  '🔴 這一階的說明裡不准出現「基線」',
  !anchor1.stageName.includes('基線') && !anchor1.stageNote.includes('基線'),
  `note=${anchor1.stageNote}`,
);
check(
  '說得出還缺什麼',
  /再 \d+ 次|再跨 \d+ 天/.test(anchor1.stageNote),
  `note=${anchor1.stageNote}`,
);
check('第一次不給靜息區間', !anchor1.bandShown, `band=${anchor1.band}`);

await runScan({ seed: 51 });
await runScan({ seed: 52 });
const sameDay = await runScan({ seed: 53 });
check(
  '🔴 同一天做四次還是「第一個脈搏參考」—— 天數是硬條件',
  sameDay.stageName === '第一個脈搏參考',
  `name=${sameDay.stageName} note=${sameDay.stageNote}`,
);
check(
  '而且說明裡講的是「再跨幾天」，不是「再幾次」',
  sameDay.stageNote.includes('再跨') && !/再 \d+ 次/.test(sameDay.stageNote),
  `note=${sameDay.stageNote}`,
);

const rejected = await runScan(PPG_FIXTURES.lowPerfusion);
check(
  '沒立住的那一次不計入，而且畫面說了',
  rejected.stageNote.includes('沒有立住') && rejected.stageNote.includes('4 次'),
  `note=${rejected.stageNote}`,
);

// 跨天要到最後一階才准說「基線」。頁面只能用今天的日期，所以這裡直接餵
// 不同日期的 anchor 進 localStorage（頁面照常從引擎算階段）。
await page.evaluate(() => {
  const anchors = [];
  for (let i = 0; i < 20; i++) {
    anchors.push({
      restingPulseBpm: 62 + (i % 7),
      capturedAtMs: 0,
      localDateKey: `2026-09-${String(1 + (i % 6)).padStart(2, '0')}`,
      source: 'camera_fingertip_ppg',
      derivation: 'estimated',
      quality: { accepted: true, rejectionReasons: [] },
      context: { timeOfDay: 'morning', posture: 'unknown', afterExertion: null },
    });
  }
  localStorage.setItem('tenki.preview.pulseAnchors', JSON.stringify(anchors));
});
const mature = await runScan({ seed: 61 });
check(
  '夠多次、跨夠多天之後才叫「情境脈搏基線」',
  mature.stageName === '情境脈搏基線' && mature.stageTerm === 'CONTEXTUAL PULSE BASELINE',
  `term=${mature.stageTerm} name=${mature.stageName}`,
);
check(
  '到那時才給靜息區間，而且是四分位不是最小到最大',
  mature.bandShown && /^\d+(\.\d+)?–\d+(\.\d+)? bpm$/.test(mature.band),
  `顯示=${mature.bandShown} band=${mature.band}`,
);

// 🔴 個人比較只在累積夠多**可比較的高品質**錨點之後才給。
await page.evaluate(() => {
  const hour = new Date().getHours();
  const bucket = hour < 11 ? 'morning' : hour < 16 ? 'midday' : hour < 22 ? 'evening' : 'night';
  const anchors = [];
  for (let i = 0; i < 12; i++) {
    anchors.push({
      restingPulseBpm: 62 + (i % 5),
      prvRmssdMs: 38 + (i % 5) * 2,
      beatTemplateCorrelation: 0.98,
      capturedAtMs: 0,
      localDateKey: `2026-09-${String(1 + (i % 5)).padStart(2, '0')}`,
      source: 'camera_fingertip_ppg',
      derivation: 'estimated',
      quality: { accepted: true, rejectionReasons: [] },
      // ⚠️ 必須跟頁面**當下**會產生的 context 一樣，否則它們不可比較 ——
      // 而那正是這條規則要的行為（第一版把 timeOfDay 寫死 'morning'，在下午
      // 跑就只剩 1/7，斷言紅得完全正確）。
      context: { timeOfDay: bucket, posture: 'unknown', afterExertion: null },
    });
  }
  localStorage.setItem('tenki.preview.pulseAnchors', JSON.stringify(anchors));
});
const compared = await runScan({ seed: 71 });
check(
  '夠多可比較的高品質紀錄之後才跟使用者自己比',
  compared.prvCompare.includes('可比較的高品質校準') &&
    /(比你平常低|在你平常的範圍內|比你平常高)/.test(compared.prvCompare),
  `prvCompare=${compared.prvCompare}`,
);
check(
  '🔴 比較的說法也不得沾上壓力／恢復／準備度／自律神經',
  !/(壓力|恢復|準備度|交感|副交感|迷走)/.test(compared.prvCompare),
  `prvCompare=${compared.prvCompare}`,
);

check(
  '最長的階段名稱在 390px 也不爆版',
  mature.overflowX === 0,
  `多出 ${mature.overflowX}px（term=${mature.stageTerm} name=${mature.stageName}）`,
);
check(
  '講得出這個讀數是怎麼量的（§8）',
  mature.howText.includes('帶通') && mature.howText.includes('不是心電圖'),
  `how=${mature.howText.slice(0, 60)}`,
);

await page.evaluate(() => window.__tenkiFingerHarness.resetAnchors());

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
const shotEvidence = process.env.FINGER_SHOT_EVIDENCE;
if (shotEvidence) {
  await runScan({});
  await page.evaluate(() => {
    document.getElementById('how').open = true;
  });
  await page.screenshot({ path: shotEvidence, fullPage: true });
  console.log(`  📸 ${shotEvidence}`);
}
const shotScan = process.env.FINGER_SHOT_SCAN;
if (shotScan) {
  const { frames } = synthesizePpg({ durationSec: 90 });
  await page.evaluate((all) => {
    const t0 = all[0].timestampMs;
    for (let end = 2; end <= 40; end += 2) {
      window.__tenkiFingerHarness.renderLiveFrames(
        all.filter((f) => f.timestampMs <= t0 + end * 1000),
      );
    }
  }, frames);
  await page.screenshot({ path: shotScan, fullPage: true });
  console.log(`  📸 ${shotScan}`);
}
const shotReady = process.env.FINGER_SHOT_READY;
if (shotReady) {
  await replayGate({}, 1);
  await page.screenshot({ path: shotReady, fullPage: true });
  console.log(`  📸 ${shotReady}`);
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

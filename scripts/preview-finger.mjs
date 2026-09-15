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

// ── 2b2. Pulse Lens：一個場、一個狀態、一句指令 ──────────────────────────
// 🔴 founder 2026-09-15 定案：亮 cyan = 可信的透光；暗 navy/indigo = 沒有可用
// 的場；amber **只**保留給需要調整的那幾格。同一個亮度不得同時代表「訊號好」
// 與「沒蓋到」—— 所以缺口靠暗格 ＋ 封環破口表示，完全不用 amber。
console.log('\n── Pulse Lens ──');

const holdWindows = await page.evaluate(() =>
  window.__tenkiFingerHarness.readinessHoldWindows(),
);
const grid = await page.evaluate(() => window.__tenkiFingerHarness.coverageGrid());
const sampleSize = await page.evaluate(() => window.__tenkiFingerHarness.sampleSize());
const cellPx = sampleSize / grid;

/** 讀出畫面上 Pulse Lens 的全部可觀察狀態。 */
const readLens = () =>
  page.evaluate(() => {
    const cells = [...document.querySelectorAll('#lensGrid .lensCell')];
    const paint = (el) => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(el).backgroundColor);
      return m === null ? {} : { r: +m[1], g: +m[2], b: +m[3] };
    };
    return {
      cellCount: cells.length,
      transmission: cells.map((c) => Number(getComputedStyle(c).getPropertyValue('--t'))),
      adjust: cells.map((c) => c.dataset.adjust),
      paint: cells.map(paint),
      geometry: cells.map((c) => {
        const r = c.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }),
      seals: [...document.querySelectorAll('.sealArc')].map((a) => a.dataset.sealed),
      state: document.getElementById('lensState').textContent.trim(),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyText: document.body.innerText,
    };
  });

/** 餵一塊已知圖樣的像素進真的取樣器，再讀畫面。 */
const cover = async (bare, saturated = false) => {
  await page.evaluate(
    ({ b, sat }) =>
      sat
        ? window.__tenkiFingerHarness.renderSaturatedCells(b)
        : window.__tenkiFingerHarness.renderSampledCells(b),
    { b: bare, sat: saturated },
  );
  return readLens();
};

/** 餵不重疊的窗口進就位閘，回傳每一步的狀態。 */
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
        steps.push({
          gate,
          state: document.getElementById('lensState').textContent.trim(),
          dots: [...document.querySelectorAll('.holdDot')].map((n2) => n2.dataset.on),
          skipShown: !document.getElementById('skipGate').hidden,
          elapsed: document.getElementById('elapsed').textContent.trim(),
          scanVisible: document.querySelector('.only-scan').getBoundingClientRect().height > 0,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        });
      }
      return steps;
    },
    { all: frames, windows },
  );
}

await page.evaluate(() => window.__tenkiFingerHarness.resetGate());
const full = await cover(null);
check(
  `光場真的畫出來了（${grid}×${grid} 格，每格都有幾何）`,
  full.cellCount === grid * grid && full.geometry.every((g) => g.w > 0 && g.h > 0),
  JSON.stringify({ n: full.cellCount, g: full.geometry.slice(0, 2) }),
);

// 半格高的留白 → 上緣那一列每格剛好透光一半。二值化會把它吃成 0 或 1。
const half = await cover({ x: 0, y: 0, w: sampleSize, h: cellPx / 2 });
check(
  '🔴 色階連續：透光一半的格子既不是 0 也不是 1',
  half.transmission.some((t) => t > 0.05 && t < 0.95),
  JSON.stringify([...new Set(half.transmission)].slice(0, 6)),
);
check(
  '🔴 全覆蓋與部分覆蓋在畫面上分得出來',
  Math.min(...full.transmission) > Math.min(...half.transmission),
  JSON.stringify({ full: Math.min(...full.transmission), half: Math.min(...half.transmission) }),
);

// 一格高度的 40% 留白 → 中段透光，驗色階的中間那一階真的存在。
const gap0 = await cover({ x: 0, y: 0, w: sampleSize, h: cellPx * 0.45 });

// 🔴 這一條是這次定案的核心：缺口不准用 amber。
const gap = await cover({ x: 0, y: 0, w: cellPx * 3, h: cellPx * 2 });
check(
  '🔴 缺口不得用 amber —— 靠暗格表示（同一個亮度不得兩種意思）',
  gap.adjust.every((a) => a === 'no'),
  JSON.stringify([...new Set(gap.adjust)]),
);
check(
  '🔴 缺口那幾格是暗的（透光趨近 0）',
  gap.transmission.filter((t) => t < 0.2).length >= 6,
  String(gap.transmission.filter((t) => t < 0.2).length),
);
check(
  '🔴 封環在有缺口的象限破口，蓋滿時四段都密封',
  gap.seals.includes('no') && full.seals.every((x) => x === 'yes'),
  JSON.stringify({ gap: gap.seals, full: full.seals }),
);

// 🔴 amber 只在真的被打到感光上限的時候出現。
const saturated = await cover(null, true);
check(
  '🔴 過曝才出現 amber，而且是逐格的',
  saturated.adjust.every((a) => a === 'yes') && full.adjust.every((a) => a === 'no'),
  JSON.stringify({ sat: [...new Set(saturated.adjust)], full: [...new Set(full.adjust)] }),
);
check(
  '🔴 而 amber 那格仍然算「有覆蓋」—— 飽和與缺覆蓋是兩件事',
  saturated.transmission.every((t) => t > 0.8),
  JSON.stringify([...new Set(saturated.transmission)].slice(0, 4)),
);

// 色階本身：藍→青的一小段弧，沒有綠/紅/紫（彩虹會打紅這條）。
const litCells = [...full.paint, ...half.paint, ...gap0.paint].filter((c) => c.r !== undefined);
check(
  '🔴 場的色階沒有綠、紅或紫（藍≥綠≥紅，整條弧都是）',
  litCells.length > 0 && litCells.every((c) => c.b >= c.g && c.g >= c.r),
  JSON.stringify(litCells.slice(0, 2)),
);
// 🔴 亮度必須單調遞增 —— sequential ramp 的定義，也是彩虹被否決的原因。
// ⚠️ 第一版只用畫面上**剛好出現**的那幾個透光值來驗，而它們全落在 0.45–0.55
// 與 1.0；把色階中段換成黃色（t 0.8–1.0 才取得到）照樣綠。要密集掃過整個
// 0..1 才擋得住。教訓同上一條：測資要能分開我要守的東西跟我怕的東西。
const rampSweep = await page.evaluate(() => {
  const out = [];
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(window.__tenkiFingerHarness.lensRampAt(t));
    out.push({ t: Math.round(t * 100) / 100, r: +m[1], g: +m[2], b: +m[3] });
  }
  return out;
});
const lumOf = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
check(
  '🔴 整條色階亮度單調遞增（密集掃 0..1，彩虹會打紅）',
  rampSweep.every((c, i) => i === 0 || lumOf(c) >= lumOf(rampSweep[i - 1]) - 0.5),
  JSON.stringify(
    rampSweep
      .map((c, i) => ({ t: c.t, l: Math.round(lumOf(c)) }))
      .filter((_, i) => i % 10 === 0),
  ),
);
check(
  '🔴 整條色階都是藍≥綠≥紅（沒有綠、黃、紅或紫竄進來）',
  rampSweep.every((c) => c.b >= c.g && c.g >= c.r),
  JSON.stringify(rampSweep.filter((c) => !(c.b >= c.g && c.g >= c.r)).slice(0, 3)),
);

// 而畫面上真的畫出來的顏色，也要跟色階一致。
const byT = [...full.paint.map((p2, i) => ({ t: full.transmission[i], ...p2 })),
             ...half.paint.map((p2, i) => ({ t: half.transmission[i], ...p2 })),
             ...gap0.paint.map((p2, i) => ({ t: gap0.transmission[i], ...p2 }))]
  .filter((c) => c.r !== undefined)
  .sort((a, b) => a.t - b.t);
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
check(
  '🔴 透光愈高畫得愈亮（亮度單調，不是彩虹）',
  byT.every((c, i) => i === 0 || lum(c) >= lum(byT[i - 1]) - 1),
  JSON.stringify(byT.filter((_, i) => i % 12 === 0).map((c) => [c.t, Math.round(lum(c))])),
);
check(
  '🔴 中間那一階是 teal，不是把 indigo 直接拉到 cyan（平掉的場看不出差異）',
  (() => {
    const mid = byT.filter((c) => c.t > 0.4 && c.t < 0.6);
    return mid.length === 0 || mid.every((c) => c.g > c.r + 40 && c.b > c.g);
  })(),
  JSON.stringify(byT.filter((c) => c.t > 0.4 && c.t < 0.6).slice(0, 2)),
);

const gateClean = await replayGate({}, holdWindows + 1);
check(
  '🔴 就位期間 90 秒的鐘沒有在走',
  gateClean.every((s2) => s2.scanVisible === false && s2.elapsed.startsWith('0s')),
  JSON.stringify(gateClean.map((s2) => s2.elapsed)),
);
check(
  'hold 的進度看得見（點亮的點數 = held）',
  gateClean.every((s2) => s2.dots.filter((d) => d === 'yes').length === s2.gate.held),
  JSON.stringify(gateClean.map((s2) => ({ h: s2.gate.held, d: s2.dots }))),
);
check(
  '每一步都有一句狀態（不會是空的）',
  gateClean.every((s2) => s2.state.length > 0),
  JSON.stringify(gateClean.map((s2) => s2.state)),
);
check(
  '手指不在鏡頭上：說得出要做什麼',
  (await replayGate({ coverage: 0.05 }, 1))[0].state.includes('輕放'),
  '',
);
check(
  '🔴 缺口時不得顯示「已確認」',
  (await replayGate({ coverage: 0.45 }, 1))[0].gate.evidence.coverageConfirmed === false,
  '',
);
check('逃生口一開始不出現', gateClean.every((s2) => s2.skipShown === false), '');
check(
  'Pulse Lens 在 390px 下不橫向溢出',
  full.overflowX <= 0 && gap.overflowX <= 0 && gateClean.every((s2) => s2.overflowX <= 0),
  JSON.stringify([full.overflowX, gap.overflowX]),
);

// ── 文案紅線 ────────────────────────────────────────────────────────────────
// 🔴 熱像的視覺文法會自己做出宣稱，除非文字擋掉。
const FORBIDDEN_COPY = [
  '熱成像', '熱像圖', '紅外線成像', '紅外線熱像', '血流影像', '血管影像',
  '偵測體溫', '測量體溫', '偵測血流', '看見微循環',
  'thermal imaging', 'infrared', 'blood flow',
];
check(
  '🔴 畫面上沒有任何熱像／紅外線／血流的宣稱',
  !FORBIDDEN_COPY.some((term) => full.bodyText.toLowerCase().includes(term.toLowerCase())),
  JSON.stringify(
    FORBIDDEN_COPY.filter((t) => full.bodyText.toLowerCase().includes(t.toLowerCase())),
  ),
);
check(
  '🔴 不宣稱 100% 實體覆蓋，也不宣稱量到壓力',
  !/100\s*%\s*(覆蓋|遮蓋)/.test(full.bodyText) && !full.bodyText.includes('壓力值'),
  full.bodyText.slice(0, 100),
);
// ⚠️ 這條改過兩次，兩次都是同一個病的變種。
// 第一版驗「那段字在 .lensDetail 裡面」—— 把 <details> 換成永遠展開的 <div>
// 照樣綠，字明明就在畫面上。
// 第二版改量幾何（height === 0）—— 而收合的 <details> 用的是
// `content-visibility: hidden`：**不繪製，但仍然有 layout box**，量到 76.75px。
// 正確的儀器是 `checkVisibility()`，它就是為了回答「使用者看不看得到」而存在的。
// 教訓：「量使用者看到的東西」對，但要挑對量的工具。
const methodCopy = await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.lensCard p, .lensCard span')].find((el) =>
    el.textContent.includes('溫度'),
  );
  const detail = document.querySelector('.lensDetail');
  return {
    found: hit !== undefined,
    detailsClosed: detail instanceof HTMLDetailsElement && !detail.open,
    checkVisibility:
      hit === undefined
        ? null
        : hit.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true }),
  };
});
check(
  '🔴 主擷取畫面不解釋量測方法 —— 「不是溫度」預設看不見',
  methodCopy.found && methodCopy.detailsClosed && methodCopy.checkVisibility === false,
  JSON.stringify(methodCopy),
);
check(
  '🔴 Coverage Lock 不得畫出任何脈搏漣漪（即時拍點偵測器還不存在）',
  await page.evaluate(
    () =>
      document.querySelectorAll('.ripple, [data-ripple], .beatPulse').length === 0 &&
      !/@keyframes\s+(ripple|beat)/.test(
        [...document.styleSheets]
          .flatMap((sh) => {
            try {
              return [...sh.cssRules].map((r) => r.cssText);
            } catch (_) {
              return [];
            }
          })
          .join(' '),
      ),
  ),
  '',
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
    for (let end = 2; end <= 60; end += 2) {
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
  '🔴 進度環的分母是這次實際會跑到哪裡（預設 60 秒，不是寫死的 90）',
  /^\d+s \/ 60s$/.test(last.elapsed) && last.arcPercent > 90 && last.arcOpacity === 1,
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

// ── 2c1. Coverage Lock 在整個擷取期間都還活著 ────────────────────────────
// 🔴 founder 2026-09-15：Coverage Lock 必須在整個 60 秒都有用。手指在擷取
// 途中滑掉，畫面要當場看得出來 —— 光場只在就位階段活著是不夠的。
console.log('\n── 擷取期間的 Coverage Lock ──');

const duringScan = await page.evaluate((all) => {
  const t0 = all[0].timestampMs;
  const h = window.__tenkiFingerHarness;
  h.renderLiveFrames(all.filter((f) => f.timestampMs <= t0 + 40 * 1000));
  // ⚠️ 先清空光場再走**真的**逐幀路徑。第一版沒有清，於是讀到的是稍早
  // `cover()` 留下來的舊顏色 —— 把擷取迴圈裡的更新整段刪掉照樣綠。
  h.clearLens();
  h.feedLensFrame(null);
  const detail = document.querySelector('.only-scan.lensDetail');
  const seen = (sel) => {
    const el = document.querySelector(sel);
    return el !== null && el.checkVisibility();
  };
  return {
    lensVisible: seen('#lensGrid'),
    cellsPainted: [...document.querySelectorAll('#lensGrid .lensCell')].filter(
      (c) => getComputedStyle(c).backgroundColor !== 'rgb(6, 18, 36)',
    ).length,
    stateText: document.getElementById('lensState').textContent.trim(),
    evidenceVisible: seen('.evidenceRow'),
    // 工程數字要在收合的細節裡，不在主畫面上。
    detailClosed: detail instanceof HTMLDetailsElement && !detail.open,
    dimsHidden: !seen('#liveDims'),
    lockHidden: !seen('#lock'),
    exposureHidden: !seen('#exposureNote'),
    // 兩個 details 同時出現 = 重複。
    detailCount: [...document.querySelectorAll('.lensDetail')].filter((d) =>
      d.checkVisibility(),
    ).length,
  };
}, synthesizePpg({ durationSec: 90 }).frames);

check(
  '🔴 擷取進行中光場仍然在畫（不是只有就位階段）',
  duringScan.lensVisible && duringScan.cellsPainted > 0,
  JSON.stringify({ v: duringScan.lensVisible, n: duringScan.cellsPainted }),
);
check(
  '擷取進行中也只有一句狀態，而且不是空的',
  duringScan.stateText.length > 0 && duringScan.evidenceVisible,
  JSON.stringify(duringScan.stateText),
);
check(
  '🔴 工程數字收在收合的量測細節裡，不在主擷取畫面上',
  duringScan.detailClosed &&
    duringScan.dimsHidden &&
    duringScan.lockHidden &&
    duringScan.exposureHidden,
  JSON.stringify(duringScan),
);
check(
  '整個畫面只有一個「量測細節」（就位與掃描不會同時出現）',
  duringScan.detailCount === 1,
  String(duringScan.detailCount),
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

// ── 2d0. Anchor First, Refine Naturally ─────────────────────────────────────
// 🔴 founder 2026-09-15：使用者不該被困在 90 秒裡。30 秒拿到可用的結果，
// 留下來才會看得更清楚 —— 而且已經給出去的東西不准再拿回來。
console.log('\n── 錨點與精修 ──');

const cleanFrames = synthesizePpg({ durationSec: 90 }).frames;
const upTo = (all, sec) =>
  all.filter((f) => f.timestampMs <= all[0].timestampMs + sec * 1000);

const timelineAt = async (frames, sec, reset = true) => {
  if (reset) await page.evaluate(() => window.__tenkiFingerHarness.resetTimeline());
  return page.evaluate(
    ({ f, s: sec2 }) => window.__tenkiFingerHarness.advanceTimelineAt(f, sec2),
    { f: frames, s: sec },
  );
};

const before30 = await timelineAt(upTo(cleanFrames, 25), 25);
check(
  '🔴 30 秒以前不給錨點，訊號再好也一樣',
  before30.anchorBpm === null && before30.bannerShown === false,
  JSON.stringify(before30),
);

const at30 = await timelineAt(upTo(cleanFrames, 30), 30);
check(
  '🔴 30 秒一到就收下錨點，並且畫面上看得到',
  at30.anchorBpm !== null && at30.bannerShown && at30.bannerText.includes('脈搏錨點已建立'),
  JSON.stringify(at30),
);
check(
  '🔴 拿到錨點就能離開，而且不必等 —— 「查看今日狀態」隨時在',
  at30.viewStateShown,
  JSON.stringify(at30),
);
check(
  '30 秒之後還會繼續精修（不是拿到就停）',
  at30.keepsCapturing === true && at30.phase === 'anchor_ready',
  JSON.stringify(at30),
);

// 🔴 rule 8/9：訊號之後崩掉，錨點不受影響；較差的估計不得取代它。
const degraded = await timelineAt(
  upTo(synthesizePpg({ durationSec: 90, perfusion: 0.05, seed: 4242 }).frames, 60),
  60,
  false,
);
check(
  '🔴 訊號之後崩掉，錨點還在 —— 只標記精修沒完成',
  degraded.anchorBpm === at30.anchorBpm && degraded.bannerShown,
  JSON.stringify({ before: at30.anchorBpm, after: degraded.anchorBpm }),
);

// 🔴 rule 7：60–90 秒永遠不自動。
const at60 = await timelineAt(upTo(cleanFrames, 60), 60);
check(
  '🔴 60 秒就停 —— 不會自己跑到 90 秒',
  at60.keepsCapturing === false,
  JSON.stringify(at60),
);
check(
  '🔴 要再往下只能使用者自己按（Precision 是選配，不是預設）',
  at60.precisionShown && at60.phase === 'refined',
  JSON.stringify(at60),
);
check(
  '精修中與精修完成講的不是同一句話',
  at30.bannerText !== at60.bannerText,
  JSON.stringify([at30.bannerText, at60.bannerText]),
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
const shotCover = process.env.FINGER_SHOT_COVER;
if (shotCover) {
  // ⚠️ 先 resetGate：截圖是在所有斷言跑完之後，而那時頁面早就被推到 result
  // 階段了 —— 第一版拍到的是結果畫面，不是就位畫面。
  await page.evaluate(() => window.__tenkiFingerHarness.resetGate());
  // 一個真的缺口：左上角一塊完全沒蓋到，邊界上再留半格 —— 色階的中間值
  // 只有在這種狀態下看得到。
  await cover({ x: 0, y: 0, w: cellPx * 3, h: cellPx * 2.5 });
  await page.screenshot({ path: shotCover, fullPage: true });
  console.log(`  📸 ${shotCover}`);
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

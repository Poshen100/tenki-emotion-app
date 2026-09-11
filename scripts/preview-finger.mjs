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
      stageTerm: text('stageTerm'),
      stageName: text('stageName'),
      stageNote: text('stageNote'),
      bandShown: document.getElementById('bandRow').offsetParent !== null,
      band: text('band'),
      howText: document.getElementById('how').textContent,
      prv: text('prv'),
      prvShown: document.getElementById('prvRow').offsetParent !== null,
      prvNote: text('prvNote'),
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
  '乾淨擷取會報脈搏間期變化',
  clean.prvShown && /^\d+(\.\d+)? ms$/.test(clean.prv),
  `顯示=${clean.prvShown} prv=${clean.prv}`,
);
check(
  '而且每次都講明它不是心律變異、不能跟手錶比',
  clean.prvNote.includes('不是心律變異') && clean.prvNote.includes('拍形穩定度'),
  `prvNote=${clean.prvNote}`,
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

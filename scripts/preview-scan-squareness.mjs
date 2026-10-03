/**
 * preview-scan-squareness.mjs — 驗「正對儀器」那條回饋。
 *
 * 為什麼需要這支：founder 2026-10-01 實走掃描說「眼睛好像不用看鏡頭或螢幕，
 * 這樣感覺有點奇怪」。查下去是真的 —— headPose 每幀都在算，但它只驅動一行文字
 * 提示；而 updateAlignArc 在入框之後連那點點旋轉都丟掉。**一旦入框，臉朝哪裡
 * 對儀器完全沒差。**
 *
 * 修法是把 squareness 接到星塵的收散上。這支鎖住三件事：
 *
 *   1. squareness 的極值**真的對齊**「正對鏡頭」提示的門檻 —— 不是隨手挑的數。
 *      （同 readoutStillness 把低端錨在閘門門檻上的作法。）
 *   2. 它**真的走遍 0..1** —— CLAUDE.md 明列的那一課：訊號正規化成 0..1
 *      不代表它會走到。2026-08-10 的 browTension 只讓色相動了 0.69°。
 *   3. 🔴 **pose 進不了閘門** —— 歪到爆也不能讓掃描推不動。那兩個門檻按程式
 *      自己的註解是「先驗估計、還沒實機調過」，進閘門而抓錯就會**掃不完**。
 *      這條用斷言鎖著，不是靠註解。
 *
 * 直接餵模組開出來的純函式（`__pose`），不開相機、不走完整場掃描。
 *
 * Run: node scripts/preview-scan-squareness.mjs
 */
import { getChromium } from './lib/playwright.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  if (clean.startsWith('/preview/')) clean = '/apps/preview/' + clean.slice('/preview/'.length);
  const file = join(repoRoot, clean);
  if (!existsSync(file) || statSync(file).isDirectory() || !file.startsWith(repoRoot)) {
    res.writeHead(404).end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const chromium = await getChromium();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/apps/preview/v6/index.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForFunction(() => !!(window.TENKI_READINESS_SCAN
  && window.TENKI_READINESS_SCAN.__pose), null, { timeout: 15_000 });

const C = await page.evaluate(() => window.TENKI_READINESS_SCAN.__pose.constants);
const pitchMid = (C.PITCH_SQUARE_MIN + C.PITCH_SQUARE_MAX) / 2;
console.log(`yaw 門檻 ±${C.YAW_SQUARE_MAX} · pitch 容許帶 ${C.PITCH_SQUARE_MIN}..${C.PITCH_SQUARE_MAX}`
  + ` (中性 ${pitchMid.toFixed(3)}) · 收散權重 ${C.READOUT_SQUARE_WEIGHT}\n`);

let pass = 0;
let fail = 0;
function check(name, actual, expected, tol) {
  const ok = tol === undefined
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : Math.abs(actual - expected) <= tol;
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}` + (ok ? '' : `  ← 期望 ${expected}，實際 ${actual}`));
}

const sq = (yaw, pitch) => page.evaluate(
  ([y, p]) => window.TENKI_READINESS_SCAN.__pose.squareness({ yaw: y, pitch: p }), [yaw, pitch]);

// ── 1. 極值錨在提示門檻上 ──
check('正對（yaw 0 · pitch 中性）＝ 1', await sq(0, pitchMid), 1, 1e-9);
check('🔴 yaw 剛好到「正對鏡頭」提示門檻 ＝ 0', await sq(C.YAW_SQUARE_MAX, pitchMid), 0, 1e-9);
check('🔴 pitch 低端到提示門檻 ＝ 0', await sq(0, C.PITCH_SQUARE_MIN), 0, 1e-9);
check('🔴 pitch 高端到提示門檻 ＝ 0', await sq(0, C.PITCH_SQUARE_MAX), 0, 1e-9);
check('超出門檻不會變負（夾在 0）', await sq(C.YAW_SQUARE_MAX * 3, pitchMid), 0, 1e-9);
check('沒有 pose 時回 1（恆等，不因「沒量到」懲罰收散）',
  await page.evaluate(() => window.TENKI_READINESS_SCAN.__pose.squareness(null)), 1, 1e-9);
check('yaw 的正負對稱',
  await sq(-C.YAW_SQUARE_MAX / 2, pitchMid), await sq(C.YAW_SQUARE_MAX / 2, pitchMid), 1e-9);

// ── 2. 真的走遍 0..1（CLAUDE.md：定義域 ≠ 會走到的範圍）──
const curve = [];
for (let i = 0; i <= 20; i++) curve.push(await sq((C.YAW_SQUARE_MAX * i) / 20, pitchMid));
const span = Math.max(...curve) - Math.min(...curve);
check('🔴 轉頭時 squareness 真的走遍 0..1（跨度 ≥ 0.9）', span >= 0.9, true);
check('曲線單調不增（轉得越開越鬆）',
  curve.every((v, i) => i === 0 || v <= curve[i - 1] + 1e-9), true);

// ── 3. 🔴 pose 進不了閘門 —— 歪到爆也不能讓掃描推不動 ──
//
// ⚠️ `gatesAdvance` 讀 module-private 的 `session`，掃描沒跑時呼叫它會炸，
// 所以這兩條驗的是**原始碼**。兩條要**一起看**：
//   第一條鎖「pose 不在裡面」，第二條鎖「它仍然是真的閘門」——
//   少了第二條的話，把函式內容整個刪掉也能讓第一條變綠，那就是一條死斷言。
const gateSrc = await page.evaluate(
  () => window.TENKI_READINESS_SCAN.__pose.gatesAdvance.toString());
check('🔴 閘門裡沒有 pose/yaw/pitch/square（進不了閘門就不會卡死）',
  /pose|yaw|pitch|square/i.test(gateSrc), false);
check('🔴 閘門仍然真的在看 centering 與 stillness（上一條不是死斷言）',
  /centering/.test(gateSrc) && /stillness/.test(gateSrc), true);

// ── 4. 星塵端：預設恆等、傳了才動，而且只動收散不動色彩 ──
//
// ⚠️ 平滑（stepReadout）是由 rAF 渲染迴圈推的，而容器連不到 cdnjs → three.js
// 走 stub → 迴圈可能根本沒在跑。所以先**實測平滑有沒有前進**，沒有就誠實跳過，
// 而不是讓一組永遠不會動的數字變成「通過」。
//
// 🔴 **等它真的收斂再比，不要用固定 timeout。** PR #274 第一次 CI 紅燈就是這個：
// 第一次 setReadout 之後只等 900ms（≈54 幀 × READOUT_SMOOTH 0.08），sStill 還在
// 從 0.5 爬向 0.9（0.89557 → 0.89995），於是 sat 在兩次取樣之間自己動了 0.00285，
// 而容差寫 1e-9。那個變化**與 squareness 無關**，是上一個量還沒收斂完的殘量。
// 教訓：把「X 不驅動 Y」寫成「這兩個取樣點的 Y 相同」，中間就會夾進別的未收斂量。
const star = await page.evaluate(async () => {
  const S = window.TENKI_STARDUST;
  if (!S || typeof S.setReadout !== 'function' || typeof S.readoutState !== 'function') return null;
  // 輪詢到穩定：連續兩次讀數差 < 1e-6 才算收斂（上限 ~5s）。
  const settle = async () => {
    let prev = null;
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const st = S.readoutState();
      const now = st.stillness + st.progress + st.squareness;
      if (prev !== null && Math.abs(now - prev) < 1e-6) return true;
      prev = now;
    }
    return false; // 沒收斂（多半是 rAF 沒在跑）
  };
  S.setReadout({ stillness: 0.9, progress: 0.3, squareness: 1 });
  const settledA = await settle();
  const base = S.readoutState();
  S.setReadout({ squareness: 0 });
  const settledB = await settle();
  const crooked = S.readoutState();
  S.clearReadout();
  return {
    base, crooked, settled: settledA && settledB,
    smoothingRan: Math.abs(crooked.squareness - base.squareness) > 1e-6,
    satSrc: typeof S.effectiveSat === 'function' ? S.effectiveSat.toString() : null,
  };
});
if (!star) {
  console.log('– 星塵端跳過：TENKI_STARDUST 不可用（容器連不到 cdnjs，three.js 走 stub）');
} else if (!star.smoothingRan || !star.settled) {
  console.log('– 星塵端跳過：平滑迴圈沒在跑或沒收斂（rAF 由 three.js 渲染推，容器裡走 stub）'
    + ` — settled=${star.settled} sSquare=${star.base.squareness}`);
} else {
  check('星塵：沒傳 squareness 時 sSquare 為 1（恆等）', star.base.squareness, 1, 1e-6);
  check('🔴 星塵：轉開之後收散真的鬆掉（scale 變大）', star.crooked.scale > star.base.scale, true);
  check('🔴 星塵：轉開之後漂移真的變大（drift 變大）', star.crooked.drift > star.base.drift, true);
  // 收斂之後只動了 squareness，所以 sat 若動就真的只能是它造成的。
  check('🔴 星塵：收散變了但飽和度沒變（只動收散，不動色彩）',
    Math.abs(star.crooked.sat - star.base.sat) < 1e-9, true);
}

// ── 5. 🔴 時間免疫版：色彩那條路上根本沒有 squareness ──
//
// 上面那條要等收斂、而且在容器裡跑不到。這兩條直接問原始碼，不受取樣時機影響，
// 而且**成對寫**：少了第二條的話，把 effectiveSat 掏空也能讓第一條變綠。
const satSrc = await page.evaluate(
  () => (window.TENKI_STARDUST && typeof window.TENKI_STARDUST.effectiveSat === 'function'
    ? window.TENKI_STARDUST.effectiveSat.toString() : null));
if (satSrc === null) {
  console.log('– 色彩結構斷言跳過：TENKI_STARDUST 不可用（容器連不到 cdnjs）');
} else {
  check('🔴 色彩路徑上沒有 squareness / convergeStill（收散與色彩分家）',
    /square|convergeStill/i.test(satSrc), false);
  check('🔴 色彩路徑仍然真的在讀 sStill（上一條不是死斷言）',
    /sStill/.test(satSrc), true);
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);

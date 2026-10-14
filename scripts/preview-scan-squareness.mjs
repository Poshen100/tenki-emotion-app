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
check('🔴 閘門裡沒有 pose/yaw/pitch/square/gaze（進不了閘門就不會卡死）',
  /pose|yaw|pitch|square|gaze|iris/i.test(gateSrc), false);
check('🔴 閘門仍然真的在看 centering 與 stillness（上一條不是死斷言）',
  /centering/.test(gateSrc) && /stillness/.test(gateSrc), true);

// ── 3b. 眼睛：虹膜在眼眶裡的位移（founder 2026-10-14「臉跟眼睛都要正對螢幕」）──
//
// 合成 landmark 直接餵純函式，不開相機。眼睛的幾何刻意做成不對稱
// （左右眼的 span 不同、兩眼不在同一條水平線上），這樣「兩眼取平均」與
// 「各自以自己的 span 正規化」這兩件事才驗得到 —— 做成對稱的話，
// 把其中一隻眼整個忽略掉也能讓斷言變綠。
const G = await page.evaluate(() => window.TENKI_READINESS_SCAN.__gaze.constants);

/**
 * 造一組 478 點 landmark：兩隻眼的虹膜各自偏離眼眶中心 (gx, gy)（已正規化）。
 * `irisSpread` 把 5 個虹膜點散開但**維持形心** —— 用來驗程式取的是形心，
 * 不是賭 468/473 一定是中心點。
 */
function makeEyeLm(gx, gy, opts) {
  const o = opts || {};
  const lm = [];
  for (let i = 0; i < 478; i++) lm.push({ x: 0.5, y: 0.5, z: 0 });
  const eyes = [
    // 左：span 0.06、y 0.45 ／ 右：span 0.08、y 0.47 —— 刻意不一樣
    { iris: G.IRIS_L, outer: G.EYE_OUTER_L, inner: G.EYE_INNER_L, ox: 0.40, ix: 0.46, y: 0.45 },
    { iris: G.IRIS_R, outer: G.EYE_OUTER_R, inner: G.EYE_INNER_R, ox: 0.62, ix: 0.54, y: 0.47 },
  ];
  for (const e of eyes) {
    lm[e.outer] = { x: e.ox, y: e.y, z: 0 };
    lm[e.inner] = { x: e.ix, y: e.y, z: 0 };
    const span = Math.abs(e.ox - e.ix);
    const cx = (e.ox + e.ix) / 2 + gx * span;
    const cy = e.y + gy * span;
    // 散開但形心不變：四個點 ±d 對稱，第五個點放在形心上。
    const d = (o.irisSpread || 0) * span;
    const ring = [[-d, 0], [d, 0], [0, -d], [0, d], [0, 0]];
    e.iris.forEach((idx, k) => {
      lm[idx] = { x: cx + ring[k][0], y: cy + ring[k][1], z: 0 };
    });
  }
  if (o.dropIris) for (const e of eyes) for (const idx of e.iris) lm[idx] = undefined;
  if (o.dropRightEye) { const e = eyes[1]; for (const idx of e.iris) lm[idx] = undefined; }
  if (o.truncate468) lm.length = 468;
  return lm;
}

const gz = (gx, gy, opts) => page.evaluate(
  ([l]) => window.TENKI_READINESS_SCAN.__gaze.squareness(
    window.TENKI_READINESS_SCAN.__gaze.measure(l)), [makeEyeLm(gx, gy, opts)]);
const raw = (gx, gy, opts) => page.evaluate(
  ([l]) => window.TENKI_READINESS_SCAN.__gaze.measure(l), [makeEyeLm(gx, gy, opts)]);

// 🔴 門檻本身要被守住 —— 上面每一條都是**相對**門檻寫的（餵 GAZE_X_MAX 進去
// 期望得到 0），所以把門檻改成任何值它們都照樣綠。實測過：改成 0.40 時
// 29 條一條都沒紅。那正是「自洽但沒有外部真值」的死角。
//
// 外部真值就是註解裡那條推導：眼球半徑約 12mm / 兩眥距離約 30mm
// → 正規化位移 ≈ 0.4·sin(θ)。把門檻換算回**角度**來驗，兩側都卡住：
//   下限 10°：使用者盯著儀器時視線本來就偏約 3.7°（≈0.026）。門檻掉到
//            那附近就變成一個**一直亮的提示** —— 比沒有提示更糟。
//   上限 30°：再寬就等於這條提示永遠不會亮，形同沒做。
// 要調靈敏度請調角度，然後把常數改成對應的值 —— 不要直接動數字。
const IRIS_RATIO = 0.4; // 眼球半徑 / 兩眥距離
const degOf = (v) => (Math.asin(Math.min(1, v / IRIS_RATIO)) * 180) / Math.PI;
const degX = degOf(G.GAZE_X_MAX);
const degY = degOf(G.GAZE_Y_MAX);
console.log(`視線門檻換算：水平 ${G.GAZE_X_MAX} = ${degX.toFixed(1)}°`
  + ` · 垂直 ${G.GAZE_Y_MAX} = ${degY.toFixed(1)}°`);
check(`🔴 水平門檻換算成角度 ${degX.toFixed(1)}° 落在 10°–30°（不會一直亮、也不會永不亮）`,
  degX >= 10 && degX <= 30, true);
check(`🔴 垂直門檻 ${degY.toFixed(1)}° 比水平寬（虹膜垂直基線未知，寬容差是刻意的）`,
  G.GAZE_Y_MAX > G.GAZE_X_MAX, true);
check(`垂直門檻 ${degY.toFixed(1)}° 仍在 45° 以內（寬不等於沒有門檻）`,
  degY <= 45, true);

// 極值錨在「看向鏡頭」提示門檻上（同 headSquareness 錨在「正對鏡頭」上）
check('虹膜在眼眶中央 ＝ 1', await gz(0, 0), 1, 1e-9);
check('🔴 水平剛好到「看向鏡頭」提示門檻 ＝ 0', await gz(G.GAZE_X_MAX, 0), 0, 1e-9);
check('🔴 垂直剛好到提示門檻 ＝ 0', await gz(0, G.GAZE_Y_MAX), 0, 1e-9);
check('超出門檻不會變負（夾在 0）', await gz(G.GAZE_X_MAX * 3, 0), 0, 1e-9);
check('水平的正負對稱',
  await gz(-G.GAZE_X_MAX / 2, 0), await gz(G.GAZE_X_MAX / 2, 0), 1e-9);

// 🔴 量不到就是量不到 —— 不得回 0（CLAUDE.md：缺就是缺，不要填合理的預設值）
check('🔴 沒有虹膜點時 measure 回 null（不造假成「置中」）',
  await raw(0, 0, { dropIris: true }), null);
check('🔴 refineLandmarks 關著（只有 468 點）時也回 null',
  await raw(0, 0, { truncate468: true }), null);
check('沒有 gaze 時 squareness 回 1（恆等，不因「沒量到」懲罰收散）',
  await page.evaluate(() => window.TENKI_READINESS_SCAN.__gaze.squareness(null)), 1, 1e-9);
check('🔴 上面那三條不是死斷言：有虹膜點時 measure 真的回得出數字',
  typeof (await raw(G.GAZE_X_MAX, 0))?.x === 'number', true);

// 單眼可用（側臉時遠側眼會掉點）—— 剩一隻仍然比沒有有用
const oneEye = await raw(G.GAZE_X_MAX, 0, { dropRightEye: true });
check('只剩一隻眼仍然量得到（不是 null）', oneEye !== null, true);

// 🔴 取的是 5 點的**形心**，不是賭 468/473 是中心點
check('🔴 虹膜點散開但形心不變時，量到的值不變（取形心不是取單點）',
  await gz(G.GAZE_X_MAX / 2, 0, { irisSpread: 0.35 }),
  await gz(G.GAZE_X_MAX / 2, 0), 1e-9);

// 真的走遍 0..1（CLAUDE.md：定義域 ≠ 會走到的範圍）
const gcurve = [];
for (let i = 0; i <= 20; i++) gcurve.push(await gz((G.GAZE_X_MAX * i) / 20, 0));
check('🔴 眼睛飄開時 squareness 真的走遍 0..1（跨度 ≥ 0.9）',
  Math.max(...gcurve) - Math.min(...gcurve) >= 0.9, true);
check('曲線單調不增（飄得越開越鬆）',
  gcurve.every((v, i) => i === 0 || v <= gcurve[i - 1] + 1e-9), true);

// ── 3c. 🔴 連言：臉**跟**眼睛都要正對 ──
//
// 這一組直接驗 founder 那句話。缺它的話，上面每一條都綠著，而
// 「兩個都要成立」這個需求可以完全沒接上（例如 facing 只回 headSquareness）。
const facing = (pose, gaze) => page.evaluate(
  ([p, g]) => window.TENKI_READINESS_SCAN.__gaze.facing(p, g), [pose, gaze]);
const squarePose = { yaw: 0, pitch: pitchMid };
const crookedPose = { yaw: C.YAW_SQUARE_MAX, pitch: pitchMid };
const centredGaze = { x: 0, y: 0 };
const driftGaze = { x: G.GAZE_X_MAX, y: 0 };

check('臉正 + 眼睛正 ＝ 1', await facing(squarePose, centredGaze), 1, 1e-9);
check('🔴 臉正但眼睛飄 → 掉到 0（頭擺得再正也救不回來）',
  await facing(squarePose, driftGaze), 0, 1e-9);
check('🔴 眼睛正但臉歪 → 掉到 0（眼睛看著也救不回來）',
  await facing(crookedPose, centredGaze), 0, 1e-9);
check('取 min 不是取平均（任一邊歪掉就等於那一邊的分數）',
  await facing(squarePose, { x: G.GAZE_X_MAX / 2, y: 0 }), 0.5, 1e-9);
check('兩邊都沒資料時回 1（恆等）', await facing(null, null), 1, 1e-9);

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
  // ⚠️ **這裡刻意沒有「sat 完全沒變」那一條** —— 它在原理上就過不了，不是調一下
  // 就好。`sat = 1.20 + 0.35 × sStill`，而 sStill 是指數逼近、只會**漸近**收斂：
  // settle 判定允許 1e-6 的殘量 → Δsat 可達 3.5e-7，而嚴格比較要 < 1e-9，
  // **比較容差比 settle 容差嚴格 350 倍**。要把殘量壓到 1e-12 得跑 ≈332 幀（5.5s），
  // 超過輪詢上限，而且仍然只是追一條漸近線。
  //
  // 「squareness 不碰色彩」這個不變量由下面那組**結構斷言**精確守住（而且時間免疫）。
  // 在一條精確斷言旁邊再擺一條更弱、又會偶紅的行為斷言，是淨損失 ——
  // PLAYBOOK：偶紅的斷言比紅的更貴，它會訓練你忽略紅燈。
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

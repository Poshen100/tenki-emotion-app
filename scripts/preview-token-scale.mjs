/**
 * preview-token-scale.mjs — 色階系統的守門。
 *
 * 2026-09-06 founder：「再多增加一些色階」。加階本身是對的（每個語義色只有
 * 一個值，任何新需求都只能去發明新色相），但**加階自己會咬人** —— 階越多，
 * 跨家族撞色的機會越多。六個家族各生五階去量，最近的十組全部 ΔE < 13。
 *
 * 這支守的就是那幾條讓階梯不反過來害人的規則。三條都是**機器守得住、
 * 自律守不住**的：
 *
 *   1. `--amber-*` 不得有比 `-400` 更亮的階（#FFC86D 與 --gold-secured
 *      #FFD46E 只差 ΔE 7.4 —— 往亮處走就撞 SECURED）。
 *   2. 任兩個 `-400` 在三種色盲下 ΔE ≥ 20。**只驗 -400**，因為
 *      「階是給表面處理用的，只有 -400 承載語義」——暗端本來就會塌
 *      （amber-800 × error-600 綠色盲 ΔE 1.5），那不是缺陷。
 *      但只要有人拿 -800 去表達一個意思，系統當場就壞，所以這條同時
 *      是在守那個規則本身。
 *   3. `--cyan-500` 必須解析成與 `--zone-clear` **相同的值** ——
 *      它們是同一條色階的同一階，用 var() 指過去而不是複製 hex。
 *      複製就會漂移，這個 repo 已為此付過學費（VISUAL-DIRECTION §2 破口 1
 *      「五種 cyan」）。
 *
 * ⚠️ 為什麼要用瀏覽器而不是 regex 解析 CSS：`--cyan-400: var(--cyan-active)`
 * 要**解析後**才知道它真的等於什麼。regex 只看得到原始字串，var() 鏈斷掉
 * 它抓不到。getComputedStyle 是唯一誠實的問法。
 *
 * Run:  node scripts/preview-token-scale.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
import { getChromium } from './lib/playwright.mjs';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const chromium = await getChromium();
const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const server = http.createServer((req, res) => {
  if (req.url === '/probe') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><link rel="stylesheet" href="/preview/tokens.css"><body>');
    return;
  }
  const clean = req.url.startsWith('/preview/') ? '/apps' + req.url : req.url;
  const file = join(repoRoot, clean.split('?')[0]);
  if (!existsSync(file) || !file.startsWith(repoRoot)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': extname(file) === '.css' ? 'text/css' : 'text/plain' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    got:  ${got}\n    want: ${want}`}`);
}
function checkTruthy(name, v) {
  v ? pass++ : fail++;
  console.log(`${v ? '✓' : '✗'} ${name}${v ? '' : `\n    got: ${v}`}`);
}

// ── 色彩數學（與 docs/VISUAL-DIRECTION.md §3.5 的量測同一套）──
const hex2rgb = (h) => [1, 3, 5].map((_, k) => parseInt(h.slice(1 + k * 2, 3 + k * 2), 16));
const lin = (c) => ((c /= 255), c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const enc = (c) => {
  c = Math.max(0, Math.min(1, c));
  c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
};
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
function rgb2lab(rgb) {
  const [r, g, b] = rgb.map(lin);
  const X = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const de = (a, b) => {
  const A = rgb2lab(hex2rgb(a)), B = rgb2lab(hex2rgb(b));
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};
const lightness = (h) => rgb2lab(hex2rgb(h))[0];
/** Brettel/Viénot LMS 近似 —— 與 VISUAL-DIRECTION §3.5 的量測同一套。 */
function cvd(h, kind) {
  const [r, g, b] = hex2rgb(h).map(lin);
  let L = 0.31399 * r + 0.63951 * g + 0.04649 * b;
  let M = 0.15537 * r + 0.75789 * g + 0.0867 * b;
  let S = 0.01775 * r + 0.10945 * g + 0.87262 * b;
  if (kind === 'deuter') M = 0.494207 * L + 1.24827 * S;
  else if (kind === 'prot') L = 2.02344 * M - 2.52581 * S;
  else if (kind === 'trit') S = -0.395913 * L + 0.801109 * M;
  return toHex(
    enc(5.47221 * L - 4.6419 * M + 0.16963 * S),
    enc(-1.12524 * L + 2.29317 * M - 0.1678 * S),
    enc(0.0298 * L - 0.19318 * M + 1.16364 * S),
  );
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/probe`, { waitUntil: 'domcontentloaded' });
// 🔴 `domcontentloaded` 在**樣式表載入之前**就觸發 —— 那時讀 computed style
// 每個 token 都是空字串，看起來像「token 全壞了」而不是「我讀太早了」。
// （寫這支時實際踩到：36 個 token 全空。）
// PLAYBOOK：**輪詢到已知的終值特徵**，不要等某個事件、也不要等某個東西還不存在。
await page.waitForFunction(
  () => getComputedStyle(document.documentElement).getPropertyValue('--n-500').trim() !== '',
  null, { timeout: 8000 },
);

/** 讀 :root 上解析後的 token 值（var() 鏈會被解開，這正是重點）。 */
const TOKENS = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const names = [
    '--amber-400', '--amber-600', '--amber-800', '--amber-950',
    '--cyan-200', '--cyan-400', '--cyan-500', '--cyan-800', '--cyan-950',
    '--cyan-core', '--cyan-active', '--zone-clear', '--zone-neutral', '--zone-strain',
    '--gold-secured', '--success', '--error',
    '--clear-950', '--clear-800', '--neutral-950', '--neutral-800', '--strain-950', '--strain-800',
    '--n-950', '--n-900', '--n-850', '--n-800', '--n-700', '--n-600',
    '--n-550', '--n-500', '--n-450', '--n-400', '--n-300', '--n-200', '--n-100',
  ];
  const out = {};
  for (const n of names) out[n] = cs.getPropertyValue(n).trim().toUpperCase();
  return out;
});

console.log('\n── ① 每個 token 都解析得出來（var() 鏈沒斷）──');
const missing = Object.entries(TOKENS).filter(([, v]) => !/^#[0-9A-F]{6}$/.test(v)).map(([k]) => k);
check('🔴 全部解析成 6 位 hex（var() 指到不存在的 token 會是空字串）', missing, []);
if (missing.length) { await browser.close(); server.close(); process.exit(1); }

console.log('\n── ② cyan 家族與 brand spine 是同一條，不是複製 ──');
check('--cyan-400 解析 = --cyan-active', TOKENS['--cyan-400'], TOKENS['--cyan-active']);
check('🔴 --cyan-500 解析 = --zone-clear（同一階，不得各寫一份 hex）',
  TOKENS['--cyan-500'], TOKENS['--zone-clear']);
check('--cyan-500 解析 = --cyan-core', TOKENS['--cyan-500'], TOKENS['--cyan-core']);
// 🔴 這條擋的是「複製 hex 也會通過上面那條」—— 值相同不代表沒有兩份來源。
const srcCss = await (await fetch(`${base}/preview/tokens.css`)).text();
checkTruthy('🔴 --cyan-400/500 是用 var() 指過去，不是複製 hex',
  /--cyan-400:\s*var\(--cyan-active\)/.test(srcCss) && /--cyan-500:\s*var\(--cyan-core\)/.test(srcCss));

console.log('\n── ③ 琥珀不得有比 base 更亮的階（往亮處走就撞 SECURED）──');
const amberSteps = ['--amber-400', '--amber-600', '--amber-800', '--amber-950'];
const baseL = lightness(TOKENS['--amber-400']);
const lighter = amberSteps.filter((k) => k !== '--amber-400' && lightness(TOKENS[k]) > baseL);
check(`🔴 沒有階比 --amber-400 亮（base L* ${baseL.toFixed(0)}）`, lighter, []);
// 實測佐證：#FFC86D（若有人加 amber-200）與 gold ΔE 7.4，肉眼同一色。
const hypothetical = '#FFC86D';
checkTruthy(`（佐證）假想的 amber-200 ${hypothetical} 與 gold ΔE ${de(hypothetical, TOKENS['--gold-secured']).toFixed(1)} < 10`,
  de(hypothetical, TOKENS['--gold-secured']) < 10);

console.log('\n── ④ 語義色（只有 -400 那一層）在三種色盲下要分得開 ──');
// 🔴 **只驗 -400**：階是給表面處理用的，只有 -400 承載語義。
// 暗端本來就會塌（amber-800 × error-600 綠色盲 ΔE 1.5），那不是缺陷 ——
// 但這條同時是在守「不得拿 -800 去表達意思」那個規則。
const SEMANTIC = {
  amber: TOKENS['--amber-400'],
  cyan: TOKENS['--cyan-active'],
  clear: TOKENS['--zone-clear'],
  neutral: TOKENS['--zone-neutral'],
  strain: TOKENS['--zone-strain'],
  gold: TOKENS['--gold-secured'],
};
// ⚠️ cyan × clear 是**同一條色階的兩階**，本來就近（ΔE 12.8）—— 它們不是
// 兩個語義，是「live」與「resting」的深淺差，所以這一對排除在外。
const EXEMPT = new Set(['cyan|clear']);
const names = Object.keys(SEMANTIC);
for (const [kind, label] of [['deuter', '綠色盲'], ['prot', '紅色盲'], ['trit', '藍黃盲']]) {
  let worst = { d: Infinity, a: '', b: '' };
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (EXEMPT.has(`${names[i]}|${names[j]}`)) continue;
      const d = de(cvd(SEMANTIC[names[i]], kind), cvd(SEMANTIC[names[j]], kind));
      if (d < worst.d) worst = { d, a: names[i], b: names[j] };
    }
  }
  checkTruthy(`${label}：最接近的一對仍 ≥ 20（${worst.a} × ${worst.b} = ΔE ${worst.d.toFixed(1)}）`,
    worst.d >= 20);
}

console.log('\n── ⑤ 中性階：一個家族、明度單調遞增 ──');
const ramp = ['--n-950', '--n-900', '--n-850', '--n-800', '--n-700', '--n-600',
  '--n-550', '--n-500', '--n-450', '--n-400', '--n-300', '--n-200', '--n-100'];
const Ls = ramp.map((k) => lightness(TOKENS[k]));
const monotonic = Ls.every((v, i) => i === 0 || v > Ls[i - 1]);
checkTruthy('🔴 明度嚴格遞增（撞階＝有兩個 token 是同一個顏色，舊系統就是這樣壞的）', monotonic);
const gaps = Ls.slice(1).map((v, i) => v - Ls[i]);
checkTruthy(`沒有任何一階的落差 < 3（實際最小 ${Math.min(...gaps).toFixed(1)}）`, Math.min(...gaps) >= 3);

await browser.close();
server.close();
console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);

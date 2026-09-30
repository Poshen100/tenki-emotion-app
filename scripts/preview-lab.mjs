/**
 * preview-lab.mjs — `/v3/` Lab 分頁的守門。
 *
 * 🔴 為什麼是新的一支：**Lab 到 2026-09-30 為止一條斷言都沒有。**
 * 它是這個產品的「真實面」—— 校準台（你在什麼狀態下最跟得住自己的流程）、
 * Baseline 讀數、偏移預警入口 —— 也就是最會說謊的那一面，因為它印的
 * 每一個數字都宣稱是使用者自己的。既有六支 harness 走的是 Today /
 * Session / 收束 / 掃描 / token，沒有一支進得來。
 *
 * 這一支守四件**本輪真的出過錯**的事：
 *
 *  ① 樣本不足的欄位不准印分子。`2 / 2 筆` 就是「100%」的另一種寫法，
 *     跟同一欄的「資料累積中」直接打架，而讀者一定挑數字信。
 *  ② 樣本不足的斜線紋要填滿整條軌道。編碼量值的是**位置**不是材質 ——
 *     貼底的斜紋一樣讀成「這個帶位最差」，正好是相反的意思。
 *  ③ 帶位色只准上在帶位身上。`--cyan-core` ＝ `--zone-clear` 逐位元組
 *     相同，拿它當「有資料」的底色會讓一筆 Strain 讀數坐在 Clear 色的卡裡。
 *  ④ 校準台的字要讀得動。**排除了幾筆、還差幾筆** —— 讓這張圖誠實的
 *     那些字，先前是全頁對比最低的（3.47:1）。誠實寫進了邏輯沒寫進排版。
 *
 * ⚠️ 每一條都反向驗證過（破壞 → 紅 → 還原 → 綠），紀錄在 commit message。
 *
 * Run:  node scripts/preview-lab.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
import { getChromium } from './lib/playwright.mjs';
import { resolveRoute } from './lib/preview-routes.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const chromium = await getChromium();
const repoRoot = resolve(new URL('..', import.meta.url).pathname);

let pass = 0;
let fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`}`);
}
function checkTruthy(name, value, detail = '') {
  value ? pass++ : fail++;
  console.log(`${value ? '✓' : '✗'} ${name}${value ? '' : `\n    ${detail}`}`);
}

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};
// 路由整組讀 vercel.json —— 手抄過三次，第三次是 `/drift/` 解到目錄
// 而那底下真的有 index.html，於是回 200 截到別頁。見 lib/preview-routes.mjs。
const server = http.createServer((req, res) => {
  const route = resolveRoute(decodeURIComponent(req.url.split('?')[0]));
  if ('redirect' in route) { res.writeHead(307, { location: route.redirect }).end(); return; }
  let file = join(repoRoot, route.path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(repoRoot) || !existsSync(file)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'text/plain' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const READING_KEY = 'tenki.readiness.reading.v1';
const OUTCOME_KEY = 'tenki.alert.outcomes.v1';

/** 帶位色的 canonical 值（tokens.css `--zone-*`）。 */
const ZONE = { clear: 'rgb(0, 180, 216)', neutral: 'rgb(100, 116, 139)', strain: 'rgb(194, 112, 61)' };

const browser = await chromium.launch();

/**
 * 開一個 Lab 分頁。
 *
 * @param {(keys:{reading:string,outcome:string}) => void} [seed] - 在頁面載入前跑的種子函式。
 * @returns {Promise<import('playwright').Page>}
 */
async function openLab(seed) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // 容器連不到 CDN、CI 連得到 —— 一律擋掉讓兩邊條件一致（PLAYBOOK §6）。
  await page.route(/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com)/, (r) => r.abort());
  page.on('pageerror', (e) => { errors.push(String(e)); });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(base)) missed.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  if (seed) await page.addInitScript(seed, { reading: READING_KEY, outcome: OUTCOME_KEY });
  await page.goto(`${base}/v3/#lab`, { waitUntil: 'domcontentloaded' });
  // splash 的 AUTO_DISMISS_AT = 2400ms，等不夠就只截得到 splash。
  await page.waitForTimeout(3600);
  return page;
}

const errors = [];
const missed = [];

// ═══════════════════════════════════════════════════
// 1. 校準台：樣本不足的那一欄
// ═══════════════════════════════════════════════════
console.log('\n── 🔴 樣本不足的欄位不准印分子 ──');

const seedMixed = ({ reading, outcome }) => {
  const now = Date.now();
  const rows = [];
  let i = 0;
  const add = (band, tag) => rows.push({
    id: `o${i++}`, ts: now - i * 5 * 3600 * 1000, tmplId: 'MANCINI_FBD', symbol: 'ES1!',
    outcomeTag: tag, readingAtDecision: { band, staleAtDecision: false },
  });
  // Clear 8 筆（6 紀律）→ 75%；Neutral 5 筆（2 紀律）→ 40%；Strain 2 筆 → 樣本不足
  for (let k = 0; k < 6; k++) add('clear', 'judged_entered');
  for (let k = 0; k < 2; k++) add('clear', 'abandoned_no_judgment');
  for (let k = 0; k < 2; k++) add('neutral', 'judged_stood_down');
  for (let k = 0; k < 3; k++) add('neutral', 'abandoned_no_judgment');
  // ⚠️ 這兩筆刻意**兩筆都紀律** —— 舊版會印 `2 / 2 筆`，也就是「100%」。
  //    種一組「分子等於分母」的資料，才測得到那個 bug。
  for (let k = 0; k < 2; k++) add('strain', 'judged_entered');
  localStorage.setItem(outcome, JSON.stringify(rows));
  localStorage.setItem(reading, JSON.stringify({
    ts: now - 3600000, band: 'strain', confidence: 'moderate',
    evidence: { stillness: 0.5, lighting: 0.5, uniformity: 0.5, blinkCadence: 0.5, tier: 'A' },
  }));
};

const lab = await openLab(seedMixed);

const cols = await lab.evaluate(() => [...document.querySelectorAll('.cal-col')].map((c) => ({
  band: c.classList.contains('clear') ? 'clear' : c.classList.contains('neutral') ? 'neutral' : 'strain',
  thin: c.classList.contains('thin'),
  rate: c.querySelector('.cal-rate').textContent.trim(),
  n: c.querySelector('.cal-n').textContent.trim(),
  barH: Math.round(c.querySelector('.cal-bar').getBoundingClientRect().height),
  trackH: Math.round(c.querySelector('.cal-track').getBoundingClientRect().height),
})));

const thinCol = cols.find((c) => c.thin);
checkTruthy('有一欄樣本不足（種子真的種出這個狀態）', !!thinCol, JSON.stringify(cols));
check('樣本不足的欄位印「資料累積中」', thinCol?.rate, '資料累積中');
// 🔴 這一條是本輪的主修。`2 / 2` 與「資料累積中」同框 = 同一欄自相矛盾。
checkTruthy(
  '🔴 樣本不足的欄位不含分數（不得出現 `/`）',
  thinCol && !thinCol.n.includes('/'),
  `印了 "${thinCol?.n}" —— 分子就是那個不該出現的東西`
);
checkTruthy(
  '樣本不足的欄位改講「還差幾筆」',
  thinCol && /還需\s*\d+\s*筆/.test(thinCol.n),
  `印了 "${thinCol?.n}"`
);
// 對照組：樣本足夠的欄位**仍然要**印分數。只驗上面那條的話，
// 一個「所有欄位都不印分數」的 bug 會讓它全綠。
const fatCols = cols.filter((c) => !c.thin);
checkTruthy('樣本足夠的欄位仍然印分數（對照組）', fatCols.length >= 2 && fatCols.every((c) => c.n.includes('/')),
  JSON.stringify(fatCols.map((c) => c.n)));
checkTruthy('樣本足夠的欄位印百分比（對照組）', fatCols.every((c) => /%$/.test(c.rate)),
  JSON.stringify(fatCols.map((c) => c.rate)));

console.log('\n── 🔴 樣本不足＝滿格斜紋，不是一根矮長條 ──');
// 編碼量值的是位置。貼底的斜紋照樣落在「低」的位置上，於是三欄並排
// 讀起來是「Strain 最差」—— 而真正的意思是「Strain 還沒有結論」。
checkTruthy(
  '🔴 樣本不足的斜紋填滿整條軌道',
  thinCol && thinCol.barH >= thinCol.trackH - 4,
  `bar=${thinCol?.barH}px track=${thinCol?.trackH}px —— 沒填滿就還有一個高度可以跟隔壁比`
);
checkTruthy(
  '樣本足夠的長條高度跟著比率走（對照組）',
  fatCols.every((c) => c.barH > 0 && c.barH < c.trackH - 4),
  JSON.stringify(fatCols.map((c) => `${c.barH}/${c.trackH}`))
);

// ═══════════════════════════════════════════════════
// 2. 帶位色只上在帶位身上
// ═══════════════════════════════════════════════════
console.log('\n── 🔴 Baseline 磁磚不得穿 Clear 的顏色 ──');

const tile = await lab.evaluate(() => {
  const t = document.getElementById('labBaselineTile');
  const cs = getComputedStyle(t);
  const ic = getComputedStyle(t.querySelector('.ic'));
  const dot = t.querySelector('.band-dot');
  return {
    cls: t.className,
    border: cs.borderColor, bg: cs.backgroundColor, shadow: cs.boxShadow,
    icBg: ic.backgroundColor, icFg: ic.color,
    dotCls: dot ? dot.className : null,
    dotBg: dot ? getComputedStyle(dot).backgroundColor : null,
    sub: t.querySelector('.sub').textContent,
  };
});

// 讀數是 strain，所以磁磚上**任何** cyan 都是在宣稱一個不是他的帶位。
const cyanRe = /0,\s*180,\s*216/;
const chrome = [tile.border, tile.bg, tile.shadow, tile.icBg, tile.icFg].join(' ');
checkTruthy(
  '🔴 Strain 讀數時，磁磚 chrome 一點 cyan 都沒有',
  !cyanRe.test(chrome),
  `--cyan-core ＝ --zone-clear，chrome 出現它就是在說 Clear：${chrome}`
);
checkTruthy('磁磚回到中性邊框', /54,\s*65,\s*79/.test(tile.border), tile.border);
check('帶位點帶著正確的帶位 class', tile.dotCls, 'band-dot strain');
check('帶位點吃 --zone-strain 本尊', tile.dotBg, ZONE.strain);
checkTruthy('副標仍然印得出帶位', /Strain/.test(tile.sub), tile.sub);
await lab.close();

// 三個帶位各自對上自己的色 + 沒讀數不給點。
// 🔴 只驗 strain 的話，一個「把點寫死成橘色」的 bug 會全綠。
for (const band of ['clear', 'neutral', 'strain']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route(/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com)/, (r) => r.abort());
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(
    ([key, b]) => {
      localStorage.setItem(key, JSON.stringify({
        ts: Date.now() - 3600000, band: b, confidence: 'moderate',
        evidence: { stillness: 0.5, lighting: 0.5, uniformity: 0.5, blinkCadence: 0.5, tier: 'A' },
      }));
    },
    [READING_KEY, band],
  );
  await page.goto(`${base}/v3/#lab`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3600);
  const dotBg = await page.evaluate(() => {
    const d = document.querySelector('#labBaselineSub .band-dot');
    return d ? getComputedStyle(d).backgroundColor : null;
  });
  check(`${band} 的點 = --zone-${band}`, dotBg, ZONE[band]);
  await page.close();
}

const empty = await openLab();
const emptyDot = await empty.evaluate(() => !!document.querySelector('#labBaselineSub .band-dot'));
// 🔴 沒讀數不給灰點：灰是 --zone-neutral 的帶位色，
//    「不知道」跟「Neutral」是兩件事。
checkTruthy('沒有讀數時不給點（不是給一顆灰點）', emptyDot === false);

// ═══════════════════════════════════════════════════
// 3. 誠實的字要讀得動
// ═══════════════════════════════════════════════════
console.log('\n── 🔴 校準台的文字對比（WCAG 4.5:1）──');

const contrasts = await empty.evaluate(() => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const parse = (s) => (s.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  const bgOf = (el) => { let e = el; while (e) { const c = getComputedStyle(e).backgroundColor;
    if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e = e.parentElement; } return 'rgb(0,0,0)'; };
  const ratio = (fg, bg) => { const a = lum(parse(fg)); const b = lum(parse(bg));
    const [hi, lo] = a > b ? [a, b] : [b, a]; return +(((hi + 0.05) / (lo + 0.05)).toFixed(2)); };
  return ['.cal-kicker', '.cal-n', '.cal-foot', '.cal-band', '.lab-sec', '.lab-soon-head', '.cal-empty']
    .map((sel) => { const el = document.querySelector(sel); if (!el) return { sel, missing: true };
      const cs = getComputedStyle(el);
      return { sel, px: parseFloat(cs.fontSize), ratio: ratio(cs.color, bgOf(el)) }; });
});
for (const c of contrasts) {
  checkTruthy(
    `${c.sel} 對比 ≥ 4.5:1（實測 ${c.ratio}，${c.px}px）`,
    !c.missing && c.ratio >= 4.5,
    c.missing ? '選不到這個元素 —— 斷言等於空過' : `${c.ratio}:1 不到 4.5 —— 這幾行正是講「排除了幾筆」的那些字`
  );
}

console.log('\n── 入口與執行時期 ──');
const entry = await empty.evaluate(() => {
  const a = document.getElementById('labDriftRow');
  return { href: a?.getAttribute('href'), sub: document.getElementById('labDriftSub')?.textContent,
    chevronColor: getComputedStyle(a.lastElementChild).color };
});
check('Lab 有連到 /drift/ 的入口', entry.href, '/drift/');
checkTruthy('入口副標由 JS 算出來（不是 HTML 預設字）', (entry.sub ?? '').length > 0, JSON.stringify(entry.sub));
// 導覽記號＝中性（founder 2026-09-08）。琥珀只給會改變狀態的。
checkTruthy('導覽 › 是中性色，不是可動層琥珀',
  !/255,\s*160,\s*40/.test(entry.chevronColor), entry.chevronColor);

const overflow = await empty.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
checkTruthy(`390px 下沒有橫向溢出（多出 ${overflow}px）`, overflow <= 1);
await empty.close();

check('沒有 runtime error', errors, []);
check('沒有同源 404（本地路由＝正式路由）', missed, []);

await browser.close();
server.close();
console.log(`\n══════════ preview-lab ══════════\n ${pass} passed, ${fail} failed\n═════════════════════════════════`);
process.exit(fail === 0 ? 0 : 1);

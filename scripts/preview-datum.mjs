/**
 * preview-datum.mjs — Datum Glyphs（圖示系統 v4）與 Geist 字型的守門。
 *
 * 守的是這套圖示自己宣稱的那幾條規則 —— 規則寫在 `apps/preview/datum-glyphs.js`
 * 檔頭與 `tokens.css` 的 `.dg` 段落，這裡把它們變成會紅的東西：
 *
 *  ① 一顆圖示最多一個 datum（`.d` 與 `.a` 合計 ≤ 1）。
 *  ② `unmeasured` 沒有 datum —— 沒量到就沒有「被量到的點」。
 *  ③ `/v3/` 上每一個 `[data-datum]` 佔位都真的被填成一顆 svg（佔位是空的，
 *     沒填等於那個位置什麼都沒有，而且不會報錯）。
 *  ④ 底部導覽同時只有一個青色的 datum，而且它在選中的那一格上。
 *  ⑤ 圖示的結構不帶語意色 —— 選中的那一格結構是中性的，只有 datum 是青的。
 *  ⑥ Geist / Geist Mono 是自架的而且真的載入了（不是靜靜退回系統字）。
 *
 * Run:  node scripts/preview-datum.mjs
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

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
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

/** tokens.css 的 canonical 值。 */
const CYAN_ACTIVE = 'rgb(34, 211, 238)';

const errors = [];
const missed = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
// 容器連不到 CDN、CI 連得到 —— 一律擋掉讓兩邊條件一致（PLAYBOOK §6）。
await page.route(/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com)/, (r) => r.abort());
page.on('pageerror', (e) => { errors.push(String(e)); });
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().startsWith(base)) missed.push(`${r.status()} ${new URL(r.url()).pathname}`);
});
await page.goto(`${base}/v3/#today`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3600); // splash AUTO_DISMISS_AT = 2400ms

// ═══════════════════════════════════════════════════
console.log('\n── 圖示本身的規則 ──');
const registry = await page.evaluate(() => {
  const G = window.TENKI_DATUM && window.TENKI_DATUM.GLYPHS;
  if (!G) return null;
  const host = document.createElement('div');
  return Object.keys(G).map((name) => {
    host.innerHTML = window.TENKI_DATUM.svg(name);
    return { name, datums: host.querySelectorAll('.d, .a').length };
  });
});
check('registry 載入了（window.TENKI_DATUM）', registry !== null, true);
const glyphs = registry ?? [];
check('registry 有 20 顆', glyphs.length, 20);
check('① 每顆最多一個 datum（列出違規者）', glyphs.filter((g) => g.datums > 1).map((g) => g.name), []);
check('② unmeasured 沒有 datum', glyphs.find((g) => g.name === 'unmeasured')?.datums, 0);
check('svg() 對不認得的名字回空字串，不是壞掉的 svg',
  await page.evaluate(() => window.TENKI_DATUM ? window.TENKI_DATUM.svg('no-such-glyph') : null), '');

// ═══════════════════════════════════════════════════
console.log('\n── /v3/ 上的佔位都被填了 ──');
const slots = await page.evaluate(() => [...document.querySelectorAll('[data-datum]')].map((n) => ({
  name: n.getAttribute('data-datum'),
  filled: n.querySelectorAll(':scope > svg.dg').length === 1,
})));
// 先斷言「真的有東西可量」—— 選不到的話下面那條是空過（PLAYBOOK §6）。
// 🔴 點名，不數數。第一版寫「≥ 20 個」，而 JS 會重繪模板清單、把其中幾個佔位換掉，
//    DOM 裡實際剩 19 個 —— 門檻剛好卡在實際值上面，跟被守的東西壞沒壞無關。
const MUST_HAVE = ['today', 'scan', 'session', 'timeline', 'lab', 'turning', 'alert', 'pulse', 'baseline', 'wearable', 'history', 'premium'];
const present = new Set(slots.map((s) => s.name));
check('導覽 5 顆與 Lab 7 顆的佔位都在（列出不見的）', MUST_HAVE.filter((n) => !present.has(n)), []);
check('③ 每一個佔位都剛好填進一顆 svg.dg（列出沒填的）', slots.filter((s) => !s.filled).map((s) => s.name), []);

// JS 畫的那一條路（ICON_SVG → 底座的模板圖示）不經過佔位，要另外問。
check('底座的模板圖示是 JS 從 registry 畫的 svg.dg',
  await page.evaluate(() => document.querySelectorAll('#fdcbIcon > svg.dg').length), 1);

// ═══════════════════════════════════════════════════
console.log('\n── 底部導覽：一個青色的點 ──');
for (const tab of ['today', 'scan', 'session', 'timeline', 'lab']) {
  await page.evaluate((t) => window.goTab(t), tab);
  await page.waitForTimeout(450); // 顏色有 0.3s transition
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#tabbar .tab')].map((t) => {
    const svg = t.querySelector('svg.dg');
    const d = svg && svg.querySelector('.d');
    return {
      tab: t.dataset.tab,
      active: t.classList.contains('active'),
      datum: d ? getComputedStyle(d).fill : null,
      structure: svg ? getComputedStyle(svg).stroke : null,
    };
  }));
  const cyan = tabs.filter((t) => t.datum === CYAN_ACTIVE).map((t) => t.tab);
  check(`④ ${tab}：青色 datum 只有一個，而且在選中的那一格`, cyan, [tab]);
  const act = tabs.find((t) => t.active);
  check(`⑤ ${tab}：選中那一格的結構不是青色`, act && act.structure !== CYAN_ACTIVE, true);
}

// ═══════════════════════════════════════════════════
console.log('\n── 字型：自架的 Geist 真的載入了 ──');
await page.evaluate(() => document.fonts.ready);
const fonts = await page.evaluate(() => ({
  sans: [...document.fonts].some((f) => /^"?Geist"?$/.test(f.family) && f.status === 'loaded'),
  // Geist Mono 只在有元素用到 `--mono` 時才會被要求下載，所以明確請它載一次。
  bodyFirst: getComputedStyle(document.body).fontFamily.split(',')[0].trim().replace(/"/g, ''),
}));
check('⑥ body 的第一順位字型是 Geist', fonts.bodyFirst, 'Geist');
check('⑥ Geist 的 @font-face 已載入（不是靜靜退回系統字）', fonts.sans, true);
const mono = await page.evaluate(() => document.fonts.load('12px "Geist Mono"').then((l) => l.length > 0));
check('⑥ Geist Mono 載得到', mono, true);

check('沒有 runtime error', errors, []);
check('沒有同源 404（字型與 registry 的路徑＝正式路由）', missed, []);

await browser.close();
server.close();
console.log(`\n══════════ preview-datum ══════════\n ${pass} passed, ${fail} failed\n═══════════════════════════════════`);
process.exit(fail === 0 ? 0 : 1);

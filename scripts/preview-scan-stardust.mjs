/**
 * preview-scan-stardust.mjs — readiness-scan 與星塵之間的掛載契約迴歸測試。
 *
 * 守的是什麼：掃描覆蓋層會反覆開關，**每一次都必須把 WebGL context 還回去**。
 * 漏掉 unmount 不會當場壞掉 —— 它會在連續掃描幾次之後，以「球無聲凍住」的形式
 * 出現在 iOS 上（瀏覽器對同時存活的 context 有上限，超過就回收最舊的）。
 * 這種延遲、間歇、只在真機出現的症狀，正是最需要自動化守住的一類。
 *
 * ⚠️ 覆蓋範圍的誠實邊界：
 * 沙箱擋掉 cdnjs（實測 `CONNECT tunnel failed, 403`），所以**真的 three.js 載不進來**。
 * 本 harness 用 stub 取代 `window.TENKI_STARDUST`，斷言的是 readiness-scan 的
 * **呼叫契約**（有沒有掛、掛在哪個節點、有沒有還、reduced-motion 有沒有跳過）。
 * 它**不驗證**粒子畫面、不驗證 stardust.js 內部的 forceContextLoss 是否真的釋放了
 * context —— 那兩件事只能靠 founder 手機實走（PLAYBOOK §3 CI 盲區）。
 *
 * Run:  node scripts/preview-scan-stardust.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  // decision-alert.html 用絕對路徑載 /preview/readiness-scan.js 與 /preview/v6/stardust.js
  // （不依賴 /decision-alert/ 的 rewrite）。正式站由 Vercel 把 /preview/* 映到
  // apps/preview/*；本地伺服器要自己做，否則模組靜默載不進來、頁面看起來卻正常。
  if (clean.startsWith('/preview/')) clean = '/apps' + clean;
  let file = join(repoRoot, clean);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !file.startsWith(repoRoot)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const PAGE = `${base}/apps/preview/decision-alert.html`;

let pass = 0;
let fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`}`);
}

/** 假的 TENKI_STARDUST：記下呼叫序列，並回報自己掛在哪個節點上。 */
const STUB = `
window.__sdCalls = [];
window.__sdHostClass = null;
window.__sdHostMounted = false;   // 模擬 host 頁面（v6）已持有綁定
(function () {
  var mounted = false;
  window.TENKI_STARDUST = {
    mount: function (el) {
      if (window.__sdHostMounted || mounted) { window.__sdCalls.push('mount:refused'); return false; }
      mounted = true;
      window.__sdCalls.push('mount');
      window.__sdHostClass = el && el.className;
      return true;
    },
    unmount: function () { mounted = false; window.__sdCalls.push('unmount'); },
    isMounted: function () { return window.__sdHostMounted || mounted; },
    playEntrance: function () { window.__sdCalls.push('playEntrance'); },
    setExpression: function () { window.__sdCalls.push('setExpression'); },
    clearExpression: function () { window.__sdCalls.push('clearExpression'); },
    dim: function () {}, brighten: function () {}, destroy: function () { mounted = false; },
  };
})();
`;

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

async function newPage(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ['camera'],
    reducedMotion: opts.reducedMotion,
  });
  const page = await ctx.newPage();
  await page.addInitScript(STUB + (opts.hostMounted ? '\nwindow.__sdHostMounted = true;' : ''));
  page.on('pageerror', (e) => { console.error('[pageerror]', e.message); fail += 1; });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TENKI_READINESS_SCAN);
  return { ctx, page };
}

/** 開始一次掃描、等它真的掛好、然後取消。回傳呼叫序列。 */
async function scanAndCancel(page) {
  await page.evaluate(() => {
    window.__done = false;
    window.TENKI_READINESS_SCAN.begin({ mission: 'decision', symbol: 'ES1!' })
      .then(() => { window.__done = true; });
  });
  // 相機起來之後才掛星塵 → 等到掛載發生或超時（無相機時序列會保持空的）
  await page.waitForFunction(
    () => window.__sdCalls.length > 0 || document.querySelector('#tenki-readiness-scan.open'),
    { timeout: 8000 },
  ).catch(() => {});
  await page.waitForTimeout(1200);
  await page.click('#tenki-readiness-scan .rs-cancel');
  await page.waitForFunction(() => window.__done === true, { timeout: 5000 });
  return page.evaluate(() => window.__sdCalls.slice());
}

// ── 1. 正常路徑：掛在 .rs-stardust 上，取消後歸還 ──
{
  const { ctx, page } = await newPage();
  const calls = await scanAndCancel(page);
  check('掛載於 .rs-stardust 容器', await page.evaluate(() => window.__sdHostClass), 'rs-stardust');
  check('mount 先於 playEntrance', calls.indexOf('mount') < calls.indexOf('playEntrance'), true);
  check('取消後有 unmount', calls.includes('unmount'), true);
  check('mount 與 unmount 次數相等',
    calls.filter((c) => c === 'mount').length === calls.filter((c) => c === 'unmount').length, true);
  await ctx.close();
}

// ── 2. 連開兩次不累積（這條就是 context 洩漏的守門員）──
{
  const { ctx, page } = await newPage();
  await scanAndCancel(page);
  const calls = await scanAndCancel(page);
  const mounts = calls.filter((c) => c === 'mount').length;
  const unmounts = calls.filter((c) => c === 'unmount').length;
  check('連掃兩次：mount 兩次', mounts, 2);
  check('連掃兩次：unmount 也兩次（沒有洩漏）', unmounts, 2);
  check('第二次沒有被 refused（前一次確實還乾淨了）',
    calls.filter((c) => c === 'mount:refused').length, 0);
  await ctx.close();
}

// ── 2b. Progress Halo：結構、conic 寫入、以及 SECURED 不得殘留到下一輪 ──
{
  const { ctx, page } = await newPage();
  await page.evaluate(() => {
    window.TENKI_READINESS_SCAN.begin({ mission: 'decision' });
  });
  await page.waitForSelector('#tenki-readiness-scan.open');
  check('halo 在 frame 內',
    await page.evaluate(() => !!document.querySelector('#tenki-readiness-scan .rs-frame > svg.rs-halo')), true);
  // 光弧必須與框**共用同一條路徑**：track 與 fill 的幾何一字不差。
  // 2026-08-07 實走踩過的坑是一個 border-radius:50% 的圓套在圓角方框外面，
  // 畫面上變成兩個不相干的環 —— 這條就是防它回來。
  check('track 與 fill 幾何完全相同', await page.evaluate(() => {
    const g = (s) => {
      const r = document.querySelector('#tenki-readiness-scan .' + s);
      return ['x', 'y', 'width', 'height', 'rx', 'ry'].map((a) => r.getAttribute(a)).join(',');
    };
    return g('rs-halo-track') === g('rs-halo-fill');
  }), true);
  check('框本身沒有另一條 CSS border（避免第二個形狀）', await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-frame'));
    return cs.borderTopWidth;
  }), '0px');
  check('進度用 pathLength 正規化的 stroke-dash（弧長比例，不是角度）',
    await page.evaluate(() => {
      const f = document.querySelector('#tenki-readiness-scan .rs-halo-fill');
      return f.getAttribute('pathLength') === '1' && /^[\d.]+ 1$/.test(f.getAttribute('stroke-dasharray') || '');
    }), true);

  // 模擬「上一輪收束成 SECURED」的殘留狀態，再開新的一輪。
  await page.evaluate(() => document.querySelector('#tenki-readiness-scan .rs-frame').classList.add('secured'));
  await page.click('#tenki-readiness-scan .rs-cancel');
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');
  check('新一輪開場不得殘留 SECURED 金框',
    await page.evaluate(() => document.querySelector('#tenki-readiness-scan .rs-frame').classList.contains('secured')), false);
  await ctx.close();
}

// ── 3. reduced-motion：完全不掛 ──
{
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' });
  const calls = await scanAndCancel(page);
  check('減少動態時完全不掛星塵', calls.filter((c) => c === 'mount').length, 0);
  check('減少動態時掃描仍正常收尾', await page.evaluate(() => window.__done), true);
  await ctx.close();
}

// ── 4. host 已持有綁定（v6 的 #universe）：不搶，也不炸 ──
{
  const { ctx, page } = await newPage({ hostMounted: true });
  const calls = await scanAndCancel(page);
  check('host 已綁定時不搶（不呼叫 playEntrance）', calls.includes('playEntrance'), false);
  check('host 已綁定時掃描仍正常收尾', await page.evaluate(() => window.__done), true);
  await ctx.close();
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);

/**
 * preview-scan-shot.mjs — 把掃描覆蓋層打開並截圖，用來在推給 founder 之前
 * 自己先確認**幾何**對不對。
 *
 * 為什麼需要它：掃描覆蓋層是 `begin()` 之後才出現的，一般的 preview-shot 截不到。
 * 而光弧與掃描框是純 SVG/CSS，**不受沙箱擋 CDN 影響**（只有星塵需要 three.js），
 * 所以「光弧有沒有沿著框走」這件事在容器裡就驗得掉。
 *
 * 2026-08-07 的教訓：第一版光弧是一個 border-radius:50% 的圓套在圓角方框外面，
 * 實機上是兩個不相干的環 —— 那是一眼可見的錯，而我卻讓 founder 用手機幫我發現。
 *
 * Run:  node scripts/preview-scan-shot.mjs [outDir]
 * 產出：<outDir>/scan-progress.png（進行中）與 <outDir>/scan-secured.png（收束）
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const outDir = resolve(process.argv[2] ?? '/tmp/scan-shot');
mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  if (clean.startsWith('/preview/')) clean = '/apps' + clean; // 正式站由 Vercel rewrite
  let file = join(repoRoot, clean);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !file.startsWith(repoRoot)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ['camera'],
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`${base}/apps/preview/decision-alert.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.TENKI_READINESS_SCAN);

await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision', symbol: 'ES1!' }); });
await page.waitForSelector('#tenki-readiness-scan.open');

// 未對準：標記偏離目標環、膠囊給方向、光弧被壓暗（「環停住是因為你」）。
// 這一張要看的是**看不到臉的情況下知不知道往哪移** —— 標記偏左下、環在中心，
// 使用者要做的事就是把標記推進環裡。
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const f = document.querySelector('#tenki-readiness-scan .rs-frame');
  f.classList.add('stalled', 'tracking');
  f.classList.remove('locked');
  f.style.setProperty('--rs-err', '0.9'); // 角括號張到很開＝還差得遠
  // 標記的位置與大小走 transform（renderReticle 不再寫 cx/cy/r）。
  const r = document.querySelector('#tenki-readiness-scan .rs-reticle');
  r.style.transform = 'translate(-40px,37px) scale(0.73)';
  document.querySelector('#tenki-readiness-scan [data-rs="hint-icon"]').textContent = '↑';
  document.querySelector('#tenki-readiness-scan [data-rs="hint-text"]').textContent = '向上對齊';
  document.querySelector('#tenki-readiness-scan .rs-halo-fill').style.strokeDasharray = '0.28 1';
});
await page.waitForTimeout(450);
await page.locator('#tenki-readiness-scan .rs-frame').screenshot({ path: join(outDir, 'scan-frame-unaligned.png') });
await page.screenshot({ path: join(outDir, 'scan-unaligned.png') });

// 鎖定：標記磁吸歸位與目標環合一、角括號收攏、光弧恢復
await page.evaluate(() => {
  const f = document.querySelector('#tenki-readiness-scan .rs-frame');
  f.classList.remove('stalled');
  f.classList.add('locked', 'lock-beat');
  f.style.setProperty('--rs-err', '0.05');
  const r = document.querySelector('#tenki-readiness-scan .rs-reticle');
  r.style.transform = ''; // 合一＝回到中心的原尺寸
  document.querySelector('#tenki-readiness-scan [data-rs="hint-icon"]').textContent = '';
  document.querySelector('#tenki-readiness-scan [data-rs="hint-text"]').textContent = '保持穩定';
});
await page.waitForTimeout(600);
await page.locator('#tenki-readiness-scan .rs-frame').screenshot({ path: join(outDir, 'scan-frame-locked.png') });
await page.screenshot({ path: join(outDir, 'scan-locked.png') });

// 用 inline style 而不是 setAttribute：setProgress() 寫的是 presentation attribute，
// 而 tick 迴圈每 66ms 就覆寫一次 —— inline style 優先權較高，才壓得住。
await page.evaluate(() => {
  document.querySelector('#tenki-readiness-scan .rs-halo-fill').style.strokeDasharray = '0.62 1';
});
await page.locator('#tenki-readiness-scan .rs-frame').screenshot({ path: join(outDir, 'scan-frame-progress.png') });
await page.screenshot({ path: join(outDir, 'scan-progress.png') });

// 收束：SECURED 金色 + 光弧閉合
await page.evaluate(() => {
  // 與 setProgress(1) 一致：收滿是實線，不留接縫。
  document.querySelector('#tenki-readiness-scan .rs-halo-fill').style.strokeDasharray = 'none';
  document.querySelector('#tenki-readiness-scan .rs-frame').classList.add('secured');
});
await page.waitForTimeout(500);
await page.locator('#tenki-readiness-scan .rs-frame').screenshot({ path: join(outDir, 'scan-frame-secured.png') });
await page.screenshot({ path: join(outDir, 'scan-secured.png') });

console.log(`✓ ${outDir}/scan-frame-progress.png（框特寫 · 進行中 62%）`);
console.log(`✓ ${outDir}/scan-frame-secured.png（框特寫 · SECURED）`);
console.log(`✓ ${outDir}/scan-progress.png / scan-secured.png（全畫面）`);
console.log('⚠️ 星塵不在圖上 —— 沙箱擋 three.js CDN，粒子只能實機看。');
await browser.close();
server.close();

/**
 * preview-strip-color.mjs — 迴歸驗證：momentum strip 的顏色必須與紀律完成率一致。
 *
 * 為什麼需要這支：`apps/preview/**` 是 CI 盲區（PLAYBOOK §3），而「條紋顏色」這種
 * 錯誤語法檢查抓不到、只有人眼在手機上看得出來。
 *
 * 2026-08-07 founder 實走查出的實例：結構守望（#219）把 outcomeTag 改名成
 * judged_entered / judged_stood_down / abandoned_no_judgment 之後，`segColor()`
 * 仍在逐一比對舊名，於是 `judged_entered` 掉進 else 分支被畫成 strain 橘
 * (#C2703D) —— 同一筆決策，條紋說「破戒」而正上方的完成率說 100%。
 *
 * 反向驗證過：把 segColor() 改回舊版，本 harness 會失敗並回報 rgb(194,112,61)。
 *
 * 走法：模擬快訊 → 進入決策 → 選 FBD → 立刻「成立 · 我進場了」→ 讀收束頁條紋。
 * Run:  node scripts/preview-strip-color.mjs
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
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
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

/** tokens.css：--zone-strain #C2703D / --zone-clear #00B4D8 */
const STRAIN = 'rgb(194, 112, 61)';
const CLEAR = 'rgb(0, 180, 216)';

let pass = 0;
let fail = 0;
function check(name, got, want) {
  const ok = got === want;
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    got:  ${got}\n    want: ${want}`}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
page.on('pageerror', (e) => {
  console.error('[pageerror]', e.message);
  fail += 1;
});

await page.goto(`${base}/apps/preview/decision-alert.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);

await page.click('#btnSingle');
await page.waitForTimeout(600);
await page.click('#btnEngage');
await page.waitForTimeout(400);
await page.click('.tpl-card'); // 建議的 FBD
await page.waitForTimeout(1200); // 讓守望條累積幾秒（快速判定正是要保護的案例）
await page.click('#btnStructureConfirmed');
await page.waitForTimeout(1600); // 收束頁的揭示編排

const rate = (await page.textContent('#resultRate'))?.trim() ?? '';
console.log(`\n紀律完成率文字：「${rate}」`);
check('快速判定進場算紀律（完成率 100%）', /100%/.test(rate), true);

const segBg = await page.$eval('#resultStrip .result-seg', (n) => getComputedStyle(n).backgroundColor);
check('momentum strip 本次段落 = 紀律色', segBg, CLEAR);
check('momentum strip 不得畫成 strain 橘', segBg !== STRAIN, true);

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);

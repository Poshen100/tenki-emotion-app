/**
 * preview-scan-blink.mjs — 驗 Soul Lock Beat 3 的眨眼偵測。
 *
 * 為什麼需要這支：founder 2026-08-29 兩次實走都拿到「未偵測到眨眼」，第二次
 * 他明確說**他有眨**。原因是 FaceMesh 每 180ms 才推論一次，而一次眨眼閉合只有
 * 100–150ms —— 落到取樣點上的多半是「半閉」那一幀，絕對門檻兩邊都不滿足。
 *
 * 偵測改成看谷底之後，風險就換了一邊：**放寬靈敏度不能放寬誠實度**。
 * 「眨眼確認」那行字在宣稱一個事實，所以這支同時驗兩件事：
 *   - 真的眨眼要抓得到（含只抓到半閉那一幀的情況）
 *   - 瞇眼、低頭、緩慢閉合**不得**被算成眨眼
 *
 * 直接餵開合度序列給模組開出來的純狀態機（`TENKI_READINESS_SCAN.__blink`），
 * 不開相機、不走完整場掃描。
 *
 * Run: node scripts/preview-scan-blink.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
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

/**
 * 每個案例是一串**取樣到的**開合度（每 180ms 一個），不是連續訊號 ——
 * 這正是儀器真正看得到的東西。
 */
const CASES = [
  // ── 應該要抓到 ──
  { name: '完整閉眼落在取樣點上（絕對門檻）',
    seq: [1, 1, 0.98, 0.10, 0.95, 1], want: 1 },
  { name: '只抓到半閉那一幀（180ms 取樣的常態）',
    seq: [1, 1, 0.97, 0.38, 0.99, 1], want: 1 },
  { name: '眼睛本來就比較細的人（基線 0.5）也要抓得到',
    seq: [0.5, 0.5, 0.5, 0.5, 0.5, 0.22, 0.5, 0.5], want: 1 },
  { name: '兩次眨眼算兩次',
    seq: [1, 1, 0.35, 1, 1, 1, 0.33, 1, 1], want: 2 },

  // ── 不得誤判（這排才是誠實度的守門）──
  { name: '瞇眼兩秒後睜開，不是眨眼',
    seq: [1, 1, 0.45, 0.44, 0.43, 0.45, 0.44, 0.43, 0.45, 1, 1], want: 0 },
  { name: '緩慢閉合再緩慢睜開（低頭），不是眨眼',
    seq: [1, 0.9, 0.75, 0.6, 0.45, 0.35, 0.45, 0.6, 0.75, 0.9, 1], want: 0 },
  { name: '完全沒眨（穩定睜著）',
    seq: [1, 1, 0.99, 1, 0.98, 1, 1], want: 0 },
  { name: '眨眼整個落在兩次取樣之間 → 誠實地報 0，不補一個',
    seq: [1, 1, 0.99, 0.97, 1, 0.98], want: 0 },
  { name: '輕微抖動不算眨眼',
    seq: [1, 0.95, 0.9, 0.93, 0.97, 1, 0.94], want: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/apps/preview/v6/index.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForFunction(() => !!(window.TENKI_READINESS_SCAN
  && window.TENKI_READINESS_SCAN.__blink), null, { timeout: 15_000 });

const consts = await page.evaluate(() => window.TENKI_READINESS_SCAN.__blink.constants);
console.log(`取樣間隔 ${consts.FACE_INTERVAL_MS}ms · 谷 <${consts.BLINK_DIP_RATIO}×基線 · `
  + `回升 ≥${consts.BLINK_RECOVER_RATIO}×基線 · 谷最長 ${consts.BLINK_DIP_MAX_SAMPLES} 幀\n`);

const results = await page.evaluate((cases) => {
  const B = window.TENKI_READINESS_SCAN.__blink;
  return cases.map((c) => {
    const st = B.newState();
    let n = 0;
    for (const v of c.seq) { if (B.detect(st, v)) n += 1; }
    return { name: c.name, want: c.want, got: n };
  });
}, CASES);

let pass = 0;
let fail = 0;
for (const r of results) {
  const ok = r.got === r.want;
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${r.name}` + (ok ? '' : `  ← 期望 ${r.want} 次，得到 ${r.got} 次`));
}

await browser.close();
server.close();
console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);

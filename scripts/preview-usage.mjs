/**
 * preview-usage.mjs — Lab「使用摘要」的檢查。
 *
 * 兩層：① `apps/preview/usage-summary.js` 的推導（純函式，直接載進 node）
 *       ② `/v3/` Lab 那一格真的點下去，畫面說的跟推導的是同一份。
 *
 * 用法：node scripts/preview-usage.mjs [--shot <png 路徑>]
 * ⚠️ 還沒接進 scripts/verify.sh 與 CI（那是制度變更，要 founder 自己 merge）。
 */
import { getChromium } from './lib/playwright.mjs';
import http from 'node:http';
import vm from 'node:vm';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { resolveRoute } from './lib/preview-routes.mjs';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     得到 ${JSON.stringify(actual)}\n     預期 ${JSON.stringify(expected)}`}`);
}

// ── ① 推導 ──────────────────────────────────────────────
const sandbox = { globalThis: {} };
vm.runInNewContext(readFileSync(join(repoRoot, 'apps/preview/usage-summary.js'), 'utf8'), sandbox);
const USAGE = sandbox.globalThis.TENKI_USAGE;

const NOW = Date.UTC(2026, 10, 16, 12);
const DAY = 24 * 60 * 60 * 1000;
const done = (summary) => summary.steps.filter((s) => s.done).map((s) => s.id);
const empty = { onboarded: false, readingCount: 0, hasChannel: false, outcomes: [], nowMs: NOW };

console.log('── 推導 ──');
check('什麼都沒做 → 沒有任何一步打勾，筆數全是 0',
  [done(USAGE.summarize(empty)), USAGE.summarize(empty).weekClosed, USAGE.summarize(empty).weekOpen],
  [[], 0, 0]);
check('壞掉的紀錄（不是陣列）當成沒有，不拋錯',
  done(USAGE.summarize({ ...empty, outcomes: null })), []);

const records = [
  { ts: NOW - 1 * DAY, outcomeTag: 'judged_entered', tradeResult: 'profit_taken' },
  { ts: NOW - 2 * DAY, outcomeTag: 'judged_entered', tradeResult: 'pending' },
  { ts: NOW - 3 * DAY, outcomeTag: 'judged_entered' },
  { ts: NOW - 4 * DAY, outcomeTag: 'judged_stood_down', tradeResult: 'no_entry' },
  { ts: NOW - 5 * DAY, outcomeTag: 'abandoned_no_judgment' },
  { ts: NOW - 8 * DAY, outcomeTag: 'judged_entered', tradeResult: 'stopped_out' },
];
const full = USAGE.summarize({ onboarded: true, readingCount: 3, hasChannel: true, outcomes: records, nowMs: NOW });
check('五步都走到', done(full), ['baseline', 'scan', 'channel', 'judged', 'closed']);
check('🔴 最近 7 天：填完 2（有結果的進場 + 先不動），沒填 2（pending 與欄位不存在）',
  [full.weekClosed, full.weekOpen, full.weekJudged], [2, 2, 4]);
check('🔴 沒判定就離開的不算判定，也不算沒填', full.weekJudged, 4);
check('🔴 8 天前那筆不在最近 7 天裡',
  USAGE.summarize({ ...empty, outcomes: [records[5]] }).weekClosed, 0);
check('…但它仍然讓「填完一筆」打勾（那一步問的是有沒有過，不是這週）',
  done(USAGE.summarize({ ...empty, outcomes: [records[5]] })), ['judged', 'closed']);
check('只有待填的進場 → 做過判定 ✓、填完一筆 ✗',
  done(USAGE.summarize({ ...empty, outcomes: [records[1]] })), ['judged']);
check('時間在未來的紀錄不算進最近 7 天',
  USAGE.summarize({ ...empty, outcomes: [{ ts: NOW + DAY, outcomeTag: 'judged_stood_down' }] }).weekJudged, 0);

const text = USAGE.describe(full);
check('標題講兩個數字', text.title, '最近 7 天填完 2 筆決策，還有 2 筆沒填結果');
check('沒有待填時不提待填',
  USAGE.describe(USAGE.summarize(empty)).title, '最近 7 天填完 0 筆決策');
check('🔴 摘要文字裡沒有標的或結果（只有步驟與筆數）',
  /ES1|profit|stopped|達到目標|觸及/.test(text.title + text.detail), false);

// ── ② 畫面 ──────────────────────────────────────────────
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split('?')[0]);
  if (pathname === '/__blank') { res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>BLANK</title>'); return; }
  const resolved = resolveRoute(pathname);
  if ('redirect' in resolved) { res.writeHead(307, { location: resolved.redirect }).end(); return; }
  const file = join(repoRoot, resolved.path);
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const shotAt = process.argv.indexOf('--shot');
const shotPath = shotAt !== -1 ? process.argv[shotAt + 1] : null;

const browser = await (await getChromium()).launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());

await page.goto(`${base}/__blank`);
await page.evaluate(({ rows, now }) => {
  const shift = Date.now() - now; // 假資料的相對日數搬到「現在」
  localStorage.setItem('tenki.app.onboarded.v1', '1');
  localStorage.setItem('tenki.alert.channel', 'a'.repeat(64));
  localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify(rows.map((r) => ({ ...r, ts: r.ts + shift }))));
}, { rows: records, now: NOW });

await page.goto(`${base}/v3/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.showUsageSummary === 'function' && !!window.TENKI_USAGE);
await page.evaluate(() => window.showUsageSummary());
await page.waitForFunction(() => document.getElementById('labToast').classList.contains('show'));

console.log('── 畫面 ──');
check('頁面沒有 JS 錯誤', pageErrors, []);
check('Lab 有「使用摘要」那一格', await page.locator('#labUsageTile').count(), 1);
check('標題跟推導是同一句', await page.locator('#labToastTitle').textContent(), text.title);
const sub = await page.locator('#labToastSub').textContent();
check('細節列出五步：沒掃描過所以「掃描 —」，其餘打勾',
  sub.replace('（已複製）', ''), '建立基線 ✓ · 掃描 — · 接上快訊 ✓ · 做過判定 ✓ · 填完一筆 ✓');
const clip = await page.evaluate(() => navigator.clipboard.readText());
check('🔴 說「已複製」時剪貼簿裡真的有那段字',
  [sub.endsWith('（已複製）'), clip.includes(text.title)], [true, true]);

if (shotPath) {
  await page.waitForTimeout(3200); // splash 的 AUTO_DISMISS_AT = 2400ms
  await page.evaluate(() => window.goTab('lab'));
  await page.locator('#labUsageTile').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.showUsageSummary());
  await page.waitForTimeout(500);
  await page.screenshot({ path: shotPath });
}

await browser.close();
server.close();
console.log(failed === 0 ? '\n✅ preview-usage 全綠' : `\n❌ preview-usage ${failed} 條失敗`);
process.exit(failed === 0 ? 0 : 1);

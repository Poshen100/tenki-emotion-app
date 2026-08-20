/**
 * preview-decision-chain.mjs — 一整條決策鏈的迴歸驗證。
 *
 * TradingView 快訊 → /decision-alert/ 的決策入口 → **交棒** → /v3/ 跑起來的
 * 決策計時器 → 判定收束 → 回到 Session 歷史。
 *
 * 為什麼需要這支：在此之前這兩頁只共用一份 outcome store，**兩個計時器從來
 * 沒有見過面**，而快訊唯一通往 v3 的出口是 /v3/#session（歷史頁）。
 * 交棒是新接起來的那一段，也是最容易靜默壞掉的一段 ——
 * 它跨兩個頁面、跨 localStorage、還跨兩套 template id
 * （engine 的 `FBD` vs v6 的 `MANCINI_FBD`）。PLAYBOOK 記著那次
 * 「名稱、圖示、readiness、badge 四處全錯，而且沒有一處會報錯」。
 *
 * ⚠️ 遮擋一律用 elementFromPoint 問瀏覽器，且在 390x700 驗（矮的那個）。
 *
 * Run:  node scripts/preview-decision-chain.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
import { getChromium } from './lib/playwright.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const chromium = await getChromium();
const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

// ⚠️ 這幾條 rewrite 正式站是 vercel.json 在做，本地必須照抄（含 `(.*)` 那條）。
// 靜默 404 的測試環境比沒有測試更糟 —— 這個 repo 已經犯過兩次。
const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  if (clean.startsWith('/preview/')) clean = '/apps' + clean;
  if (clean === '/decision-alert' || clean === '/decision-alert/') clean = '/apps/preview/decision-alert.html';
  else if (clean.startsWith('/decision-alert/')) clean = '/apps/preview/' + clean.slice('/decision-alert/'.length);
  if (clean === '/v3' || clean === '/v3/') clean = '/apps/preview/v6/index.html';
  else if (clean.startsWith('/v3/')) clean = '/apps/preview/v6/' + clean.slice('/v3/'.length);
  let file = join(repoRoot, clean);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !file.startsWith(repoRoot)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) console.log(`   期待 ${JSON.stringify(expected)}，實際 ${JSON.stringify(actual)}`);
}
function checkTruthy(name, actual) {
  const ok = !!actual;
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) console.log(`   實際 ${JSON.stringify(actual)}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log('\n── 快訊 → 交棒 → 決策計時器 ──');

await page.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.evaluate(() => document.getElementById('btnSingle').click());
await page.waitForTimeout(900);
checkTruthy('決策入口面板打開了',
  await page.evaluate(() => document.getElementById('entrySheet').className.includes('show')));

await page.evaluate(() => document.getElementById('btnEngage').click());
await page.waitForTimeout(700);
// ⚠️ #tplList 的第一個 child 是 .tpl-head（表頭，沒有 listener）——
// 直接抓 children[0] 會點到表頭、什麼都不會發生（寫這支時實際踩到）。
const rows = await page.evaluate(() => document.querySelectorAll('#tplList .tpl-row').length);
checkTruthy(`模板清單有列可選（${rows}）`, rows > 0);
await page.evaluate(() => document.querySelector('#tplList .tpl-row').click());
await page.waitForTimeout(1500);

check('🔴 交棒導到跑起來的計時器，不是歷史頁', new URL(page.url()).hash, '#decision');
check('🔴 信物讀完就刪（否則下次開會再起跑一次同一筆）',
  await page.evaluate(() => localStorage.getItem('tenki.v6.handoff.v1')), null);

// 🔴 **不要**等 `!document.getElementById('tenki-splash')` —— splash 還沒被建立時
// 這個條件立刻為真，於是我們在頁面根本還沒跑起來的時候就往下讀（實際踩到：
// 讀到 running=false、sess=null，但同一支腳本後面卻讀得到 sess.originAlertId）。
// PLAYBOOK：**輪詢到已知的終值特徵**，不要輪詢到「某個東西還不存在」。
// ⚠️ 用 try/catch 包起來，等不到就報一條**說得出人話**的失敗。
// 裸的 waitForFunction 逾時會讓整支腳本以 Playwright 的 stack trace 死掉 ——
// 下一個人看到的是「TimeoutError」，而不是「交棒沒有起跑」。
// 實際踩到：把 template id 的翻譯拿掉之後，harness 只是逾時，一條紅字都沒有。
let started = true;
try {
  await page.waitForFunction(
    () => typeof sess !== 'undefined' && sess && !!sess.originAlertId,
    null, { timeout: 12000 },
  );
} catch (e) { started = false; }
checkTruthy('🔴 交棒真的把決策起跑了（等不到就是交棒斷了，往下的斷言都不用看）', started);
await page.waitForTimeout(1200);
const run = await page.evaluate(() => ({
  running: document.getElementById('fdcb').className.includes('state-running'),
  name: document.getElementById('fdcbName').textContent,
  time: document.getElementById('fdcbTime').textContent,
  watch: sess ? sess.watch : null,
  symbol: sess ? sess.symbol : null,
  origin: sess ? sess.originAlertId : null,
  anchor: sess ? sess.anchorPrice : null,
}));
check('計時器在跑', run.running, true);
check('🔴 快訊來的決策一律走守望（不看 Lab 開關）', run.watch, true);
check('守望不顯示總長', /\//.test(run.time), false);
checkTruthy(`底座顯示標的而不是模板名（${run.name}）`, run.name === run.symbol && !!run.symbol);
checkTruthy(`帶著來源快訊 id（${run.origin}）`, !!run.origin);
checkTruthy(`帶著關鍵價位（${run.anchor}）`, typeof run.anchor === 'number');

await page.evaluate(() => window.nextState());
await page.waitForTimeout(450);
const strip = await page.evaluate(() => {
  const a = document.getElementById('wjAnchor');
  return {
    hidden: a.hidden,
    text: a.textContent,
    lines: a.getClientRects().length,
    btns: [...document.querySelectorAll('#watchJudge .wj-btn')].map((b) => {
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { t: b.textContent, self: b.contains(hit) || b === hit, lines: b.getClientRects().length };
    }),
  };
});
check('關鍵價位出現在判定的那一刻', strip.hidden, false);
checkTruthy(`關鍵價位顯示得出來（${strip.text}）`, /\d/.test(strip.text));
check('關鍵價位只有 1 行', strip.lines, 1);
strip.btns.forEach((b) => {
  check(`判定鍵「${b.t}」沒被遮住`, b.self, true);
  check(`判定鍵「${b.t}」只有 1 行`, b.lines, 1);
});

await page.evaluate(() => window.judgeWatch('stood_down'));
await page.waitForTimeout(400);
const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')).slice(-1)[0]);
check('判定不成立寫成 judged_stood_down', rec.outcomeTag, 'judged_stood_down');
// 🔴 兩套 id 的翻譯：engine 的 FBD → v6 的 MANCINI_FBD。
// PLAYBOOK：凡是有 `|| fallback` 的欄位都要有一條斷言確認**沒有掉進 fallback**。
check('🔴 template id 翻對了（沒掉進 fallback）', rec.templateId, 'MANCINI_FBD');
checkTruthy('紀錄帶著來源快訊 id（join key）', !!rec.originAlertId);
check('紀錄認得自己是快訊決策', rec.source, 'alert');
check('紀錄標上語意版本', rec.judgmentSchema, 'structure_watch_v1');
checkTruthy('這筆算紀律', await page.evaluate((t) => window.TENKI_OUTCOME.isDisciplined(t), rec.outcomeTag));

// Session 頁：逐欄看那一列長什麼樣（PLAYBOOK：不要只看彙總數字）
const row = await page.evaluate(() => {
  window.goTab('session');
  const el = document.querySelector('#sessionList > *');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
});
checkTruthy(`Session 列畫得出來（${row}）`, !!row);
checkTruthy('Session 列說得出這是快訊決策', row && row.includes('快訊決策'));
check('🔴 Session 列不得出現否定的 readiness（守望沒有這個量）',
  /未達|未進入/.test(row || ''), false);

check('整條鏈走完沒有任何 page error', pageErrors, []);

await browser.close();
server.close();
console.log(failed === 0 ? '\n🟢 全綠' : `\n🔴 ${failed} 條失敗`);
process.exit(failed === 0 ? 0 : 1);

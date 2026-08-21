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
 * 第二段（2026-08-21）：規格 §8「Session 進行中收到新快訊 → 一律靜默接收」。
 * 那條**必須開兩個 page**（同一個 ctx 才共用 localStorage）—— 決策跑在 /v3/、
 * 快訊在 /decision-alert/，「不打斷」本質上就是跨頁的，單一 page 驗不到。
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
// ⚠️ 這條要問在「已經起跑」之後 —— 問太早會抓到頁面還沒讀它的那一瞬間（實際踩到）。
check('🔴 信物讀完就刪（否則下次開會再起跑一次同一筆）',
  await page.evaluate(() => localStorage.getItem('tenki.v6.handoff.v1')), null);
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

// ═══════════════════════════════════════════════
// §8：決策進行中收到新快訊 → 一律靜默接收
//
// 這一段**必須開第二個 page**（同一個 ctx，才共用 localStorage）：決策跑在
// /v3/，快訊在 /decision-alert/ ——「不打斷」這件事本質上就是跨頁的，
// 在單一 page 上無論怎麼寫都驗不到它。
// ═══════════════════════════════════════════════
const alertPage = await ctx.newPage();
alertPage.on('pageerror', (e) => pageErrors.push('[alert] ' + e.message));
await alertPage.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
await alertPage.waitForTimeout(2500);

const ACTIVE_KEY = 'tenki.v6.activeDecision.v1';
const readMarker = () => alertPage.evaluate(
  (k) => JSON.parse(localStorage.getItem(k)), ACTIVE_KEY);
const patchMarker = (patch) => alertPage.evaluate(([k, pt]) => {
  const m = JSON.parse(localStorage.getItem(k));
  Object.assign(m, pt);
  localStorage.setItem(k, JSON.stringify(m));
}, [ACTIVE_KEY, patch]);
const entryOpen = () => alertPage.evaluate(
  () => document.getElementById('entrySheet').className.includes('show'));

const mark0 = await readMarker();
checkTruthy('🔴 決策在跑時，/decision-alert/ 看得到跨頁標記', !!mark0);
check('標記帶著標的（同標的更新要靠它配對）', mark0 && mark0.symbol, 'ES1!');
check('標記一開始沒有同標的更新', mark0 && mark0.sameSymbolUpdates, 0);
checkTruthy('標記自帶到期時間（否則留下來會靜默吃掉每一則快訊）',
  mark0 && typeof mark0.expiresAtMs === 'number' && mark0.expiresAtMs > Date.now());

// ── 同標的後續觸發 → 安靜接收，不彈面板 ──
await alertPage.evaluate(() => document.getElementById('btnSingle').click());
await alertPage.waitForTimeout(600);
check('🔴 決策進行中的同標的快訊**不得**彈出決策入口面板', await entryOpen(), false);
checkTruthy('安靜接收有留下看得見的痕跡（靜默區 chip）',
  await alertPage.evaluate(() => document.getElementById('silentArea').children.length > 0));
const mark1 = await readMarker();
check('同標的後續觸發被記下來了', mark1 && mark1.sameSymbolUpdates, 1);

// ── 不同標的 → 一樣不得打斷（§8 說的是「一律」）──
await patchMarker({ symbol: 'NQ1!' });
await alertPage.evaluate(() => document.getElementById('btnSingle').click());
await alertPage.waitForTimeout(600);
check('🔴 決策進行中的**別的**標的快訊也不得彈出面板', await entryOpen(), false);
check('別的標的不算「同標的更新」',
  (await readMarker()).sameSymbolUpdates, 1);
await patchMarker({ symbol: 'ES1!' });

// ── 🔴 過期的標記**不得**吃掉快訊 ──
// 這條守的是這個功能最危險的失敗模式：標記留下來沒被清掉（/v3/ 的分頁被殺、
// 瀏覽器崩潰、使用者直接關掉那一頁）→ 這一頁從此靜默吃掉每一則快訊，
// 而且完全沒有跡象，使用者只會覺得「快訊壞了」。那比沒有這個功能糟糕得多。
const liveUntil = (await readMarker()).expiresAtMs;
await patchMarker({ expiresAtMs: Date.now() - 1000 });
await alertPage.evaluate(() => document.getElementById('btnSingle').click());
await alertPage.waitForTimeout(700);
check('🔴 標記過期之後，快訊必須照常彈出決策入口（不得永遠靜音）',
  await entryOpen(), true);
await alertPage.evaluate(() => document.getElementById('btnDismiss').click());
await patchMarker({ expiresAtMs: liveUntil });
await alertPage.close();
await page.bringToFront();
await page.waitForTimeout(300);


// 🔴 遮擋斷言必須等 splash 真的離開 —— 否則量到的是「被 splash 蓋住」
// （實際踩到：命中 tenki-splash，y=530/700）。
// ⚠️ 順序很重要：**先**等到「決策已起跑」這個正向訊號（證明頁面真的跑起來、
// splash 已經被建立），**才**等它消失。反過來寫就會踩到本檔開頭那個坑 ——
// splash 還沒被建立時 `!splash` 立刻為真。兩個方向的競態都要擋。
await page.waitForFunction(() => !document.getElementById('tenki-splash'), null, { timeout: 15000 });
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
      return {
        t: b.textContent, self: b.contains(hit) || b === hit,
        lines: b.getClientRects().length,
        // 遮擋失敗時要說得出「被誰蓋住」——「false」本身不夠人看懂。
        hit: hit ? (hit.id || hit.className || hit.tagName) : 'null(點在視窗外?)',
        cy: Math.round(r.top + r.height / 2),
        winH: window.innerHeight,
      };
    }),
  };
});
check('關鍵價位出現在判定的那一刻', strip.hidden, false);
checkTruthy(`關鍵價位顯示得出來（${strip.text}）`, /\d/.test(strip.text));
check('關鍵價位只有 1 行', strip.lines, 1);
strip.btns.forEach((b) => {
  check(`判定鍵「${b.t}」沒被遮住（命中 ${b.hit}，y=${b.cy}/${b.winH}）`, b.self, true);
  check(`判定鍵「${b.t}」只有 1 行`, b.lines, 1);
});

await page.evaluate(() => window.judgeWatch('stood_down'));
// 判定完會導回 /decision-alert/#result 看收束頁 —— 等它真的到（輪詢終值特徵，
// 不是輪詢「某個東西還不存在」）。
let returned = true;
try {
  await page.waitForFunction(
    () => location.pathname.indexOf('/decision-alert') === 0
      && document.getElementById('resultSheet')
      && document.getElementById('resultSheet').className.indexOf('show') !== -1,
    null, { timeout: 12000 },
  );
} catch (e) { returned = false; }
checkTruthy('🔴 判定完回到 /decision-alert/ 並開出收束頁', returned);

const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')).slice(-1)[0]);
check('判定不成立寫成 judged_stood_down', rec.outcomeTag, 'judged_stood_down');
// 🔴 兩套 id 的翻譯：engine 的 FBD → v6 的 MANCINI_FBD。
// PLAYBOOK：凡是有 `|| fallback` 的欄位都要有一條斷言確認**沒有掉進 fallback**。
check('🔴 template id 翻對了（沒掉進 fallback）', rec.templateId, 'MANCINI_FBD');
checkTruthy('紀錄帶著來源快訊 id（join key）', !!rec.originAlertId);
// §8：決策期間收到的同標的快訊，數字要真的走到紀錄裡（不是 null、更不是 0）。
check('🔴 同標的更新的真數字進了紀錄', rec.sameSymbolUpdates, 1);
check('紀錄認得自己是快訊決策', rec.source, 'alert');
check('紀錄標上語意版本', rec.judgmentSchema, 'structure_watch_v1');
checkTruthy('這筆算紀律', await page.evaluate((t) => window.TENKI_OUTCOME.isDisciplined(t), rec.outcomeTag));

// 🔴 一筆決策只能有一筆紀錄。
// 收束頁的收尾本來會 push 一筆，而計時器那邊已經寫過了 —— 直接重用會**存兩份**，
// 紀律統計立刻失真。這是整段回程最容易靜默壞掉的地方。
//
// ⚠️ **一定要真的按下收尾鍵再數。** 第一版只是「開了收束頁就去數」——
// 而 finalizeResult 只有在使用者按下去才跑，所以把就地更新整個拿掉、
// 讓它每次都 push，那條斷言**照樣綠**。是一條死斷言，實測抓到的。
// 順便選一個反思晶片，確保 contextTag 這條真的會走到寫入。
await page.evaluate(() => {
  const chip = document.querySelector('#resultReflect .result-chip');
  if (chip) chip.click();
});
await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById('btnResultSave').click());
await page.waitForTimeout(400);
const store = await page.evaluate(() => JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')) || []);
checkTruthy('反思晶片補上的 contextTag 有寫進那一筆',
  store.length === 1 && !!store[0].contextTag);
check('🔴 一筆決策只留一筆紀錄（回程不得再寫一次）', store.length, 1);
check('🔴 回程票讀完就刪', await page.evaluate(() => localStorage.getItem('tenki.alert.return.v1')), null);
// 🔴 決策結束了，「進行中」標記一定要消失 —— 留著就會靜默吃掉之後每一則快訊。
// ⚠️ 這一筆是快訊決策，收束時會 location.href 回程；標記必須在導頁**之前**清掉，
// 導頁之後 /v3/ 那一頁就沒有機會再清了。
check('🔴 決策收束後「進行中」標記已清除',
  await page.evaluate((k) => localStorage.getItem(k), 'tenki.v6.activeDecision.v1'), null);

// 收束頁上的事實要對得起紀錄
const sheet = await page.evaluate(() => ({
  head: (document.getElementById('resultHead') || {}).textContent,
  outcome: (document.getElementById('resultOutcome') || {}).textContent,
  recap: (document.getElementById('resultRecapList') || {}).textContent,
}));
checkTruthy(`收束頁標題帶著標的（${sheet.head}）`, (sheet.head || '').includes('ES1!'));
checkTruthy(`收束頁說得出判定（${sheet.outcome}）`, !!(sheet.outcome || '').trim());
// 同標的更新現在有真數字了（§8 的跨頁標記記的），收束頁要說得出來。
// ⚠️ 但「0 次」仍然是紅線：那是「有在數而且真的沒有」與「不知道」被混成同一句話
// 的老傷 —— 不知道時 renderRecap 必須整列不出現。
checkTruthy('🔴 收束頁印出真的同標的更新次數（不是留白、也不是 0）',
  /同標的更新：1\s*次/.test(await page.textContent('#resultRecapList')));
check('🔴 收束頁不得印「同標的更新：0 次」（不知道就別說否定）',
  /同標的更新：0\s*次/.test(await page.textContent('#resultRecapList')), false);

checkTruthy('收束頁的 recap 說得出離開次數（v6 記的欄位接上了）',
  /離開|沒有離開/.test(sheet.recap || ''));

// Session 頁：逐欄看那一列長什麼樣（PLAYBOOK：不要只看彙總數字）
await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => document.querySelector('#sessionList > *') !== null, null, { timeout: 15000 },
).catch(() => {});
const row = await page.evaluate(() => {
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

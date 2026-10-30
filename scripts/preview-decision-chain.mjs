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
// 🔴 交棒**之前**把快訊到達時刻從畫面上抄下來 —— `#tplStatus` 最後那段印的是
// `new Date(alert.receivedAt).toTimeString()`。這是一個**跟交棒信物無關的來源**：
// 下面那條等式才問得出「信物帶的是快訊到達時刻，不是交棒時刻」。
// 拿 `Date.now()` 去比只能問出「是個時間」，而那是 `Date.now()` 也會過的斷言。
const alertClock = await page.evaluate(() => {
  const el = document.getElementById('tplStatus');
  const spans = el ? el.querySelectorAll('span') : [];
  return spans.length ? spans[spans.length - 1].textContent : null;
});
checkTruthy(`交棒前畫面上有快訊到達時刻（${alertClock}）`, /^\d{2}:\d{2}:\d{2}$/.test(alertClock || ''));

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

// ── alertAt：規格 §1.2 的第一個時間戳 ──
// 🔴 這兩條**故意問不同的事**，不是同一條寫兩次：
//   1. 等式：帶過來的是不是「快訊到達」那個數字（對照畫面上的獨立來源）。
//   2. 間隔：它有沒有比交棒時刻**明顯早**。等式單獨成立還不夠 —— 若 makeAlert
//      哪天改成在交棒當下才蓋 receivedAt，等式照樣綠，而「審視」會恆等於 0。
const hop = await page.evaluate(() => ({
  alertAt: sess ? sess.alertAt : null,
  started: sess ? sess.startedAtMs : null,
  clock: (sess && typeof sess.alertAt === 'number')
    ? new Date(sess.alertAt).toTimeString().slice(0, 8) : null,
  snapAlertAt: (JSON.parse(localStorage.getItem('tenki.v6.activeDecision.v1')) || {}).alertAt,
}));
check('🔴 交棒帶過來的是快訊到達時刻，不是交棒時刻（對照畫面上的時間）',
  hop.clock, alertClock);
// 🔴 門檻要從**保證的下限**訂，不是從實測值往下湊。我第一版寫「900+700+1500」
// 並放 2000 —— 那個算式是錯的：1500 那段等在交棒**之後**。真正夾在
// 「快訊產生」與「交棒」之間的固定等待只有 900+700 ＝ 1600 ms（加上兩次
// evaluate 來回，實測 2474）。所以 2000 只有不到 500 ms 的餘裕，機器快一點
// 就會無辜變紅。1200 在保證下限之下，而反向驗證實測那個 bug（交棒蓋成
// `Date.now()`）給的是 **623 ms** —— 不是 0，因為交棒到起跑本身要幾百毫秒。
// 1200 夾在 623 與 1600 中間，兩側都有餘裕，鑑別力一點沒少。
checkTruthy(`🔴 到達時刻比交棒時刻早（相隔 ${hop.started - hop.alertAt} ms）`,
  typeof hop.alertAt === 'number' && hop.started - hop.alertAt >= 1200);
// 下單要離開 App，iOS 會把整頁清掉 —— 只活在 `sess` 裡的話回來就沒有了。
check('🔴 alertAt 落地當下就寫進快照（不是只活在記憶體）', hop.snapAlertAt, hop.alertAt);

// ═══════════════════════════════════════════════
// 下完單回來，決策還在（founder 2026-08-21 的實體動線）
//
// 「進入決策 → 跳回桌面 → 開交易 App 下單 → 回 TENKI Core」。
// iOS 會把 standalone web app 清出記憶體，回來時整頁重新載入 ——
// 這裡用 page.reload() 模擬那件事的本質：**這一頁的記憶體全沒了**。
// 沒有 resume 的話，重載之後 sess 是 null，整筆決策連同標記一起蒸發。
// ═══════════════════════════════════════════════
await page.evaluate(() => window.logEvent());          // 先留一個標記，看它活不活得過重載
await page.waitForTimeout(500);
const preReload = await page.evaluate((k) => ({
  marks: sess.marks, started: sess.startedAtMs, elapsed,
  snapEvents: (JSON.parse(localStorage.getItem(k)) || {}).events,
}), 'tenki.v6.activeDecision.v1');
checkTruthy(`重載前有 1 個標記（${preReload.marks}）`, preReload.marks === 1);
// 🔴 這一條要**當場**問快照，不能只靠下面的「活過重載」——
// `page.reload()` 之前瀏覽器會先送一次 visibilitychange → hidden，而那個 handler
// 也會同步快照。也就是說：把 logEvent 裡的同步整個拿掉，「活過重載」照樣綠。
// 實際踩到（反向驗證時發現它是死的）。要問的是「落地當下就寫進去了嗎」。
checkTruthy(`🔴 標記落地當下就寫進快照（${(preReload.snapEvents || []).length} 個節點）`,
  Array.isArray(preReload.snapEvents) && preReload.snapEvents.length === 1);

await page.waitForTimeout(2200);                       // 讓牆鐘往前走，才驗得出「沒有倒退」
await page.reload({ waitUntil: 'domcontentloaded' });
let resumed = true;
try {
  await page.waitForFunction(
    () => typeof sess !== 'undefined' && sess && !!sess.startedAtMs,
    null, { timeout: 12000 },
  );
} catch (e) { resumed = false; }
checkTruthy('🔴 重新載入之後決策還在（下完單回來不能是一片空白）', resumed);

const post = await page.evaluate(() => ({
  running: document.getElementById('fdcb').className.includes('state-running'),
  dur: document.getElementById('fdcbDur').textContent.trim(),
  setting: watchMode(currentTmpl),
  marks: sess ? sess.marks : null,
  started: sess ? sess.startedAtMs : null,
  watch: sess ? sess.watch : null,
  symbol: sess ? sess.symbol : null,
  origin: sess ? sess.originAlertId : null,
  anchor: sess ? sess.anchorPrice : null,
  alertAt: sess ? sess.alertAt : null,
  elapsed,
}));
check('計時器接著跑，不是回到 idle', post.running, true);
check('🔴 起跑時間一模一樣（牆鐘的唯一來源不能被重載換掉）', post.started, preReload.started);
checkTruthy(`🔴 時鐘沒有倒退（${preReload.elapsed} → ${post.elapsed}）`, post.elapsed > preReload.elapsed);
check('🔴 標記活過重載（events 是快照的一部分）', post.marks, 1);
check('守望語意跟著回來', post.watch, true);
// 🔴 接回來之後，底座左欄講的必須是**這一次的界線**（守望上限），不是模板的倒數時長。
// 這條沒有跟上面那條重複：`sess.watch` 對了，畫面還是可能印錯 ——
// setState('running') 已經跑過 renderTmplChip()，而 sess.watch 是在那之後才接回來的
// （acceptHandoff 為了同一個理由補畫過一次，resume 這條路第十五輪才補上）。
// ⚠️ 這支 harness 從頭到尾**沒有碰決策紀律開關**（預設關），所以 watchMode() 是 false
// —— 正是「設定與事實分岔」的那條路，用設定去代表事實在這裡一定會印成 3:00。
check('resume 這條路上設定與事實故意不一致（前提）', post.setting, false);
checkTruthy(`🔴 接回來的底座左欄印的是守望上限，不是模板時長（現在是「${post.dur}」）`,
  /上限/.test(post.dur) && !post.dur.startsWith('3:00'));
check('標的跟著回來', post.symbol, 'ES1!');
checkTruthy('來源快訊 id 跟著回來（join key 不能斷）', !!post.origin);
checkTruthy('關鍵價位跟著回來', typeof post.anchor === 'number');
check('🔴 快訊到達時刻活過重載（這條斷了，下完單回來那一筆的「審視」永遠是空的）',
  post.alertAt, hop.alertAt);

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

// ── 決策進行中橫幅：這一頁要說得出「還有一筆在跑」──
// ⚠️ 這幾條要問在標記還活著的時候。下面「過期的標記」那一段會讓橫幅收起來
// （而且會停掉它的每秒重繪），順序反過來就會量到收起來的狀態（實際踩到）。
const bar = await alertPage.evaluate(() => {
  const b = document.getElementById('timerBar');
  return {
    shown: b.className.includes('show'),
    label: document.getElementById('timerLabel').textContent,
    clock: document.getElementById('timerClock').textContent,
    back: document.getElementById('timerBack').textContent,
    // 🔴 判定只有一份，在 /v3/ —— 這一頁不得再長出第二組判定鍵。
    judgeBtns: document.querySelectorAll('#timerBar button').length,
    update: document.getElementById('timerUpdate').className.includes('show'),
  };
});
check('🔴 決策進行中時，快訊頁要浮出回程橫幅', bar.shown, true);
checkTruthy(`橫幅說得出是哪一筆（${bar.label}）`, bar.label.includes('ES1!'));
checkTruthy(`橫幅的時鐘在走（${bar.clock}）`, /^\d\d:\d\d$/.test(bar.clock) && bar.clock !== '00:00');
checkTruthy(`橫幅說得出怎麼回去（${bar.back}）`, /回到計時器/.test(bar.back));
check('🔴 橫幅上不得有第二份判定 UI', bar.judgeBtns, 0);
check('同標的更新的事實行浮在橫幅下（規格 §8 原本的形狀）', bar.update, true);

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
// ═══════════════════════════════════════════════
// §8 的**真實動線**：PWA 被清出記憶體 → 冷開 start_url → 收到快訊
//
// 🔴 上面那一段驗的是「兩頁同時開著」，但 PWA 實際走的**不是**那條路：
// `start_url` 是 `/decision-alert/`，所以 iOS 把 App 清掉之後，使用者點開
// 看到的是一個**冷開的快訊頁**，而 `/v3/` 那一頁已經不存在了。
// 那條路上「決策還在跑」完全靠 localStorage 的標記獨自撐著 ——
// 規則有了，但先前沒有一條斷言走過這一條路。
//
// （founder 2026-09-24 回報：在主畫面的 TENKI 裡，決策跑著卻看到面板彈出來。
//  這一段就是為了把那條路釘住而加的；實測這條路徑本身是對的，見下。）
// ═══════════════════════════════════════════════
{
  const relaunch = await ctx.newPage();
  relaunch.on('pageerror', (e) => pageErrors.push('[relaunch] ' + e.message));
  await relaunch.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
  await relaunch.waitForTimeout(2200);

  const before = await relaunch.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)), ACTIVE_KEY);
  const marker = before;
  checkTruthy('🔴 冷開之後標記還在（它是這條路上唯一的依據）',
    !!marker && marker.expiresAtMs > Date.now());

  const open = () => relaunch.evaluate(
    () => document.getElementById('entrySheet').className.includes('show'));
  await relaunch.evaluate(() => document.getElementById('btnSingle').click());
  await relaunch.waitForTimeout(700);
  check('🔴 冷開的快訊頁，決策進行中仍然不得彈出面板', await open(), false);

  // 對照：標記過期 → 必須照常彈（否則這條斷言只是「面板永遠不開」）
  await relaunch.evaluate((k) => {
    const m = JSON.parse(localStorage.getItem(k));
    m.expiresAtMs = Date.now() - 1000;
    localStorage.setItem(k, JSON.stringify(m));
  }, ACTIVE_KEY);
  await relaunch.evaluate(() => document.getElementById('btnSingle').click());
  await relaunch.waitForTimeout(700);
  check('🔴 而標記過期之後照常彈（證明上一條不是「永遠不開」）', await open(), true);
  await relaunch.evaluate(() => document.getElementById('btnDismiss').click());
  // 🔴 把標記還原成進來時的樣子 —— 這一段是**插隊**進整條鏈的，
  //    不還原的話後面那條「收束頁印『同標的更新：1 次』」會被我多按的兩下打壞。
  await relaunch.evaluate(([k, n, t]) => {
    const m = JSON.parse(localStorage.getItem(k));
    m.sameSymbolUpdates = n;
    m.expiresAtMs = t;
    localStorage.setItem(k, JSON.stringify(m));
  }, [ACTIVE_KEY, before.sameSymbolUpdates, before.expiresAtMs]);
  await relaunch.close();
}


// ── 點橫幅回到那一筆決策 ──
// 先重新載入這一頁 —— 那正是 iOS 把 App 換回前景時實際會發生的事，
// 也順便證明橫幅在「一開頁就有決策在跑」的情況下自己會出現。
await alertPage.reload({ waitUntil: 'domcontentloaded' });
await alertPage.waitForTimeout(2200);
check('🔴 一開頁就有決策在跑時，橫幅自己會出現',
  await alertPage.evaluate(() => document.getElementById('timerBar').className.includes('show')), true);
await alertPage.evaluate(() => document.getElementById('timerBar').click());
await alertPage.waitForTimeout(1500);
check('🔴 點橫幅真的回到跑著的決策', new URL(alertPage.url()).pathname.indexOf('/v3'), 0);
let barResumed = true;
try {
  await alertPage.waitForFunction(
    () => typeof sess !== 'undefined' && sess && !!sess.startedAtMs, null, { timeout: 12000 },
  );
} catch (e) { barResumed = false; }
checkTruthy('🔴 從橫幅回去的那一頁也接得回決策（信物早就被刪了，走的是 resume）', barResumed);

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
// ── 結果軸（規格 §9b ①）──
// 🔴 「判定不成立」與「沒有進場」描述的是同一件事 —— 結果要**推導**出來，
// 不得再問一次。兩個都問會讓使用者答出「判定不成立」＋「達到目標」這種
// 自相矛盾、而且會污染節奏計數的紀錄。
check('🔴 判定不成立 → tradeResult 推導成 no_entry', rec.tradeResult, 'no_entry');
check('🔴 而且這條路不問結果（區塊隱藏）',
  await page.evaluate(() => document.getElementById('resultTradeWrap').hasAttribute('hidden')), true);
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
//
// 🔴 這兩條原本是拿整段 textContent 比 `/同標的更新：1 次/`。2026-09-05 收束頁
// 改成欄位表（標籤與值各自一個 span，中間沒有冒號了），第一條當場紅 ——
// **而第二條變成永遠綠的死斷言**：冒號不存在，`同標的更新：0 次` 再也不可能 match，
// 就算真的印出 0 次它也抓不到。一條紅的旁邊常常站著一條默默失效的，要一起看。
// 改成問**結構**（依標籤找到那一列，讀它的值），呈現再變也不會誤判。
const sameSymRow = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#resultRecapList .result-recap-row')]
    .find((r) => r.querySelector('.rc-label')?.textContent === '同標的更新');
  return row ? (row.querySelector('.rc-value')?.textContent ?? '').trim() : null;
});
check('🔴 收束頁印出真的同標的更新次數（不是留白、也不是 0）', sameSymRow, '1 次');
check('🔴 收束頁不得印「同標的更新：0 次」（不知道就別說否定）', sameSymRow === '0 次', false);

checkTruthy('收束頁的 recap 說得出離開次數（v6 記的欄位接上了）',
  /離開|沒有離開/.test(sheet.recap || ''));

// 🔴 收束頁不得出現任何**內部 id**。
// 2026-09-09 founder 實走截圖：標題與軌跡表都印著 `ES1! · MANCINI_FBD` ——
// 而同一筆紀錄在 /v3/ 的 Session 詳情印的是 `ES1! · Mancini FBD`。
// 根因：回程票那條路 `tplName: rec.templateId`，**拿 id 當名字**。
//
// ⚠️ 這一頁本來就有一條「MODE_2 不得出現在任何 user-facing 文字裡」，
// 但它只掃**模板選單**。同一條紅線在收束頁沒有人守，所以漏了一年。
// 判準改成**形狀**而不是列舉某幾個 id：內部 key 一律是 `大寫_大寫`，
// 顯示名一律不是。這樣新增模板不用回來改斷言。
const sheetText = await page.evaluate(() => {
  const n = document.getElementById('resultSheet');
  return n ? n.innerText : '';
});
const leakedIds = (sheetText.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g) || []);
check('🔴 收束頁不得出現內部 template id（大寫_大寫）', leakedIds, []);
checkTruthy(`收束頁真的有字可掃（${sheetText.length} 字，0 就是死斷言）`, sheetText.length > 40);
checkTruthy(`收束頁印的是顯示名（${sheet.head}）`, /Mancini FBD/.test(sheet.head || ''));

// 🔴 可動層琥珀在收束頁上只准給**會改變狀態**的東西。
// founder 2026-09-08 把規則從「可點就上琥珀」收窄成「只給會改變狀態的，導航不算」，
// 但那一輪只掃了 Lab。2026-09-09 實走截圖顯示這一頁**剛好相反**：
//   `查看決策紀錄`（導航）實心琥珀、`紀律近況 › `（導航）琥珀字，
//   而三顆自評晶片（**會把 contextTag 寫進這一筆紀錄**）是中性／青。
//
// ⚠️ 「會不會改變狀態」機器判斷不出來，所以這條不假裝偵測 ——
// 它要求**把決定寫成名單**：穿琥珀的節點集合必須恰好等於下面列舉的那些。
// 新增一個琥珀用法就會紅，逼下一個人回來說明它改變了什麼。
// 這比一條「只出現在可點元素上」誠實：那條在這一頁全程綠著，
// 因為兩顆導航按鈕當然都可點。
const amberNodes = await page.evaluate(() => {
  // ⚠️ 比對 **RGB 三元組**，不是整個字串：外框式的琥珀寫成
  // `rgba(255,160,40,0.32)`，填色式寫成 `rgb(255,160,40)`。
  // 第一版拿整串比，於是只抓到 1 個節點 —— 那種漏抓會讓斷言看起來很嚴格、
  // 實際上只守到填色那一半。
  const isAmber = (v) => {
    const m = (v || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    if (+m[1] !== 255 || +m[2] !== 160 || +m[3] !== 40) return false;
    // 全透明的宣告不算「畫面上有琥珀」
    const a = (v.match(/,\s*([\d.]+)\s*\)$/) || [])[1];
    return a === undefined || Number(a) > 0.05;
  };
  const out = [];
  document.querySelectorAll('#resultSheet *').forEach((n) => {
    const cs = getComputedStyle(n);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    const r = n.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if ([cs.color, cs.backgroundColor, cs.borderTopColor].some(isAmber)) {
      // 只取第一個 class token —— 選中態是 `result-chip sel`，
      // 不正規化的話名單就要同時列舉兩種寫法，那是在守樣式而不是守規則。
      out.push(String(n.className || n.id || n.tagName).split(' ')[0]);
    }
  });
  return out;
});
// 收束頁上唯一會改變狀態的是三顆自評晶片（寫 contextTag）。
check('🔴 收束頁的琥珀只給會改變狀態的（三顆自評晶片）',
  [...new Set(amberNodes)].sort(), ['result-chip']);
checkTruthy(`真的掃到琥珀節點（${amberNodes.length} 個，0 個就是死斷言）`, amberNodes.length >= 3);

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

// ═══════════════════════════════════════════════
// 結果三選一（規格 §9b）—— 走「判定成立並進場」那條路
//
// 🔴 為什麼另開一段而不是在上面那條鏈裡做：上面走的是 `stood_down`，
// 那條路**刻意不問結果**。要驗晶片就必須有一筆 `judged_entered`。
// 這裡種一筆紀錄 + 一張回程票，然後走**真實入口**
// （acceptReturnTicket → openResult → saveOutcome），不是直接呼叫內部函式。
//
// 🔴 最關鍵的是「取消選取回到 pending 而不是 null」那條：null 會讓這筆交易
// 從當日計數裡整個消失（額度永遠用不完、面板照樣彈），而畫面上完全看不出來。
// ═══════════════════════════════════════════════
console.log('\n── 結果三選一（進場路徑）──');
{
  const ENTERED_TS = Date.now() - 5 * 60 * 1000;
  const SEED = {
    symbol: 'ES1!', templateId: 'MANCINI_FBD', outcomeTag: 'judged_entered',
    contextTag: null, judgmentSchema: 'structure_watch_v1',
    awayCount: 0, awayMs: 0, durationSec: 420, ts: ENTERED_TS, source: 'alert',
  };

  /**
   * 開一次收束頁（判定成立並進場那一筆）。
   *
   * ⚠️ 每一輪都**先回 /v3/ 再跨頁進來** —— 兩個理由，兩個都踩過：
   *   1. `goto` 到「只有 hash 不同」或「完全相同」的 URL 是 same-document
   *      navigation，文件不會重載 → 回程票不會被消費 → 晶片一顆都不長，
   *      而畫面看起來沒壞。
   *   2. 反過來，已經跨頁載入之後再補一個 `reload()` 也會壞：票在第一次載入
   *      就被消費掉了（讀完即刪），重載等於開一張沒有票的收束頁。
   * 先離開再回來就沒有這兩個坑，而且這正是真實動線（使用者從 /v3/ 判定完回來）。
   */
  async function openEnteredResult(seedStore) {
    await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.evaluate(({ store, ts }) => {
      if (store) localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify(store));
      localStorage.setItem('tenki.alert.return.v1', JSON.stringify({ ts, at: Date.now() }));
    }, { store: seedStore || null, ts: ENTERED_TS });
    await page.goto(`${base}/decision-alert/#result`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
  }

  await openEnteredResult([SEED]);

  const shown = await page.evaluate(() => ({
    // 🔴 問「有沒有 hidden」是假綠：這個區塊在 HTML 裡本來就沒有 hidden 屬性，
    //    所以 openResult 根本沒跑時它照樣讀成「可見」。改問真正的證據 ——
    //    收束頁有沒有開，以及晶片有沒有長出來。
    sheetOpen: document.getElementById('resultSheet').className.includes('show')
      || document.getElementById('resultSheet').className.includes('reveal'),
    hidden: document.getElementById('resultTradeWrap').hasAttribute('hidden'),
    chips: [...document.querySelectorAll('#resultTrade .result-chip')].map((c) => c.textContent),
    selected: document.querySelectorAll('#resultTrade .result-chip.sel').length,
  }));
  checkTruthy('收束頁真的開起來了（0 顆晶片就是死斷言）', shown.sheetOpen && shown.chips.length === 3);
  check('🔴 判定成立並進場 → 才問結果', shown.hidden, false);
  check('三選一，而且用的是合規文案（不得出現自然的交易詞彙）',
    shown.chips, ['達到目標', '觸及保護價', '打平出場']);
  // 🔴 預設不選取 ＝「還沒有結果」。逼使用者選一個會拿到捏造的資料，
  // 而捏造的資料比沒有更糟（CLAUDE.md：量不到就回 null，不要填合理的預設值）。
  check('🔴 預設一顆都不選（「還沒有結果」是正常狀態）', shown.selected, 0);

  // ── ✅ founder 2026-10-29「不要 modal」那條裁決的形狀守門 ──
  // 🔴 問**形狀**不問 id（PLAYBOOK：按 id 問的守門，換個 id 就繞過去）。
  //    這一組不驗任何新行為 —— 它驗的是「這張頁沒有變成一個必須先答的層」，
  //    而那是上面「預設不選 → pending」那條之所以有意義的前提。
  const noModal = await page.evaluate(() => {
    const sheet = document.getElementById('resultSheet');
    const close = document.getElementById('btnResultSave');
    const cs = getComputedStyle(close);
    return {
      // 自己是不是 modal，以及裡面有沒有長出一個 modal
      dialogish: (sheet.matches('[aria-modal], [role="dialog"], [role="alertdialog"]') ? 1 : 0)
        + sheet.querySelectorAll('[aria-modal], [role="dialog"], [role="alertdialog"]').length,
      // 「可以不答就走」—— 關閉鍵在一顆都沒選的狀態下必須真的按得到。
      // 三個都要問：disabled 屬性、aria-disabled、以及被 CSS 擋掉點擊。
      closeBlocked: close.disabled
        || close.getAttribute('aria-disabled') === 'true'
        || cs.pointerEvents === 'none',
      // 沒有這句註記，三顆晶片讀起來就是必填 —— 量的是**使用者讀到的字**，
      // 不是某個節點存在（同 PLAYBOOK 對文案守門的規則）。
      saysOptional: /還沒有結果也可以/.test(
        document.getElementById('resultTradeWrap').textContent),
    };
  });
  check('🔴 收束頁不是、也不含任何 modal（aria-modal / role=dialog）', noModal.dialogish, 0);
  check('🔴 一顆都沒選時「關閉」真的按得到（可以不答就走）', noModal.closeBlocked, false);
  check('🔴 文案自己說得出「還沒有結果也可以」', noModal.saysOptional, true);

  // 🔴 一顆都不選就收尾 → 值必須是 `pending`，**不是 null**。
  // null 會讓這筆交易從當日計數裡整個消失：額度永遠用不完、面板照樣彈，
  // 而畫面上完全看不出異狀。這是整個階段 A 最重要的一條。
  await page.evaluate(() => document.getElementById('btnResultSave').click());
  await page.waitForTimeout(400);
  const untouched = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'))[0]);
  check('🔴 一顆都不選 → tradeResult 是 pending（不是 null）', untouched.tradeResult, 'pending');

  // 選一顆 → 值要落地（走的是 saveOutcome 的**就地更新**分支）。
  await openEnteredResult();
  await page.evaluate(() => document.querySelectorAll('#resultTrade .result-chip')[1].click());
  await page.waitForTimeout(150);
  check('選中的是第二顆', await page.evaluate(() =>
    [...document.querySelectorAll('#resultTrade .result-chip')].findIndex((c) => c.classList.contains('sel'))), 1);
  await page.evaluate(() => document.getElementById('btnResultSave').click());
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')));
  // 🔴 這一條守的是 saveOutcome 的就地更新分支：收束頁只補「這一頁真的產生的
  // 欄位」，漏掉 tradeResult 的話使用者選的結果會被靜默丟掉 —— 而晶片仍然亮著、
  // 存檔仍然成功，畫面上完全正常。
  check('🔴 選的結果有寫進那一筆（就地更新不得漏欄位）', saved[0].tradeResult, 'stopped_out');
  check('一筆決策仍然只留一筆紀錄', saved.length, 1);
  checkTruthy('結果沒有改變紀律判定', await page.evaluate((t) =>
    window.TENKI_OUTCOME.isDisciplined(t), saved[0].outcomeTag));
  check('就地更新的是同一筆（ts 沒變 ＝ 沒有被 push 成第二筆）', saved[0].ts, ENTERED_TS);

  // 再次點同一顆 ＝ 取消選取 → 必須回到 pending。
  await openEnteredResult();
  await page.evaluate(() => document.querySelectorAll('#resultTrade .result-chip')[0].click());
  await page.waitForTimeout(120);
  await page.evaluate(() => document.querySelectorAll('#resultTrade .result-chip')[0].click());
  await page.waitForTimeout(120);
  await page.evaluate(() => document.getElementById('btnResultSave').click());
  await page.waitForTimeout(400);
  const cleared = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'))[0]);
  check('🔴 取消選取回到 pending，不是 null（交易發生過，只是結果未知）',
    cleared.tradeResult, 'pending');

  // ── 「我剛下單了」（規格 §7 第 3 項）──
  //
  // 🔴 在此之前，一筆**從一開始就判定成立並進場**的紀錄沒有任何路徑拿得到
  //    進場時刻（Session 詳情那題只問「後來才改判定」那條路）。這組守那個洞。
  // 🔴 最要緊的一條是「它真的寫進 store」—— `saveOutcome` 的就地更新分支
  //    已經靜默丟掉過一個欄位（tradeResult，註解自己記著），而丟掉的時候
  //    畫面完全正常：按鈕亮著、存檔成功、沒有任何錯誤。
  await openEnteredResult([SEED]);
  const enteredUi = await page.evaluate(() => {
    const wrap = document.getElementById('resultEnteredWrap');
    const btn = document.getElementById('resultEnteredBtn');
    return {
      wrapHidden: wrap ? wrap.hasAttribute('hidden') : null,
      label: btn ? btn.textContent : '(缺下單鍵)',
      marked: btn ? btn.classList.contains('sel') : null,
    };
  });
  check('🔴 判定成立並進場 → 「我剛下單了」在', enteredUi.wrapHidden, false);
  check('預設沒有標記（略過是正常狀態）', enteredUi.marked, false);
  checkTruthy(`按鈕講的是「現在」（${enteredUi.label}）`, /剛下單/.test(enteredUi.label));

  const beforePress = Date.now();
  await page.evaluate(() => document.getElementById('resultEnteredBtn').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => document.getElementById('btnResultSave').click());
  await page.waitForTimeout(400);
  const pressed = await page.evaluate(() => JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'))[0]);
  // 🔴 這一條守的是 RECAP_OWNED_FIELDS：少了 'enteredAt' 這一項，使用者按了
  //    按鈕、看到打勾、存檔成功，而欄位從來沒有落地。
  checkTruthy(`🔴 下單時刻真的寫進那一筆（${pressed.enteredAt}）`,
    typeof pressed.enteredAt === 'number'
      && pressed.enteredAt >= beforePress && pressed.enteredAt <= Date.now());
  // 🔴 來源標記不得漏：這一條跟 Session 詳情那題的 'reported' **不可混算**。
  check('🔴 來源標記成 observed（跟補填的 reported 不可混算）', pressed.enteredAtSource, 'observed');
  check('一筆決策仍然只留一筆紀錄', 
    await page.evaluate(() => JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')).length), 1);
  check('沒有動到結果', pressed.tradeResult, 'pending');

  // 按鈕的樣子要反映**紀錄現在的狀態**，不是「這次開頁按過沒」。
  await openEnteredResult();
  const reopened = await page.evaluate(() => {
    const btn = document.getElementById('resultEnteredBtn');
    return { marked: btn ? btn.classList.contains('sel') : null, label: btn ? btn.textContent : '' };
  });
  check('🔴 重開收束頁，已標過的那一筆顯示成已標過', reopened.marked, true);
  checkTruthy(`而且字也跟著（${reopened.label}）`, /已記下/.test(reopened.label));

  // 再按一次 ＝ 收回去，時間與來源都要消失。
  await page.evaluate(() => document.getElementById('resultEnteredBtn').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => document.getElementById('btnResultSave').click());
  await page.waitForTimeout(400);
  const undone = await page.evaluate(() => JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'))[0]);
  // 🔴 留著來源的話，紀錄會同時說「我沒說我下單了」跟「那是量到的」。
  check('🔴 收回去時間消失', undone.enteredAt, null);
  check('🔴 收回去來源也消失（不是留著一個孤兒標記）', undone.enteredAtSource, null);

  // 判定不成立那條路不問下單 —— 沒有要下的單。
  {
    const STOOD = Date.now() - 4000;
    await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.evaluate((ts) => {
      localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify([{
        symbol: 'NVDA', templateId: 'MANCINI_FBD', outcomeTag: 'judged_stood_down',
        judgmentSchema: 'structure_watch_v1', durationSec: 60, marks: 0, events: [],
        ts, source: 'alert', tradeResult: 'no_entry',
      }]));
      localStorage.setItem('tenki.alert.return.v1', JSON.stringify({ ts, at: Date.now() }));
    }, STOOD);
    await page.goto(`${base}/decision-alert/#result`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const stood = await page.evaluate(() => {
      const wrap = document.getElementById('resultEnteredWrap');
      return wrap ? wrap.hasAttribute('hidden') : null;
    });
    check('🔴 判定不成立 → 不問下單（沒有要下的單）', stood, true);

    // 🔴 那個閘是**兩行**，上面那條只釘住其中一半：
    //      renderEnteredNow(asksTrade);                   ← listener
    //      toggleHidden(el.resultEnteredWrap, asksTrade); ← 可見性（上面那條守的）
    //    反向驗證實測：把第一行改成 `renderEnteredNow(true)` 弄紅 0 條，
    //    因為 wrap 仍然被第二行藏著。所以這裡強制點那顆藏起來的鈕 ——
    //    問的是「就算它被看見了，這條路也寫不進去」。兩條成對存在。
    await page.evaluate(() => document.getElementById('resultEnteredBtn').click());
    await page.waitForTimeout(150);
    await page.evaluate(() => document.getElementById('btnResultSave').click());
    await page.waitForTimeout(400);
    const stoodAfter = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'))[0]);
    check('🔴 強制點那顆藏起來的鈕，判定不成立那筆也寫不進下單時刻',
      stoodAfter.enteredAt, undefined);
    check('而且判定沒有被改掉', stoodAfter.outcomeTag, 'judged_stood_down');
  }

  // 🔴 把頁面還原回 /v3/ —— 下一段吃 v6 的全域（window.nextState）。
  // 不還原的話那一段會以 `window.nextState is not a function` 整支崩掉，
  // 而錯誤訊息完全看不出是「上一段把頁面開走了」。
  await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

// ═══════════════════════════════════════════════
// 日界節奏的事實行（規格 §9b 階段 B）
//
// 🔴 這一段驗兩件不同的事：
//   1. **行為** —— 鏡射的 `resolveDayCadence` 在同一組情境下，要跟 domain 那
//      28 條 jest 斷言算出同一個答案。常數可以比字面（preview-drift 在做），
//      但 `countsAsTrade` 這類語意兩邊是不同語言，比不了原始碼，只能實跑。
//   2. **接線** —— 那句事實行真的上了畫面。「值對」與「看得見」是兩件事
//      （PLAYBOOK §3：進度環被一條 legacy CSS 整個關掉，而值全部正確）。
//
// 🔴 階段 B 刻意**不閘門**：面板照常浮出，只多一行事實。先例是 quiet window
//    的裁決（「面板仍浮出、加一行脈絡，不硬靜音」）。閘門是階段 C。
// ═══════════════════════════════════════════════
console.log('\n── 日界節奏的事實行 ──');
{
  // 🔴 **偏移用秒，不要用小時。**
  // `resolveDayCadence` 按 **ET 日**過濾，而這支 harness 任何時刻都可能被跑到 ——
  // 在 ET 午夜到凌晨 3 點之間，「2 小時前」是**昨天**，整組情境會全部回 `fresh`。
  // 2026-10-09 04:52 UTC（＝ 00:52 EDT）實際踩到：**乾淨的 main 紅 11 條**，
  // 而且那 11 條每一條的訊息都長得像產品壞了。
  // 這條 policy 不看「多久以前」，只看「是不是同一個 ET 日」＋筆數＋輸贏 ——
  // 所以秒級偏移對它跟小時級是同一件事，而秒級在任何時刻都安全。
  // ⚠️ 「昨天不算」那條**仍然要用 30 小時**（它驗的就是跨日），不要一起改。
  const H = 1000; // ＝ 1 秒（名字保留，免得下面整張表重寫；語意見上）
  // 🔴 這一組是**純函式**，`now` 是參數 —— 所以直接釘在一個固定時刻，
  //    連「現在幾點」都不問。2026-01-15 12:00 EST，永遠是 ET 的正中午。
  const FIXED_NOW = Date.UTC(2026, 0, 15, 17, 0, 0);
  // 情境表與 domain 的 jest 斷言同一組 —— 兩邊算出不同答案就是漂移。
  const CASES = [
    ['沒有紀錄 → fresh', [], 'fresh', '今天還沒有決策紀錄'],
    ['一筆達到目標 → stop_after_win（贏停）',
      [[-2 * H, 'profit_taken']], 'stop_after_win', '今天第 1 筆 · 上一筆達到目標'],
    ['🔴 一筆未回填仍然算一筆（second_chance，不是 fresh）',
      [[-2 * H, 'pending']], 'second_chance', '今天第 1 筆 · 已收束'],
    ['兩筆都觸及保護價 → circuit_break（雙輸熔斷）',
      [[-3 * H, 'stopped_out'], [-2 * H, 'stopped_out']],
      'circuit_break', '今天 2 筆 · 兩筆都觸及保護價'],
    ['🔴 未回填 + 停損 → day_complete，不宣稱驗證不了的雙輸',
      [[-3 * H, 'pending'], [-2 * H, 'stopped_out']], 'day_complete', '今天已完成 2 筆'],
    ['🔴 no_entry 不吃額度（收手是紀律，不是交易）',
      [[-2 * H, 'no_entry'], [-1 * H, 'no_entry']], 'fresh', '今天還沒有決策紀錄'],
    ['🔴 契約前的紀錄（沒有這一欄）不猜、不計入',
      [[-2 * H, undefined]], 'fresh', '今天還沒有決策紀錄'],
  ];

  await page.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  for (const [name, recs, state, zh] of CASES) {
    const got = await page.evaluate(({ offsets, now }) => {
      const records = offsets.map(([off, result]) => {
        const r = { ts: now + off };
        if (result !== undefined) r.tradeResult = result;
        return r;
      });
      const out = window.TENKI_OUTCOME.resolveDayCadence(records, now);
      return { state: out.state, zh: out.contextZh };
    }, { offsets: recs, now: FIXED_NOW });
    check(name, got, { state, zh });
  }

  // 🔴 ET 日界：昨天的不算。用一個「UTC 已經換日、ET 還沒」的時刻會驗不到
  // 真正的差別，所以直接用 30 小時前 —— 那在任何時區都是昨天。
  const yesterday = await page.evaluate(() => {
    const now = Date.now();
    return window.TENKI_OUTCOME.resolveDayCadence(
      [{ ts: now - 30 * 60 * 60 * 1000, tradeResult: 'profit_taken' }], now).state;
  });
  check('🔴 昨天的紀錄不算進今天', yesterday, 'fresh');

  // ── 接線：事實行真的在畫面上 ──
  // ⚠️ 先種紀錄再開面板 —— renderEntryDiscipline 在面板浮出時才跑。
  //
  // 🔴 這一段**刻意把階段 C 的收摺關掉**。它要驗的是「事實行渲染得出來」，
  //    而那需要面板是開著的；階段 C 預設會把贏停的快訊收摺起來（面板不自己
  //    浮出），兩段耦在一起的話這裡會測到別人的行為。
  //    收摺本身由「到了停手點就收摺」那一段完整驗。
  // ⚠️ 這一行是補上去的：原本沒有它，於是階段 C 一落地，這一段當場紅三條 ——
  //    其中一條還寫著「階段 B 不閘門」，那句話在階段 C 之後就不再成立了。
  //    教訓：斷言的文字會把當下的產品狀態寫死，下一階段要記得回來改它。
  await page.evaluate((ts) => {
    localStorage.setItem('tenki.alert.settings.v1', JSON.stringify({ cadenceCollapse: false }));
    localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify([{
      symbol: 'NVDA', templateId: 'MANCINI_FBD', outcomeTag: 'judged_entered',
      judgmentSchema: 'structure_watch_v1', durationSec: 300,
      ts, source: 'alert', tradeResult: 'profit_taken',
    }]));
  }, Date.now() - 2000); // 2 秒前 —— 小時級偏移在 ET 凌晨會變成昨天（見上）
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.getElementById('btnSingle').click());
  await page.waitForTimeout(900);
  const line = await page.evaluate(() => {
    const n = document.getElementById('entryCadence');
    return { text: n ? n.textContent : null, panelOpen: document.getElementById('entrySheet').className.includes('show') };
  });
  checkTruthy('決策入口面板打開了（沒開就讀不到那一行，會是死斷言）', line.panelOpen);
  check('🔴 事實行真的上了畫面', line.text, '今天第 1 筆 · 上一筆達到目標');
  // 🔴 階段 B 不閘門 —— 贏停狀態下面板照樣浮出（quiet window 的先例）。
  // 🔴 原本寫「階段 B 不閘門」—— 階段 C 之後那句話不成立了。它現在驗的是
  // 「把收摺關掉時，贏停的快訊仍然照常浮出」，也就是那個設定真的有效。
  checkTruthy('🔴 收摺關掉時，贏停的快訊仍然照常浮出', line.panelOpen);

  // 事實行不得出現評價或指示。紅線詞與 domain 那一組同源。
  const bannedInLine = await page.evaluate(() => {
    const t = document.getElementById('entryCadence').textContent;
    return ['建議', '應該', '休息', '停手', '表現', '勝率', '獲利', '停損']
      .filter((w) => t.includes(w));
  });
  check('🔴 事實行不得評價或指示', bannedInLine, []);

  await page.evaluate(() => {
    localStorage.removeItem('tenki.alert.outcomes.v1');
    // 自己塞的設定自己清 —— 留著會讓後面每一段都在「收摺關掉」的狀態下跑。
    localStorage.removeItem('tenki.alert.settings.v1');
  });
  await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
}

// ═══════════════════════════════════════════════
// 結果回填（規格 §9b）—— Session 詳情是「之後可回填」的唯一入口
//
// 🔴 為什麼需要這個入口：收束頁只由一次性回程票開啟，在這之前**沒有任何
//    路徑回到一筆過去的決策**。而填寫時機的裁決（founder 2026-09-28）是
//    「收束當下問，但『還沒有結果』是預設」—— 那個裁決假設了回填可行。
//
// 🔴 這一段最重要的兩條：
//   1. 回填只動 `tradeResult`，其餘欄位逐一不變（這一頁是回填，不是重寫）。
//   2. 一筆決策仍然只留一筆紀錄（寫成 push 的話紀律統計立刻失真）。
// ═══════════════════════════════════════════════
console.log('\n── 結果回填（Session 詳情）──');
{
  const TS = Date.now() - 3000; // 3 秒前（同上：不得用小時）
  const SEED = {
    symbol: 'NVDA', templateId: 'MANCINI_FBD', outcomeTag: 'judged_entered',
    contextTag: '跟計畫', judgmentSchema: 'structure_watch_v1',
    reachedReadiness: null, durationSec: 540, marks: 2, events: [],
    awayCount: 1, awayMs: 45000, sameSymbolUpdates: 2,
    originAlertId: 'demo-1', ts: TS, source: 'alert', tradeResult: 'pending',
  };

  async function openDetail(store) {
    await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate((s) => {
      localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify(s));
    }, store);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await page.evaluate((ts) => window.openSessionDetail(ts), store[0].ts);
    await page.waitForTimeout(500);
  }

  await openDetail([SEED]);

  const shown = await page.evaluate(() => ({
    hidden: document.getElementById('sdBackfillCell').hasAttribute('hidden'),
    chips: [...document.querySelectorAll('#sdBackfillChips .tp-chip')].map((c) => c.textContent),
    picked: document.querySelectorAll('#sdBackfillChips .tp-chip.picked').length,
    note: document.getElementById('sdBackfillNote').textContent,
  }));
  checkTruthy('詳情表單真的開了、晶片真的長出來（0 顆就是死斷言）', shown.chips.length === 3);
  check('🔴 判定成立並進場的紀錄才有回填', shown.hidden, false);
  check('文案與收束頁同一份（共用模組，不是各寫一份）',
    shown.chips, ['達到目標', '觸及保護價', '打平出場']);
  check('未回填時一顆都不選', shown.picked, 0);
  checkTruthy('未回填時就地說出「還沒填」', shown.note.includes('還沒填'));

  // 點一顆 → 立刻落地（這一頁沒有收尾鍵，記錄不是選項）
  await page.evaluate(() => document.querySelectorAll('#sdBackfillChips .tp-chip')[0].click());
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    store: JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')),
    picked: [...document.querySelectorAll('#sdBackfillChips .tp-chip')].findIndex((c) => c.classList.contains('picked')),
    note: document.getElementById('sdBackfillNote').textContent,
  }));
  check('🔴 點一顆就寫進那一筆（不必按任何收尾鍵）', after.store[0].tradeResult, 'profit_taken');
  check('畫面同步標記選中的那顆', after.picked, 0);
  check('回填完就不再說「還沒填」', after.note, '');
  check('🔴 一筆決策仍然只留一筆紀錄（回填不得 push）', after.store.length, 1);

  // 🔴 只動 tradeResult —— 這一頁是回填，不是重寫。
  const untouched = await page.evaluate((seed) => {
    const r = JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'))[0];
    const changed = Object.keys(seed).filter((k) => JSON.stringify(r[k]) !== JSON.stringify(seed[k]));
    return changed;
  }, SEED);
  check('🔴 除了 tradeResult，其他欄位逐一不變', untouched, ['tradeResult']);

  // 再點同一顆 ＝ 取消 → 回到 pending（不是 null）
  await page.evaluate(() => document.querySelectorAll('#sdBackfillChips .tp-chip')[0].click());
  await page.waitForTimeout(250);
  check('🔴 取消回到 pending，不是 null（交易發生過，只是結果未知）',
    await page.evaluate(() => JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'))[0].tradeResult),
    'pending');

  // 判定不成立的紀錄不該出現回填（結果是推導出來的）
  await openDetail([{ ...SEED, outcomeTag: 'judged_stood_down', tradeResult: 'no_entry' }]);
  check('🔴 判定不成立的紀錄不問結果（整格隱藏）',
    await page.evaluate(() => document.getElementById('sdBackfillCell').hasAttribute('hidden')), true);

  // 回填會讓節奏狀態回溯改變 —— 這是對的，狀態是從紀錄重算的。
  await openDetail([SEED]);
  const beforeState = await page.evaluate(() =>
    window.TENKI_OUTCOME.resolveDayCadence(
      JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')), Date.now()).state);
  await page.evaluate(() => document.querySelectorAll('#sdBackfillChips .tp-chip')[0].click());
  await page.waitForTimeout(250);
  const afterState = await page.evaluate(() =>
    window.TENKI_OUTCOME.resolveDayCadence(
      JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')), Date.now()).state);
  check('回填前是 second_chance（未知 ≠ 贏）', beforeState, 'second_chance');
  check('🔴 回填後節奏狀態回溯改變成 stop_after_win', afterState, 'stop_after_win');

  await page.evaluate(() => localStorage.removeItem('tenki.alert.outcomes.v1'));
}

// ═══════════════════════════════════════════════
// 靜默理由不只一個時，要**全部**講得出來（規格 §9b ②）
//
// 🔴 改寫前 `evaluateDelivery` 是早退 + 單一 `reason` 字串：兩個理由同時成立
//    （決策進行中 ＋ Strain）時，事件鏈只印其中一個，使用者會學到錯的規則
//    （「是因為我在 Strain」），而真正攔住那則快訊的是另一件事。
//
// ⚠️ 刻意**不**為測試把 `evaluateDelivery` 掛到 window（那支檔是封閉 IIFE，
//    什麼都不外露）。改從使用者真正看得到的地方驗：事件鏈那一行。
//    這也順便守住「值對 ≠ 看得見」。
// ⚠️ 必須先確認真的有**兩個**條件成立 —— 只有一個的話，下面那條看不出差別，
//    會是一條死斷言。
// ═══════════════════════════════════════════════
console.log('\n── 靜默理由要講全部 ──');
{
  await page.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  // 同時造出「決策進行中」（跨頁標記，**不同標的**才不會走 session_update）
  // 與「Strain 狀態」（一筆新鮮讀數 —— effectiveZone 真讀數優先）。
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('tenki.v6.activeDecision.v1', JSON.stringify({
      symbol: 'ZZZZ', startedAtMs: now - 60000, expiresAtMs: now + 20 * 60 * 1000,
    }));
    localStorage.setItem('tenki.readiness.reading.v1', JSON.stringify({
      band: 'strain', confidence: 'high', ts: now, evidence: null,
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);

  // 前置條件要先證明成立，否則整段是死的。
  const pre = await page.evaluate(() => ({
    marker: !!localStorage.getItem('tenki.v6.activeDecision.v1'),
    strainOn: document.getElementById('setStrainSilent')
      ? document.getElementById('setStrainSilent').checked : null,
  }));
  checkTruthy('前置：決策進行中的標記在（不在就驗不到第一個理由）', pre.marker);
  checkTruthy('前置：Strain 靜默是開著的（預設 on）', pre.strainOn === true);

  await page.evaluate(() => document.getElementById('btnSingle').click());
  await page.waitForTimeout(900);

  const silentLine = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#logList .log-item')];
    const hit = items.reverse().find((n) => {
      const t = n.querySelector('.log-type');
      return t && t.textContent.includes('靜默');
    });
    return hit ? hit.querySelector('.log-detail').textContent : null;
  });
  checkTruthy(`事件鏈真的印了一條靜默（實際：${JSON.stringify(silentLine)}）`, !!silentLine);
  checkTruthy('🔴 兩個理由都講出來了（只講一個，使用者會學到錯的規則）',
    !!silentLine && silentLine.includes('決策進行中') && silentLine.includes('Strain 狀態'));
  // 行為不得變：決策仍然是 silent（面板不浮出）。
  check('🔴 decision 不變 —— 面板仍然沒有浮出',
    await page.evaluate(() => document.getElementById('entrySheet').className.includes('show')), false);

  await page.evaluate(() => {
    localStorage.removeItem('tenki.v6.activeDecision.v1');
    localStorage.removeItem('tenki.readiness.reading.v1');
  });

  // 🔴 還原回 /v3/ —— 下一段吃 v6 的全域。這是我在這支 harness 上**第二次**
  // 忘記還原（上一段已經為此寫了同樣的註解），所以這裡再寫一次：
  // 任何把 page 導去別的路由的區塊，離開前都要導回來。
  await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

// ═══════════════════════════════════════════════
// 到了停手點就收摺（規格 §9b 階段 C）
//
// 🔴 這是整條路線上**第一次真的改變快訊行為**的改動 —— 前面全是「多一行事實」
//    或「多一個可填的欄位」。所以守得最緊。
//
// 🔴 收摺**不是靜音**：那則快訊真的來了，而且使用者永遠沒有被擋住。
//    一顆可點的晶片，點了面板照樣開。先例是 quiet window 的裁決
//    （「面板仍浮出、加一行脈絡，不硬靜音」）。
// 🔴 只收摺 §6.1 明文的兩個停手點。`day_complete`（額度用完）刻意不收摺 ——
//    domain 自己的註解就說它是「較弱的事實」。
// ═══════════════════════════════════════════════
console.log('\n── 到了停手點就收摺 ──');
{
  // 同上：偏移用秒。這一段走的是真實 UI，產品內部自己讀 Date.now()，
  // 所以沒辦法像上面那樣釘死 now —— 只能把偏移縮到不可能跨 ET 日界。
  const H = 1000; // ＝ 1 秒
  const rec = (offset, result) => ({
    symbol: 'NVDA', templateId: 'MANCINI_FBD', outcomeTag: 'judged_entered',
    judgmentSchema: 'structure_watch_v1', durationSec: 300,
    ts: Date.now() + offset, source: 'alert', tradeResult: result,
  });

  async function fireWith(store) {
    await page.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate((s) => {
      localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify(s));
      localStorage.removeItem('tenki.v6.activeDecision.v1');
      localStorage.removeItem('tenki.readiness.reading.v1');
    }, store);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.getElementById('btnSingle').click());
    await page.waitForTimeout(900);
    return page.evaluate(() => ({
      panelOpen: document.getElementById('entrySheet').className.includes('show'),
      chips: [...document.querySelectorAll('#silentArea .silent-chip')].map((c) => ({
        text: c.textContent, actionable: c.classList.contains('actionable'), tag: c.tagName,
      })),
    }));
  }

  // ① 贏停（§6.1 明文停手點）→ 收摺
  const win = await fireWith([rec(-2 * H, 'profit_taken')]);
  check('🔴 贏停 → 面板不自己浮出', win.panelOpen, false);
  checkTruthy(`🔴 但留下一顆**可點**的晶片（實際：${JSON.stringify(win.chips)}）`,
    win.chips.length === 1 && win.chips[0].actionable && win.chips[0].tag === 'BUTTON');
  checkTruthy('晶片就地說出那個事實（不是只說「已靜默」）',
    win.chips[0] && win.chips[0].text.includes('上一筆達到目標'));
  checkTruthy('🔴 而且給得出一條路（仍要查看）',
    win.chips[0] && win.chips[0].text.includes('仍要查看'));

  // 🔴 點它 → 面板真的開得起來。收摺買的是摩擦，不是封鎖。
  await page.evaluate(() => document.querySelector('#silentArea .silent-chip.actionable').click());
  await page.waitForTimeout(800);
  check('🔴 點了晶片，面板照樣開（使用者永遠沒有被擋住）',
    await page.evaluate(() => document.getElementById('entrySheet').className.includes('show')), true);

  // ② 雙輸熔斷 → 同樣收摺
  const brk = await fireWith([rec(-3 * H, 'stopped_out'), rec(-2 * H, 'stopped_out')]);
  check('🔴 雙輸熔斷 → 收摺', brk.panelOpen, false);
  checkTruthy('熔斷的晶片說出的是熔斷那句事實',
    brk.chips.length === 1 && brk.chips[0].text.includes('兩筆都觸及保護價'));

  // ③ 額度用完（較弱的事實）→ **不**收摺
  const done = await fireWith([rec(-3 * H, 'pending'), rec(-2 * H, 'stopped_out')]);
  check('🔴 額度用完不收摺（domain 自己說它是較弱的事實）', done.panelOpen, true);

  // ④ 還有第二次機會 → 照常浮出
  const second = await fireWith([rec(-2 * H, 'pending')]);
  check('第二次機會仍然照常浮出', second.panelOpen, true);

  // ⑤ 關掉設定 → 回到收摺前的行為
  await page.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate((s) => {
    localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify(s));
    const k = 'tenki.alert.settings.v1';
    const cur = JSON.parse(localStorage.getItem(k) || '{}');
    cur.cadenceCollapse = false;
    localStorage.setItem(k, JSON.stringify(cur));
  }, [rec(-2 * H, 'profit_taken')]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const toggle = await page.evaluate(() => ({
    checked: document.getElementById('setCadenceCollapse').checked,
  }));
  check('設定讀得回來（關掉就是關掉）', toggle.checked, false);
  await page.evaluate(() => document.getElementById('btnSingle').click());
  await page.waitForTimeout(900);
  check('🔴 關掉設定 → 贏停也照常浮出（這條確認閘門真的由設定控制）',
    await page.evaluate(() => document.getElementById('entrySheet').className.includes('show')), true);

  await page.evaluate(() => {
    localStorage.removeItem('tenki.alert.outcomes.v1');
    localStorage.removeItem('tenki.alert.settings.v1');
  });
  // 🔴 還原回 /v3/ —— 下一段吃 v6 的全域（這支 harness 上我已經忘記兩次）。
  await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

// ═══════════════════════════════════════════════
// 離開太久：不是接回一個殭屍，是誠實收束
//
// 🔴 這條守的是 resume 最容易做錯的方向。「決策活得過離開」很容易寫成
// 「決策永遠活著」—— 那樣使用者隔天打開 App 會看到一個跑了 14 小時的計時器。
// 超過上限就走既有的 endDecision 寫一筆紀錄：**決策不該憑空消失，
// 也不該假裝還在跑。**
// ═══════════════════════════════════════════════
await page.evaluate(() => {
  localStorage.removeItem('tenki.alert.outcomes.v1');
  window.nextState(); window.nextState();          // idle → ready → running
});
await page.waitForTimeout(1200);
await page.evaluate((k) => {
  const m = JSON.parse(localStorage.getItem(k));
  m.startedAtMs = Date.now() - 40 * 60 * 1000;     // 40 分鐘前（守望上限是 30 分鐘）
  m.expiresAtMs = m.startedAtMs + 30 * 60 * 1000;
  localStorage.setItem(k, JSON.stringify(m));
}, ACTIVE_KEY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const stale = await page.evaluate((k) => ({
  running: document.getElementById('fdcb').className.includes('state-running'),
  marker: localStorage.getItem(k),
  store: JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1') || '[]'),
}), ACTIVE_KEY);
check('🔴 超過上限不得接回一個殭屍計時器', stale.running, false);
check('🔴 超過上限的標記要被清掉', stale.marker, null);
check('🔴 而且要留下一筆誠實的紀錄（決策不能憑空消失）', stale.store.length, 1);
checkTruthy(`那筆紀錄說得出它是怎麼結束的（${stale.store[0] && stale.store[0].outcomeTag}）`,
  stale.store.length === 1 && !!stale.store[0].outcomeTag);

// ═══════════════════════════════════════════════
// 真實快訊沒有指名結構：MATCH 欄整欄不出現，並就地說出為什麼
//
// 🔴 為什麼要用 **live 頻道**而不是 demo 按鈕：demo 的 `strategyHint` 是
// 'Mancini'，永遠比對得到，所以「沒有比對到」那一格在 demo 路徑上根本走不到。
// founder 2026-09-24 的真快訊是「ES1! 下穿 7,740.00」—— 沒有 strategyHint、
// 訊息欄也沒有結構名，於是 MATCH 欄頭立在那裡承諾一個它給不出來的值。
// 這一段照真路徑走：塞頻道 id + 攔 /api/alerts，讓產品自己 ingest。
//
// ⚠️ 方向詞（下穿 / 上穿 / 跌破）刻意**不**列入關鍵字：它只說了價格穿過一個
// 數字，沒說這是不是一個 failed breakdown —— 那正是使用者要守望的事。
// 所以「沒有比對到」是**正常情形**，不是壞掉，畫面必須這樣講。
// ═══════════════════════════════════════════════
console.log('\n── 真快訊（沒有指名結構）── ');
{
  const ctx2 = await browser.newContext({
    viewport: { width: 390, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const p2 = await ctx2.newPage();
  const errs2 = [];
  p2.on('pageerror', (e) => errs2.push(e.message));
  // 頻道只是一個 localStorage key —— 有它產品就自動開始輪詢。
  await ctx2.addInitScript(() => {
    localStorage.setItem('tenki.alert.channel', 'harness');
  });
  await p2.route('**/api/channel*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ bypassQuery: '' }),
  }));
  // 真快訊的形狀：條件是一句方向描述，strategyHint 與 note 都空。
  await p2.route('**/api/alerts*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ alerts: [{
      id: 'live-nomatch-1', symbol: 'ES1!', condition: '下穿 7,740.00',
      timeframe: '1m', price: 7740, receivedAt: Date.now(),
    }] }),
  }));
  await p2.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(2500);
  checkTruthy('真快訊自己把決策面板浮出來了',
    await p2.evaluate(() => document.getElementById('entrySheet').className.includes('show')));
  await p2.evaluate(() => document.getElementById('btnEngage').click());
  await p2.waitForTimeout(700);

  const nomatch = await p2.evaluate(() => {
    const head = document.querySelector('#tplList .tpl-head');
    const why = document.querySelector('#tplList .tpl-nomatch');
    return {
      headCells: head ? head.children.length : null,
      headLabels: head ? Array.from(head.children).map((c) => c.textContent) : null,
      flags: document.querySelectorAll('#tplList .tpl-flag').length,
      why: why ? why.textContent.trim() : null,
      whyVisible: why ? getComputedStyle(why).display !== 'none' : false,
      rows: document.querySelectorAll('#tplList .tpl-row').length,
    };
  });
  // 🔴 「印一個破折號」被 founder 2026-09-25 否決了：那只是把空白換一個寫法，
  // 欄頭仍然在承諾一個給不出來的值。所以第三欄**整欄不存在**。
  check('🔴 沒有比對到時 MATCH 欄整欄不出現（不是留一欄印「—」）',
    { headCells: nomatch.headCells, headLabels: nomatch.headLabels },
    { headCells: 2, headLabels: ['CODE', 'STRUCTURE'] });
  check('🔴 每一列也沒有那個空欄', nomatch.flags, 0);
  checkTruthy(`而且就地說出為什麼沒有值（${nomatch.why}）`,
    !!nomatch.why && nomatch.whyVisible && nomatch.why.indexOf('沒有指名結構') !== -1);
  // 三個流程照樣全部可選 —— 沒有比對到不代表少一條路。
  check('三個流程照樣都在（沒有比對到不等於不能選）', nomatch.rows, 3);
  // ⚠️ 語氣：陳述事實，不下指示。「請選擇 / 建議你」都是在替使用者決定。
  check('🔴 那句話不得寫成建議語氣', /請選|建議你|應該/.test(nomatch.why || ''), false);

  check('這一段沒有 page error', errs2, []);
  await ctx2.close();
}

// 對照組：同一支渲染器在**真的比對到**的時候必須把第三欄放回來 ——
// 否則上面那幾條可以用「永遠不畫第三欄」造假通過。
//
// ⚠️ 必須開**新的 context**，不能在同一頁再點 demo 按鈕：同標的冷卻
// （`lastSurfacedAtBySymbol`）會把第二則 ES1! 直接吃掉，畫面根本不會重畫，
// 於是「第三欄沒回來」這件事會被誤讀成規則壞了（寫這支時實際踩到）。
//
// 順便驗到中文關鍵字走得通：結構名寫在**條件欄**（不是 strategyHint）也要比對到 ——
// 那正是這一輪改動的重點，真實 TradingView 快訊就是這樣填的。
{
  const ctx3 = await browser.newContext({
    viewport: { width: 390, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const p3 = await ctx3.newPage();
  const errs3 = [];
  p3.on('pageerror', (e) => errs3.push(e.message));
  await ctx3.addInitScript(() => { localStorage.setItem('tenki.alert.channel', 'harness'); });
  await p3.route('**/api/channel*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ bypassQuery: '' }),
  }));
  await p3.route('**/api/alerts*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ alerts: [{
      id: 'live-match-1', symbol: 'ES1!', condition: '假跌破 掃低後收回',
      timeframe: '1m', price: 7740, receivedAt: Date.now(),
    }] }),
  }));
  await p3.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
  await p3.waitForTimeout(2500);
  await p3.evaluate(() => document.getElementById('btnEngage').click());
  await p3.waitForTimeout(700);
  const matched = await p3.evaluate(() => {
    const head = document.querySelector('#tplList .tpl-head');
    return {
      headLabels: head ? Array.from(head.children).map((c) => c.textContent) : null,
      alerts: Array.from(document.querySelectorAll('#tplList .tpl-flag'))
        .map((f) => f.textContent).filter(Boolean),
      why: !!document.querySelector('#tplList .tpl-nomatch'),
    };
  });
  check('🔴 結構名寫在條件欄也要比對到（strategyHint 是空的）',
    matched.headLabels, ['CODE', 'STRUCTURE', 'MATCH']);
  check('而且只標一列', matched.alerts, ['ALERT']);
  check('比對到就不再說「沒有指名結構」', matched.why, false);
  check('對照組沒有 page error', errs3, []);
  await ctx3.close();
}

// ═══════════════════════════════════════════════
// 「審視」那一段（規格 §1.2：審視 = judgedAt − alertAt）
//
// 🔴 這一段守的是**那個不給數字的分支**。有 alertAt 就相減很容易寫對，
//    難的是：`abandoned_no_judgment` 的 `ts` 不是判定時刻 —— 它是守望撞上限、
//    或使用者終於把 App 打開的那一刻。同一個機制已經把一筆「未判定」印成
//    41:20（decision-outcome.js 的 WATCH_CEILING_SEC 註解）。那筆若也去減
//    alertAt，畫面會印「審視 3:12:40」，而那量的是他隔多久才開 App。
// ═══════════════════════════════════════════════
console.log('\n── 審視（快訊到達 → 判定）──');
{
  // 🔴 先補**紀錄寫入那一跳**。上面驗到 sess 帶著 alertAt、也活過重載，但
  //    「收束的時候有沒有寫進紀錄」沒有任何斷言守著 —— 把 saveV6Outcome 裡那一行
  //    刪掉，整支 harness 依然全綠（反向驗證當場抓到）。下面的畫面斷言是餵
  //    seed 的，繞過了寫入端，所以它們補不了這個洞。
  async function recordWith(alertAt) {
    await page.goto(`${base}/v3/#decision`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3600);                 // v6 的 splash 是 2400ms
    await page.evaluate((at) => {
      localStorage.removeItem('tenki.alert.outcomes.v1');
      setState('running');
      sess.watch = true;                             // 守望才走 judged_* 那套語意
      sess.symbol = 'ES1!';
      if (at !== null) sess.alertAt = at;
    }, alertAt);
    await page.evaluate(() => endDecision('entered'));
    await page.waitForTimeout(900);
    return page.evaluate(() => {
      const all = JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')) || [];
      const r = all[all.length - 1] || null;
      return {
        n: all.length,
        tag: r ? r.outcomeTag : null,
        alertAt: r ? r.alertAt : null,
        hasKey: r ? Object.prototype.hasOwnProperty.call(r, 'alertAt') : null,
      };
    });
  }

  const AT = Date.now() - 95000;
  const withAt = await recordWith(AT);
  checkTruthy(`收束真的寫了一筆（${withAt.n} 筆，${withAt.tag}）`,
    withAt.n === 1 && withAt.tag === 'judged_entered');
  check('🔴 收束時把快訊到達時刻寫進紀錄（整條鏈的終點）', withAt.alertAt, AT);

  const withoutAt = await recordWith(null);
  check('🔴 沒有快訊到達時刻 → **整個欄位不存在**（不是 alertAt: null）',
    withoutAt.hasKey, false);

  await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 純邏輯：判準住在共用模組，先在那裡逐條問清楚。
  const judge = await page.evaluate(() => {
    const O = window.TENKI_OUTCOME;
    const base = { ts: 1000000, judgmentSchema: 'structure_watch_v1' };
    return {
      entered: O.reviewedSec({ ...base, alertAt: 1000000 - 185000, outcomeTag: 'judged_entered' }),
      stood: O.reviewedSec({ ...base, alertAt: 1000000 - 185000, outcomeTag: 'judged_stood_down' }),
      noJudgment: O.reviewedSec({ ...base, alertAt: 1000000 - 185000, outcomeTag: 'abandoned_no_judgment' }),
      manual: O.reviewedSec({ ...base, outcomeTag: 'judged_entered' }),
      negative: O.reviewedSec({ ...base, alertAt: 1000000 + 5000, outcomeTag: 'judged_entered' }),
    };
  });
  check('判定成立並進場 → 算得出來（185 秒）', judge.entered, 185);
  check('判定不成立也算得出來（他看了，只是決定不動）', judge.stood, 185);
  check('🔴 未判定那一筆回 null —— 它的 ts 不是判定時刻，是他終於把 App 打開',
    judge.noJudgment, null);
  check('🔴 手動開的決策沒有 alertAt → null，不是 0 秒', judge.manual, null);
  check('alertAt 晚於判定（時鐘歪了）→ null，不印負數', judge.negative, null);

  // 畫面：Session 詳情那一格。算不出來就**整格不存在**，不印 0:00。
  const ALERT_AT = Date.now() - 3000 - 185000;
  const seed = (extra) => [Object.assign({
    symbol: 'NVDA', templateId: 'MANCINI_FBD', outcomeTag: 'judged_entered',
    judgmentSchema: 'structure_watch_v1', reachedReadiness: null,
    durationSec: 540, marks: 0, events: [], originAlertId: 'demo-1',
    ts: Date.now() - 3000, source: 'alert', tradeResult: 'pending',
  }, extra)];

  async function cellFor(store) {
    await page.evaluate((v) => {
      localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify(v));
    }, store);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await page.evaluate((ts) => window.openSessionDetail(ts), store[0].ts);
    await page.waitForTimeout(400);
    return page.evaluate(() => ({
      hidden: document.getElementById('sdFactReviewedCell').hasAttribute('hidden'),
      text: document.getElementById('sdFactReviewed').textContent,
      label: document.getElementById('sdFactReviewedCell').querySelector('.k').textContent,
    }));
  }

  const withAlert = await cellFor(seed({ alertAt: ALERT_AT }));
  check('🔴 有快訊到達時刻、而且判定過 → 那一格在', withAlert.hidden, false);
  check('標籤就叫「審視」（規格 §1.2 的詞）', withAlert.label, '審視');
  // 🔴 兩端都是觀測到的毫秒 → 印到秒。這跟「等待」刻意不同（那一端是回想的分鐘）。
  check('🔴 印到秒（3:05），不是「約 3 分」', withAlert.text, '3:05');

  const noJudgment = await cellFor(seed({ alertAt: ALERT_AT, outcomeTag: 'abandoned_no_judgment' }));
  check('🔴 未判定那一筆整格不存在（不是印 0:00，也不是印他隔多久才開 App）',
    noJudgment.hidden, true);

  const manual = await cellFor(seed({ originAlertId: null, source: 'v6' }));
  check('🔴 手動開的決策整格不存在', manual.hidden, true);
}

// ═══════════════════════════════════════════════
// 出場時間與「持有」那一段（規格 §1.2 的 closedAt）
//
// 🔴 這一段守的重點跟 alertAt 那一刀同形：**不給數字的那些分支**。
//    ① 結果還是 pending → 部位沒收，沒有出場時刻可言
//    ② 沒有 enteredAt → 持有的另一端不存在，問了也算不出東西
//    ③ 答過了 → 不再問
//    以及那個最容易做錯的：**隔夜持倉必須答得出來**。
// ═══════════════════════════════════════════════
console.log('\n── 出場時間與持有 ──');
{
  await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 純邏輯先問清楚（判準住共用模組）。
  const judge = await page.evaluate(() => {
    const O = window.TENKI_OUTCOME;
    const entered = new Date(2026, 9, 29, 9, 30, 0, 0).getTime();
    const now = new Date(2026, 9, 30, 12, 0, 0, 0).getTime();
    const base = {
      ts: entered - 600e3, outcomeTag: 'judged_entered', tradeResult: 'profit_taken',
      enteredAt: entered, enteredAtSource: 'reported',
    };
    return {
      allows: O.allowsExitTime(base),
      pending: O.allowsExitTime({ ...base, tradeResult: 'pending' }),
      noEntry: O.allowsExitTime({ ...base, enteredAt: undefined }),
      answered: O.allowsExitTime({ ...base, closedAt: now - 1000 }),
      sameDay: O.exitTimeFrom(base, '2026-10-29T10:45', now).ok,
      overnight: O.exitTimeFrom(base, '2026-10-30T00:20', now).ok,
      beforeEntry: O.exitTimeFrom(base, '2026-10-29T09:00', now).reason,
      future: O.exitTimeFrom(base, '2026-10-31T09:00', now).reason,
      timeOnly: O.exitTimeFrom(base, '09:00', now).reason,
      held: O.heldSec({ ...base, closedAt: new Date(2026, 9, 30, 0, 20, 0, 0).getTime() }),
      precBothReported: O.heldPrecision({ ...base, closedAtSource: 'reported' }),
      // 🔴 **兩個方向都要問。** 只問一個方向的話，「只看出場那一端」這個 bug
      //    在 entered=observed / closed=reported 這一半照樣答對 —— 反向驗證
      //    實測：那個破壞弄紅 0 條。有鑑別力的是**另一半**。
      precMixedEnteredCoarse: O.heldPrecision({ ...base, enteredAtSource: 'reported', closedAtSource: 'observed' }),
      precMixedClosedCoarse: O.heldPrecision({ ...base, enteredAtSource: 'observed', closedAtSource: 'reported' }),
      precBothObserved: O.heldPrecision({ ...base, enteredAtSource: 'observed', closedAtSource: 'observed' }),
      noClosed: O.heldSec(base),
    };
  });
  check('結果已填 + 有進場時間 → 問得出來', judge.allows, true);
  check('🔴 結果還是 pending → 不問（部位沒收，沒有出場時刻可言）', judge.pending, false);
  check('🔴 沒有進場時間 → 不問（持有的另一端不存在，問了也算不出東西）', judge.noEntry, false);
  check('答過了就不再問', judge.answered, false);
  check('同一天的出場時間收得下', judge.sameDay, true);
  // 🔴 這條是這一刀最容易做錯的地方：拿「判定那一天」當錨的話，每一筆過夜
  //    持倉都會被判成「比進場還早」—— 一個合法情境被擋在看不懂的錯誤後面。
  check('🔴 隔夜持倉（9:30 進、隔天 00:20 出）收得下', judge.overnight, true);
  check('早於進場 → 擋下來，而且說得出是哪裡不對', judge.beforeEntry, 'before_entry');
  check('未來 → 擋下來', judge.future, 'future');
  check('只給時間不給日期 → 看不懂（這一題收的是 datetime-local）', judge.timeOnly, 'unparsable');
  check('持有算得出來（14 小時 50 分 = 53400 秒）', judge.held, 53400);
  check('兩端都是回想的 → 分鐘精度', judge.precBothReported, 'minute');
  // 🔴 一段時長不會比它最粗的那一端更精確 —— 這跟「等待」只看一端不同。
  //    兩個方向成對存在：拆掉任一條，「只看某一端」的 bug 就有一半溜過去。
  check('🔴 進場回想、出場量到 → 分鐘精度（粗的是進場那端）',
    judge.precMixedEnteredCoarse, 'minute');
  check('🔴 進場量到、出場回想 → 分鐘精度（粗的是出場那端）',
    judge.precMixedClosedCoarse, 'minute');
  check('兩端都是量到的 → 秒精度', judge.precBothObserved, 'second');
  check('沒有出場時間 → 持有是 null，不是 0', judge.noClosed, null);

  // 畫面：問句列與「持有」那一格
  //
  // 🔴 **進場時刻要對齊整分鐘，否則下面那條「約 2 小時 20 分」是 flaky 的。**
  //    `datetime-local` 只到分鐘，所以我們送出去的出場時間會把秒截掉；
  //    而 `Date.now()` 帶著秒。於是持有 = 2:20:00 − (ENTERED 的秒數)，
  //    秒數 ≥ 30 的時候 round 成 139 分 → 印「約 2 小時 19 分」。
  //    實測：第一次跑是綠的（運氣），反向驗證重跑時當場紅，印 2 小時 19 分。
  //    這是 `waitedPrecision` 註解裡那個 `29:22` 的同一個算術，第二次咬人 ——
  //    上次是**產品**印出使用者沒給過的精度，這次是**fixture** 把秒帶進一條
  //    分鐘精度的斷言裡。判準：凡是斷言分鐘精度的時長，fixture 的兩端都要
  //    自己先對齊到整分鐘，不要靠 `Date.now()` 剛好。
  const ENTERED = Math.floor((Date.now() - 3 * 3600e3) / 60000) * 60000;
  const seed = (extra) => [Object.assign({
    symbol: 'NVDA', templateId: 'MANCINI_FBD', outcomeTag: 'judged_entered',
    judgmentSchema: 'structure_watch_v1', reachedReadiness: null,
    durationSec: 540, marks: 0, events: [], originAlertId: 'demo-1',
    ts: ENTERED - 600e3, source: 'alert', tradeResult: 'profit_taken',
    enteredAt: ENTERED, enteredAtSource: 'reported',
  }, extra)];

  async function openWith(store) {
    await page.evaluate((v) => {
      localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify(v));
    }, store);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await page.evaluate((ts) => window.openSessionDetail(ts), store[0].ts);
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const row = document.getElementById('sdExitTimeRow');
      const cell = document.getElementById('sdFactHeldCell');
      const v = document.getElementById('sdFactHeld');
      const note = document.getElementById('sdExitTimeNote');
      return {
        askHidden: row ? row.hasAttribute('hidden') : null,
        heldHidden: cell ? cell.hasAttribute('hidden') : null,
        held: v ? v.textContent : '(缺持有這一格)',
        note: note ? note.textContent : '(缺說明這一行)',
      };
    });
  }

  const asked = await openWith(seed({}));
  check('🔴 結果填完、有進場時間 → 問句列在', asked.askHidden, false);
  check('還沒答之前，持有那一格不存在', asked.heldHidden, true);

  // 🔴 founder 2026-10-30 實走：iOS 對**空的** time / datetime-local 不畫
  //    `--:--`，那個欄位在他機器上就是一個看不懂的空方框。修法只能放在框
  //    **外面**（預填一個「合理的時間」是 CLAUDE.md 禁止的事）。
  //    ⚠️ 這條守的是**那句話在不在、而且說得出要選日期**，不是某個節點存在 ——
  //    容器只有 Chromium（它會畫 `--:--`），所以 iOS 那個渲染差異我在這裡
  //    **驗不到**；能驗的是「畫面自己有沒有把它講清楚」。
  const exitHint = await page.evaluate(() => {
    const row = document.getElementById('sdExitTimeRow');
    const hint = row ? row.querySelector('.bf-input-hint') : null;
    return hint ? hint.textContent : '(缺提示這一行)';
  });
  checkTruthy(`🔴 出場那格旁邊說得出要選日期和時間（${exitHint}）`,
    /日期/.test(exitHint) && /時間/.test(exitHint));

  const noEntry = await openWith(seed({ enteredAt: undefined, enteredAtSource: undefined }));
  check('🔴 沒有進場時間 → 問句列整列不出現', noEntry.askHidden, true);

  const stillPending = await openWith(seed({ tradeResult: 'pending' }));
  check('🔴 結果還沒填 → 問句列整列不出現', stillPending.askHidden, true);

  // 真的答一次 —— 走的是產品自己的輸入與儲存路徑
  await openWith(seed({}));
  const exitLocal = await page.evaluate((at) => {
    const d = new Date(at);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }, ENTERED + 2 * 3600e3 + 20 * 60e3);
  await page.evaluate((v) => {
    document.getElementById('sdExitTime').value = v;
    document.getElementById('sdExitTimeSave').click();
  }, exitLocal);
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'));
    const cell = document.getElementById('sdFactHeldCell');
    const v = document.getElementById('sdFactHeld');
    const row = document.getElementById('sdExitTimeRow');
    return {
      n: store.length,
      closedAt: store[0].closedAt,
      source: store[0].closedAtSource,
      tradeResult: store[0].tradeResult,
      enteredAt: store[0].enteredAt,
      heldHidden: cell ? cell.hasAttribute('hidden') : null,
      held: v ? v.textContent : '(缺持有這一格)',
      askHidden: row ? row.hasAttribute('hidden') : null,
    };
  });
  check('一筆決策仍然只留一筆紀錄', after.n, 1);
  checkTruthy(`🔴 出場時間寫進那一筆（${after.closedAt}）`, typeof after.closedAt === 'number');
  // 🔴 這個數字是使用者回想的，不是 App 量到的 —— 標記不得漏，
  //    否則下游分不出它跟將來「當場按出場」那條路的差別。
  check('🔴 來源標記成 reported（跟將來的 observed 不可混算）', after.source, 'reported');
  check('回填只動 closedAt —— 結果沒被改掉', after.tradeResult, 'profit_taken');
  check('回填只動 closedAt —— 進場時間沒被改掉', after.enteredAt, ENTERED);
  check('🔴 答完持有那一格長出來', after.heldHidden, false);
  // 🔴 回想來的時間只有分鐘精度 → 不准印 m:ss（那會是 140:00）。
  check('🔴 印成人話的分鐘精度，不是 m:ss', after.held, '約 2 小時 20 分');
  check('答過了就不再問', after.askHidden, true);

  // 擋下來的那條路：只說那個時間怎麼了
  await openWith(seed({}));
  await page.evaluate(() => {
    document.getElementById('sdExitTime').value = '2020-01-01T00:00';
    document.getElementById('sdExitTimeSave').click();
  });
  await page.waitForTimeout(300);
  const refused = await page.evaluate(() => ({
    note: document.getElementById('sdExitTimeNote').textContent,
    closedAt: JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'))[0].closedAt,
  }));
  check('🔴 早於進場的時間不准寫進去', refused.closedAt, undefined);
  checkTruthy(`擋下來只說那個時間怎麼了（${refused.note}）`,
    /這比進場的時候還早/.test(refused.note));
}

// ═══════════════════════════════════════════════
// 重設連結：一個**安靜地**破壞性的動作要先講，講完還要留著
//
// 🔴 founder 2026-10-30 實走：按了重設、TradingView 沒有逐則重貼，於是舊 alert
//    繼續 POST 到舊頻道 —— 那條頻道在 Redis 裡還活著（30 天 TTL），所以
//    TradingView 顯示「已送達」而 App 不再輪詢它。**兩邊都不報錯。**
//    這組守的是「按下去之前講了、而且第一下真的沒有換掉頻道」。
// ═══════════════════════════════════════════════
console.log('\n── 重設連結：先講，而且講完要留著 ──');
{
  const ctx4 = await browser.newContext({
    viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const p4 = await ctx4.newPage();
  const errs4 = [];
  p4.on('pageerror', (e) => errs4.push(e.message));
  await ctx4.addInitScript(() => { localStorage.setItem('tenki.alert.channel', 'old-channel'); });
  await p4.route('**/api/channel*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, channelId: 'new-channel', bypassQuery: null }),
  }));
  await p4.route('**/api/alerts*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [] }),
  }));
  await p4.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
  await p4.waitForTimeout(2500);
  await p4.evaluate(() => {
    if (document.getElementById('liveBody').hasAttribute('hidden')) {
      document.getElementById('liveToggle').click();
    }
  });
  await p4.waitForTimeout(400);

  // 🔴 讀 DOM 一律容錯 —— 節點不在時要給一條**看得懂的紅字**，不是讓
  //    `getElementById(...).hasAttribute` 以 TypeError 把整支腳本炸掉。
  //    反向驗證 #20（把帶子節點整個拿掉）當場踩到：沒有收尾行、失敗數不可信，
  //    下一個人看到的是「Cannot read properties of null」而不是「帶子不見了」。
  //    PLAYBOOK 早有這條（`getComputedStyle(null)` 那次），我這一刀又犯一次。
  const readReset = () => {
    const warn = document.getElementById('liveResetWarn');
    const btn = document.getElementById('liveReset');
    return {
      ready: !document.getElementById('liveReady')?.hasAttribute('hidden'),
      // null ＝ 這一格根本不存在，跟 true/false 分得開
      noteHidden: warn ? warn.hasAttribute('hidden') : null,
      note: warn ? warn.textContent : '(缺帶子這一格)',
      btn: btn ? btn.textContent : '(缺重設鍵)',
      ch: localStorage.getItem('tenki.alert.channel'),
    };
  };
  const armed0 = await p4.evaluate(readReset);
  checkTruthy('前提：設定面板展開、重設鍵在（0 的話下面全是死斷言）', armed0.ready);
  check('還沒按：帶子不在', armed0.noteHidden, true);
  check('還沒按：鍵還是「重設連結」', armed0.btn, '重設連結');

  // 第一下 —— 只能講話，不准換頻道
  await p4.evaluate(() => document.getElementById('liveReset').click());
  await p4.waitForTimeout(400);
  const armed1 = await p4.evaluate(readReset);
  check('🔴 第一下**不換頻道**（這就是二次確認的全部意義）', armed1.ch, 'old-channel');
  check('第一下把鍵換成「確定重設」', armed1.btn, '確定重設');
  check('第一下就把帶子打開', armed1.noteHidden, false);
  // 🔴 文案的重點是「不會報錯」—— 使用者預期的失敗是看得見的失敗，
  //    而這個失敗的全部危險在於它看起來像成功。少了這句，帶子就只是裝飾。
  checkTruthy('🔴 帶子說得出「不會報錯／安靜地失效」這件事',
    /不會報錯/.test(armed1.note) && /安靜/.test(armed1.note));
  checkTruthy('🔴 帶子說得出要去 TradingView 逐則重貼',
    /TradingView/.test(armed1.note) && /每一則/.test(armed1.note));

  // 第二下 —— 真的換，而且提醒留著
  await p4.evaluate(() => document.getElementById('liveReset').click());
  await p4.waitForTimeout(900);
  const done = await p4.evaluate(readReset);
  check('第二下真的換了頻道', done.ch, 'new-channel');
  check('換完鍵回到「重設連結」（不會卡在確定態）', done.btn, '重設連結');
  // 🔴 提醒**留著**，不是閃一下 —— 使用者按完通常會先去別的地方。
  check('🔴 換完之後提醒還在', done.noteHidden, false);
  checkTruthy('🔴 換完的提醒仍然講得出「每一則都要重貼」',
    /每一則/.test(done.note) && /重貼/.test(done.note));

  // 按複製 ＝ 他正要去重貼 → 提醒收工
  await p4.evaluate(() => document.getElementById('liveCopy')?.click());
  await p4.waitForTimeout(300);
  check('按了複製連結，提醒才收起來', (await p4.evaluate(readReset)).noteHidden, true);

  check('這一段沒有 page error', errs4, []);
  await ctx4.close();
}

// ═══════════════════════════════════════════════
// 推播重綁：樂觀的結論不得靠 fallthrough 拿到
//
// 🔴 舊版在請求**送出之前**就印了「關掉網頁也會收到快訊」，而 rebindPush() 是
//    fire-and-forget（`.catch(() => {})`，連 `r.ok` 都沒看）。重設連結之後，
//    訂閱能不能跟到新連結完全由這次重綁決定 —— 畫面唯一宣告的那件事，
//    正好是它唯一不檢查的那一步。
//
// ⚠️ 這裡餵的是 **500**，不是網路錯誤。那是刻意的：`fetch` 的 reject 只涵蓋
//    網路層，400/404/500 都是「成功的 fetch」—— 舊的 catch 連伺服器說
//    「這個頻道不存在」都接不到。用網路錯誤測的話，這條守不到真正的洞。
// ═══════════════════════════════════════════════
console.log('\n── 推播重綁：沒接上就不准說接上了 ──');
for (const [label, subscribeStatus, mustSay, mustNotSay] of [
  ['重綁失敗（500）', 500, /還沒接到這條連結/, /關掉網頁也會收到快訊/],
  ['重綁成功（200）', 200, /關掉網頁也會收到快訊/, /還沒接到這條連結/],
]) {
  const ctx5 = await browser.newContext({
    viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const p5 = await ctx5.newPage();
  const errs5 = [];
  p5.on('pageerror', (e) => errs5.push(e.message));
  // 真的 push 訂閱在 headless 裡拿不到（要 VAPID + 推播服務），所以把
  // **產品碼唯一碰到的那兩個介面**換掉：getRegistration / getSubscription。
  // 測到的仍然是真的產品邏輯（誰先宣告、看不看 r.ok），不是加 class 演戲。
  await ctx5.addInitScript(() => {
    localStorage.setItem('tenki.alert.channel', 'push-channel');
    const fakeSub = {
      endpoint: 'https://example.invalid/p/abc',
      keys: { p256dh: 'x', auth: 'y' },
      toJSON() { return { endpoint: this.endpoint, keys: this.keys }; },
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: () => Promise.resolve({}),
        getRegistration: () => Promise.resolve({
          pushManager: { getSubscription: () => Promise.resolve(fakeSub) },
        }),
      },
    });
  });
  await p5.route('**/api/channel*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, channelId: 'push-channel', bypassQuery: null }),
  }));
  await p5.route('**/api/alerts*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [] }),
  }));
  await p5.route('**/api/subscribe*', (route) => route.fulfill({
    status: subscribeStatus, contentType: 'application/json',
    body: JSON.stringify({ ok: subscribeStatus === 200 }),
  }));
  await p5.goto(`${base}/decision-alert/`, { waitUntil: 'domcontentloaded' });
  await p5.waitForTimeout(2500);
  await p5.evaluate(() => {
    if (document.getElementById('liveBody').hasAttribute('hidden')) {
      document.getElementById('liveToggle').click();
    }
  });
  await p5.waitForTimeout(900);

  const push = await p5.evaluate(() => {
    const row = document.getElementById('livePushRow');
    const btn = document.getElementById('livePushBtn');
    const st = document.getElementById('livePushStatus');
    return {
      rowHidden: row ? row.hasAttribute('hidden') : null,
      btn: btn ? btn.textContent : '(缺推播鍵)',
      status: st ? st.textContent : '(缺推播狀態這一行)',
    };
  });
  checkTruthy(`${label}｜前提：推播列在、而且認得既有訂閱（${push.btn}）`,
    !push.rowHidden && /已開啟/.test(push.btn));
  checkTruthy(`${label}｜說得出該說的（實際：${push.status.slice(0, 24)}…）`,
    mustSay.test(push.status));
  // 🔴 這一條才是守舊 bug 的那條：舊版無論如何都會印那句話。
  check(`🔴 ${label}｜不准說不該說的`, mustNotSay.test(push.status), false);
  check(`${label}｜沒有 page error`, errs5, []);
  await ctx5.close();
}

check('整條鏈走完沒有任何 page error', pageErrors, []);

await browser.close();
server.close();
console.log(failed === 0 ? '\n🟢 全綠' : `\n🔴 ${failed} 條失敗`);
process.exit(failed === 0 ? 0 : 1);

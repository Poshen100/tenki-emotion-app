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
 * 2026-08-09 起也守模板選單的終端機排版與兩條內容紅線（MODE_2 不上畫面、不推薦）。
 * ⚠️ 那次改版把 `.tpl-card` 改名成 `.tpl-row`，本 harness 的選擇器當場失效 ——
 * preview harness **沒有進 verify.sh**（Playwright 路徑是容器限定），所以它不會
 * 自己喊痛。改 preview 的 class 名時要一併 grep scripts/*.mjs。
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
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  // ⚠️ 這兩條 rewrite 正式站是 vercel.json 在做，本地伺服器要自己補。
  // 少了它們，`/preview/*` 的共用模組全部 404 —— 而先前這支 harness **就是這樣**：
  // decision-alert.html 載的 readiness-scan.js / decision-outcome.js 一直靜默 404，
  // 頁面看起來照樣正常（那些模組當時沒被斷言用到），直到 decision-alert.js
  // 改成硬相依 window.TENKI_OUTCOME 才爆出來。**靜默 404 的測試環境比沒有測試更糟。**
  if (clean.startsWith('/preview/')) clean = '/apps' + clean;
  if (clean === '/v3' || clean === '/v3/') clean = '/apps/preview/v6/index.html';
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
  const ok = JSON.stringify(got) === JSON.stringify(want);
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

// ── 模板選單：終端機讀數 ──
// founder 2026-08-09 點名這一頁「太遜」，要的是彭博終端機。下面守的是它的
// **結構性特徵**（等寬骨架 / 硬邊 / 欄位表頭 / 列編號），以及兩條內容紅線。
const sheetText = await page.$eval('#tplSheet', (n) => n.innerText);

// 🔴 內部 template id 不得上畫面。在 Adam Mancini 的語彙裡「Mode 2」指的是
// **盤整日盤勢**，跟這個模板（Canslim High RS Breakout）完全兩回事 ——
// 先前標題印成「高 RS 突破流程（MODE_2）」，剛好撞上 founder 每天在用的術語。
check('MODE_2 不得出現在任何 user-facing 文字裡', sheetText.includes('MODE_2'), false);
check('顯示的是交易者看得懂的代號（HIGH RS）', sheetText.includes('HIGH RS'), true);

// 交易者本來就有自己的偏好 —— 不推薦，只陳述「這筆快訊標的是這個結構」。
check('不得出現「建議」字樣', sheetText.includes('建議'), false);
check('快訊匹配以中性欄位值呈現（ALERT）', sheetText.includes('ALERT'), true);

// emoji 會有 AI 感（founder 原話）。
// ⚠️ 範圍要涵蓋 U+2B00-2BFF —— ⭐ 是 U+2B50，不在 2600-27BF 裡。
// 反向驗證時把 ⭐建議 加回去，第一版的 regex 沒抓到（自己漏的，當場補上）。
check('模板列不得有 emoji',
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u.test(sheetText), false);

// 終端機的骨架：等寬（拉丁與數字欄位）、硬邊、欄位表頭、彭博式列編號。
const term = await page.evaluate(() => {
  const cs = (s) => getComputedStyle(document.querySelector(s));
  return {
    codeMono: /mono/i.test(cs('.tpl-code').fontFamily),
    rowRadius: cs('.tpl-row').borderRadius,
    hasHead: !!document.querySelector('.tpl-head'),
    numbered: [...document.querySelectorAll('.tpl-code')].every((n, i) => n.textContent.startsWith(`${i + 1}) `)),
  };
});
check('代號欄是等寬字', term.codeMono, true);
check('列是硬邊（不是圓角卡片）', term.rowRadius, '0px');
check('有欄位表頭列', term.hasHead, true);
check('每一列都有彭博式編號 N)', term.numbered, true);

await page.click('.tpl-row'); // 第 1 列 = 快訊標記的 FBD
await page.waitForTimeout(1200); // 讓守望條累積幾秒（快速判定正是要保護的案例）
await page.click('#btnStructureConfirmed');
await page.waitForTimeout(1600); // 收束頁的揭示編排

const rate = (await page.textContent('#resultRate'))?.trim() ?? '';
console.log(`\n紀律完成率文字：「${rate}」`);
check('快速判定進場算紀律（完成率 100%）', /100%/.test(rate), true);

const segBg = await page.$eval('#resultStrip .result-seg', (n) => getComputedStyle(n).backgroundColor);
check('momentum strip 本次段落 = 紀律色', segBg, CLEAR);
check('momentum strip 不得畫成 strain 橘', segBg !== STRAIN, true);

// ── 收束頁的主要動作不得沉到摺線下 ──
// founder 2026-08-09 實走：「要下滑一點才會出現儲存按鈕」。
//
// ⚠️ **這兩條守的是「內容塞得進一屏」，不是 iOS 那個視口機制。** 反向驗證過：
// 把 sheet 的 max-height/overflow 拿掉，這兩條**照樣綠** —— 因為 headless
// Chromium 的版面視口就等於視覺視口，而 iOS 的病灶正是「fixed 相對版面視口定位，
// 而 in-app 瀏覽器的工具列把視覺視口壓小」，那個差異在這裡根本重現不了。
// 真正被守住的是**根因**：收束頁在 in-app 瀏覽器的實際高度（≈660px）要一屏放得下。
// （拿掉短視窗壓縮的 media query，第二條會紅 —— 那條驗證過。）
// sheet 的 max-height/overflow 是給更矮的視口（橫向、放大字級）的保險，
// 那一層只有實機能驗。
await page.setViewportSize({ width: 390, height: 660 });
await page.waitForTimeout(400);
const save = await page.evaluate(() => {
  const btn = document.getElementById('btnResultSave');
  const r = btn.getBoundingClientRect();
  const sheet = document.getElementById('resultSheet');
  return {
    完全可見: r.top >= 0 && r.bottom <= window.innerHeight,
    需捲動: sheet.scrollHeight - sheet.clientHeight,
  };
});
check('短視窗(660px)下儲存鈕完全可見（不必先捲動）', save.完全可見, true);
check('短視窗(660px)下收束頁一屏放得下', save.需捲動, 0);

// ── 端到端：決策真的接到正式站的結果頁 ──
//
// founder 2026-08-09：「怎麼接到正式站的結果頁」。查出來的是 —— 管線早就通了
// （兩邊共用 `tenki.alert.outcomes.v1`），但兩端講不同方言：decision-alert 寫
// 新語意 `judged_entered`，而 /v3/ 的 `isDisciplinedV6()` 只認舊的
// `stayed_disciplined` / `timed_out` → **demo 裡 100%，進到 /v3/ 變 0%**。
//
// 這一組是**真的端到端**，不是分開驗兩邊：Playwright 同一個 context ＝ 同源
// ＝ 共用 localStorage，跟正式站上兩頁同源的情形一致。上面那次決策已經寫進
// store，這裡直接開 /v3/#session 讀它算出來的對齊率。
//
// 反向驗證過：把 isDisciplinedV6 改回只認舊 tag → 對齊率變 0%，這條會紅。
{
  // 先真的按下「記錄並關閉」—— 決策要**被記錄**才會進統一 store。
  // （這一步先前的 harness 沒做過，所以 store 一直是空的。）
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.click('#btnResultSave');
  await page.waitForTimeout(500);

  const stored = await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')) || [];
    return all[all.length - 1] || {};
  });
  check('決策寫進統一 store，用的是新語意 tag', stored.outcomeTag, 'judged_entered');
  check('紀錄標了來源（Session 頁才分得出從哪個入口來）', stored.source, 'alert');

  // 收束之後要有路可走 —— 刻意在事件鏈那一層，不佔收束頁高度。
  const linkHref = await page.evaluate(() => {
    const a = document.querySelector('#logList .log-link');
    return a ? a.getAttribute('href') : null;
  });
  check('收束後留下通往決策紀錄的路', linkHref, '/v3/#session');

  // 直接把同一個分頁導到 /v3/ —— 同源，localStorage 跟著走，
  // 與正式站上「走完 demo 再開 /v3/」是同一件事。
  await page.goto(`${base}/v3/#session`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const session = await page.evaluate(() => ({
    align: document.getElementById('statAlign').textContent.trim(),
    count: document.getElementById('statCount').textContent.trim(),
  }));
  check('🔴 /v3/ Session 認得快訊決策（對齊率不是 0%）', session.align, '100%');
  check('/v3/ Session 看得到那筆決策', session.count, '1');
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);

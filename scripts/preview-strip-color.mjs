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
  // ⚠️ 這幾條 rewrite 正式站是 vercel.json 在做，本地伺服器要自己補，
  // 而且要**照抄**（含 `(.*)` 那一條），不能只補剛好被斷言用到的路徑。
  //
  // 犯過兩次，都是靜默 404：
  // 1. 少了 `/preview/*` → decision-alert.html 載的 readiness-scan.js /
  //    decision-outcome.js 一直 404，頁面看起來照樣正常（那些模組當時沒被斷言
  //    用到），直到 decision-alert.js 改成硬相依 window.TENKI_OUTCOME 才爆出來。
  // 2. 只補了 `/v3/` 這一個**完全比對**、少了 `/v3/(.*)` → /v3/ 頁面自己的
  //    stardust-scan-takeover.css 404，而那支 CSS 裡有
  //    `#stardust-scan-takeover:not(.active){visibility:hidden}` ——
  //    於是掃描 takeover 整層蓋在 Session 上，截圖看起來像產品壞了。
  //    **差點照著假畫面去修沒壞的東西。**
  // 靜默 404 的測試環境比沒有測試更糟。
  if (clean.startsWith('/preview/')) clean = '/apps' + clean;
  if (clean === '/v3' || clean === '/v3/') clean = '/apps/preview/v6/index.html';
  else if (clean.startsWith('/v3/')) clean = '/apps/preview/v6/' + clean.slice('/v3/'.length);
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

  // 收束之後要有路可走。事件鏈那條小字保留（它是事件的軌跡），
  // 但**不再是唯一的路** —— 見下面的動作列。
  const linkHref = await page.evaluate(() => {
    const a = document.querySelector('#logList .log-link');
    return a ? a.getAttribute('href') : null;
  });
  check('收束後留下通往決策紀錄的路', linkHref, '/v3/#session');

  // ── 交接要看得見（founder 2026-08-09：「好像不想讓人知道似的」） ──
  // 先前唯一的出口是事件鏈裡一列小字。動作列是 flex + .btn{flex:1}，
  // 第二顆按鈕的高度成本是零，所以「不佔高度」從來就不是理由。
  // ⚠️ 只數**看得見的**。第一版數 DOM 節點，反向驗證時我把第二顆留在 DOM 裡設
  // display:none，這條照樣綠 —— 一顆看不見的按鈕正是這一刀要消滅的東西。
  const actions = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#resultSheet .sheet-actions .btn')]
      .filter((b) => b.getBoundingClientRect().width > 0);
    return btns.map((b) => ({ id: b.id, text: b.textContent.trim(), primary: b.classList.contains('btn-primary') }));
  });
  check('收束頁動作列有兩顆看得見的按鈕', actions.length, 2);
  check('第二顆是主動作「查看決策紀錄」',
    actions[1] && actions[1].text === '查看決策紀錄' && actions[1].primary, true);
  // 「紀律近況」本來就是決策紀錄的預覽 —— 它要說得出自己是什麼。
  const previewLabel = await page.textContent('#resultHistory .result-block-label');
  check('紀律近況說得出它就是決策紀錄', /決策紀錄/.test(previewLabel || ''), true);

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

  // ── 這筆紀錄要**認得出自己是誰** ──
  //
  // ⚠️ 上一刀的教訓：我修好 isDisciplined 讓對齊率變 100%，就宣告「接通了」。
  // **一個數字對了不等於這筆紀錄被認得。** 同一筆決策當時在 Session 頁長這樣：
  //     ❤️ ES1!  ·  15:23 · 未達 Readiness · 0:04  ·  [已記錄]
  // 四處都錯，而且**沒有一處會報錯** —— 全是 `|| fallback`。
  // 所以斷言要從「百分比對」推進到「這筆紀錄長得對」。
  const row = await page.evaluate(() => {
    const it = document.querySelector('#sessionList .session-item');
    if (!it) return null;
    const badge = it.querySelector('.result');
    return {
      name: it.querySelector('.nm').textContent.trim(),
      meta: it.querySelector('.meta').innerText,
      iconColor: getComputedStyle(it.querySelector('.tmpl-ic')).color,
      badgeText: badge.textContent.trim(),
      badgeCls: badge.className,
    };
  });
  check('Session 列顯示流程名，不是 symbol fallback', row && row.name, 'Mancini FBD');
  // FBD 的模板色 #5E3A87；fallback 是 #8E8E93 灰。
  check('圖示是模板色，不是 fallback 灰', row && row.iconColor, 'rgb(94, 58, 135)');
  check('圖示不是 fallback 的灰', row && row.iconColor !== 'rgb(142, 142, 147)', true);

  // 🔴 誠實紅線：快訊決策沒有 `reachedReadiness` 這個量，
  // 先前 `undefined` 落進 else 分支 → 對一次**判定成立並進場**的決策印「未達」。
  // 那不是排版瑕疵，是謊報。缺欄位就報別的真事實。
  check('🔴 列上不得出現「未達」（這筆根本沒有 readiness 這個量）',
    row && /未達/.test(row.meta), false);
  check('缺欄位時報的是真事實（來源）', row && /快訊決策/.test(row.meta), true);

  check('badge 認得新語意，不是 fallback「已記錄」', row && row.badgeText, '判定成立');
  check('badge 樣式不是 fallback 的 breakeven', row && /\bwin\b/.test(row.badgeCls), true);

  // Timeline 的點：fallback 是 var(--txt-sec) 灰。
  await page.evaluate(() => window.goTab('timeline'));
  await page.waitForTimeout(900);
  const dot = await page.evaluate(() => {
    const c = document.querySelector('#tlStripContent .tl-dot');
    const e = document.querySelector('#tlEventLog .tl-event .desc');
    return { fill: c ? c.getAttribute('fill') : null, desc: e ? e.textContent.trim() : null };
  });
  check('Timeline 的點有 outcome 顏色，不是 fallback 灰', dot.fill, 'var(--good)');
  check('Timeline 那一列認得出流程與結果', dot.desc, 'Mancini FBD · 判定成立 · 已進場');

  // ══════════════════════════════════════════════════════════════════
  // 🔴 /v3/ Today：畫面不得宣稱沒量到的事
  //
  // 那四張 vitals 卡（Cardiac / Respiration / Autonomic / Energy）的數字
  // 全部由 Math.sin 產生 —— 心率、HRV、呼吸沒有感測器就量不到，目前沒接。
  // 卡頭原本寫 Live / Synced 並用 --good 綠，那是拿動畫在宣稱事實。
  //
  // ⚠️ 這裡每一條都要**同時**問「壞東西不在」與「好東西在」：
  // 只問「Live 不在」的話，頁面沒載成功時它照樣綠。
  // ══════════════════════════════════════════════════════════════════
  await page.evaluate(() => window.goTab('today'));
  await page.waitForTimeout(600);

  const today = await page.evaluate(() => {
    // ⚠️ 「有沒有版面」跟「看不看得到」是兩件事。**遮擋不會改變 bounding rect** ——
    // 這一行原本被固定在底部的 FDCB 底座整片蓋住，只量 rect 的版本照樣綠，
    // 是本機截圖才抓到的。所以再問一次 elementFromPoint：那個點上最上層的元素，
    // 必須就是它自己（或它的子孫）。
    const vis = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0) || getComputedStyle(el).visibility === 'hidden') return false;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && el.contains(top);
    };
    const cards = Array.from(document.querySelectorAll('#snapTrack .vcard'));
    const badges = Array.from(document.querySelectorAll('#snapTrack .metric-status'));
    const note = document.querySelector('.vitals-demo-note');
    return {
      cardCount: cards.length,
      // 每一張卡都必須自己帶著標記 —— 不能只有第一張帶、其他張沒帶
      everyCardMarked: cards.length > 0
        && cards.every((c) => /示意/.test(c.querySelector('.metric-status')?.textContent ?? '')),
      badgeTexts: badges.map((b) => b.textContent.trim()),
      // 標記自己的顏色也不能宣稱事實（綠 = --good、琥珀 = --warn、金 = SECURED）
      badgeColors: badges.map((b) => getComputedStyle(b).color),
      trackText: document.getElementById('snapTrack')?.innerText ?? '',
      noteVisible: vis(note),
      // 說明搬到圓點上方時，把圓點擠到底座下面去了 —— 一個修好換來另一個壞掉。
      // 兩個都鎖住，才不會下次又用其中一個換另一個。
      dotsVisible: vis(document.getElementById('snapDots')),
      noteText: note?.textContent ?? '',
      nsStatus: document.getElementById('nsStatus')?.textContent.trim() ?? '',
      // Hero 的分數槽與它的標籤要一致
      heroScore: document.getElementById('edgeScoreReveal')?.textContent.trim() ?? '',
      heroLabel: document.querySelector('.tl-edge-pr')?.textContent.trim() ?? '',
      fdcbSeg: document.getElementById('fdcbSeg')?.textContent.trim() ?? '',
      // ⚠️ 這一格踩了兩次才對：
      //   `innerText` → FDCB 那顆膠囊在 Today 分頁沒有算版面，讀不到它，
      //     反向驗證時把 'Edge Score · 72' 塞回去**沒有紅**（斷言是死的）。
      //   `textContent` → 連 <script> 的原始碼都算進來，我自己那句
      //     「這裡本來寫死 'Edge Score · 72'」的註解**讓它紅了**（斷言太寬）。
      // 要的是「所有 markup 的文字，含目前沒顯示的」→ 複製一份、把 script/style 拔掉。
      bodyText: (() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script,style').forEach((n) => n.remove());
        return clone.textContent;
      })(),
    };
  });

  check('Today 真的載到那四張示意卡（前提，不然下面幾條會空過）', today.cardCount, 4);
  check('🔴 每一張示意卡都自己帶著「示意」標記', today.everyCardMarked, true);
  check('🔴 卡頭不得再宣稱 Live', /\bLive\b/.test(today.trackText), false);
  check('🔴 卡頭不得再宣稱 Synced', /Synced/.test(today.trackText), false);
  // --good 是 #34C759 → rgb(52, 199, 89)；--warn #F5A623 → rgb(245, 166, 35)
  check('🔴 示意標記不得吃已被指派意義的顏色（綠=good／琥珀=warn）',
    today.badgeColors.some((c) => c === 'rgb(52, 199, 89)' || c === 'rgb(245, 166, 35)'), false);
  check('說明那一行看得見（給停下來看的人）', today.noteVisible, true);
  check('輪播圓點沒有被底座蓋掉（修一個不得換壞另一個）', today.dotsVisible, true);
  check('說明講的是真原因（需要感測器、尚未接上）',
    /感測器/.test(today.noteText) && /尚未接上/.test(today.noteText), true);
  // 「**在**綠色安全區」是對使用者神經系統下的判定；只報區段名稱不是。
  check('🔴 神經系統那行不得對使用者下判定（不以「在」開頭）',
    /^在/.test(today.nsStatus), false);
  check('神經系統那行仍然報得出區段（不是整行消失）',
    /安全區|陷落區|警戒區/.test(today.nsStatus), true);

  check('🔴 頁面上不得出現寫死的 Edge Score · 72',
    /Edge Score\s*·\s*72/.test(today.bodyText), false);
  check('🔴 沒有讀數時 FDCB 不得報一個分數', today.fdcbSeg, '尚無讀數');
  // 🔴 這一條原本比對字面的 '—'。#231 把無讀數狀態設計成「尚未量測」（那是更好的
  // 文案 —— 它說出了正在發生的事），但沒回頭改這條斷言，於是 **main 自己一路紅著**
  // 44/45 沒人發現：本 harness 不在 verify.sh／CI 裡（Playwright 容器限定路徑），
  // 它不會自己喊痛。PLAYBOOK 早就寫過這個盲區，這次是它真的發生。
  // 改成問**意圖**而不是問字形：這一格不准出現任何數字（那才是「契約上沒有分數」
  // 這條紅線真正要守的東西），而且必須有話說、不能整格空白。
  check('🔴 Hero 分數槽不得出現任何數字（契約上就沒有 0-100 分）',
    /\d/.test(today.heroScore), false);
  check('Hero 分數槽有話說（不是整格空白）', today.heroScore.trim().length > 0, true);
  check('🔴 Hero 標籤跟槽裡的東西一致（不掛 Edge Score）', today.heroLabel, '狀態讀數');
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);

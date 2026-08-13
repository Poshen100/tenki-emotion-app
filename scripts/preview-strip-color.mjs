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
import { readFile } from 'node:fs/promises';
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
  check('Hero 分數槽是空的（契約上就沒有 0-100 分）', today.heroScore, '—');
  check('🔴 Hero 標籤跟槽裡的東西一致（不掛 Edge Score）', today.heroLabel, '狀態讀數');

  // ══════════════════════════════════════════════════════════════════
  // 🔴 掃描儀式不得宣稱沒有發生的量測
  //
  // takeover 那支原本寫「按住指紋感測器，啟動 8 秒 3D 生理與情緒基線同步」：
  // 那顆鈕是 <div>+SVG（不讀指紋、不讀 PPG）、沒有生理量測、沒有情緒量測。
  // 「情緒」措辭另外違反 SOUL-SCAN-NORTH-STAR §7（App Store 4.2 / 隱私審查）。
  // ══════════════════════════════════════════════════════════════════
  const claims = await page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style').forEach((n) => n.remove());
    return clone.textContent;
  });
  check('🔴 不得宣稱讀指紋感測器（那顆鈕不讀任何生物特徵）',
    /指紋感測器/.test(claims), false);
  check('🔴 不得宣稱做生理量測（沒有心率、沒有 rPPG）',
    /生理與情緒|生理基線/.test(claims), false);
  check('🔴 不得宣稱偵測情緒（合規紅線，非文字風格問題）',
    /情緒基線|情緒偵測|情緒辨識/.test(claims), false);
  check('🔴 不得掛 BIOMETRIC 字樣（宣稱生物特徵量測與同步）',
    /BIOMETRIC/i.test(claims), false);
}

// ══════════════════════════════════════════════════════════════════
// 🔴 /preview/reliability.html —— 量測重複性自測（儀器自測，不是讀數）
//
// 這一頁的價值全繫於「它不能假裝知道」：缺資料要說未取得、不能顯示帶位、
// 不能讓人以為同場離散度本身就是結論。
// ══════════════════════════════════════════════════════════════════
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/preview/reliability.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // 🔴 鏡像對照：preview 是無建置的 vanilla JS，沒辦法 import domain 的
  // TypeScript，所以 personSignalComposite 被鏡像了一份 —— 兩個來源，
  // 正是 PLAYBOOK §6 咬過三次的 bug 類別。這裡拿同一組輸入比對兩邊。
  // 改任一邊而不改另一邊，這條就會紅。
  const mirrored = await page.evaluate(() => {
    const f = window.TENKI_RELIABILITY.personSignalComposite;
    return [
      f({ stillness: 0.72, blinkCadence: null }),
      f({ stillness: 1, blinkCadence: 0 }),
      f({ stillness: 0.5, blinkCadence: 0.5 }),
      f({ stillness: 5, blinkCadence: null }),
      f({ stillness: -5, blinkCadence: null }),
    ].map((v) => Math.round(v * 1e6) / 1e6);
  });
  // domain/src/policies/baseline-score.ts 的公式（0.6 / 0.4，clamp 到 0..1，
  // blinkCadence 為 null 時退成純 stillness）在同一組輸入下的答案。
  const expected = [0.72, 0.6, 0.5, 1, 0].map((v) => Math.round(v * 1e6) / 1e6);
  check('🔴 preview 的 composite 鏡像與 domain 的實作一致', mirrored, expected);

  // 🔴 「一筆資料的離散度不是 0，是未知」——  這條直接驗那支純函式。
  // 反向驗證發現：只驗畫面的話，把 stdDev 的 null 改成 0 不會紅
  // （畫面那層另有「有效次數不足」的閘擋著），所以這道紀律本身是沒人守的。
  const spread = await page.evaluate(() => {
    const R = window.TENKI_RELIABILITY;
    return {
      sdOne: R.stdDev([0.5]),
      sdNone: R.stdDev([]),
      rangeOne: R.range([0.5]),
      sdTwo: Math.round(R.stdDev([0.4, 0.6]) * 1e6) / 1e6,
      rangeTwo: Math.round(R.range([0.4, 0.6]) * 1e6) / 1e6,
    };
  });
  check('🔴 單筆資料的標準差是 null（未知），不是 0', spread.sdOne, null);
  check('🔴 空資料的標準差是 null，不是 0', spread.sdNone, null);
  check('🔴 單筆資料的全距是 null，不是 0', spread.rangeOne, null);
  check('兩筆資料算得出樣本標準差（n−1）', spread.sdTwo, Math.round(Math.sqrt(0.02) * 1e6) / 1e6);
  check('兩筆資料算得出全距', spread.rangeTwo, 0.2);

  const rl = await page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style').forEach((n) => n.remove());
    return {
      text: clone.textContent,
      withinSd: document.getElementById('rl-within-sd').textContent.trim(),
      withinRange: document.getElementById('rl-within-range').textContent.trim(),
      betweenSd: document.getElementById('rl-between-sd').textContent.trim(),
      rows: document.querySelectorAll('#rl-rows .rl-row').length,
    };
  });

  check('自測頁真的載到（前提，不然下面幾條會空過）', rl.rows, 3);

  // 🔴 沒有任何一次有效掃描時，離散度不得是 0 —— 一筆資料的離散度不是零，是未知。
  check('🔴 沒有資料時同場離散度顯示未取得，不是 0',
    rl.withinSd === '未取得' && rl.withinRange === '未取得', true);
  check('🔴 只有 0 天時跨天離散度也不得編一個數字',
    rl.betweenSd, '未取得');

  // 🔴 這是儀器自測，不是讀數。出現帶位就等於在講使用者的狀態。
  check('🔴 頁面不得出現帶位字樣（clear/neutral/strain）',
    /\bclear\b|\bneutral\b|\bstrain\b/i.test(rl.text), false);

  // 🔴 單看同場離散度會讓人以為儀器很穩 —— 必須明說那證明不了任何事。
  check('🔴 明說單看同場證明不了任何事',
    /單看同場離散度證明不了任何事/.test(rl.text), true);
  check('說得出為什麼中間要放開（不是禮貌，是會低估噪音）',
    /低估/.test(rl.text), true);

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════
// 🔴 face-stillness.js —— 兩支掃描共用的「同一把尺」
//
// Edge Score 是 z 分數，分母是使用者自己的標準差。基線用一種尺度建、讀數用
// 另一種尺度量，分數會看起來完全正常而**默默是錯的** —— 比明顯壞掉危險得多。
// 這一組守的就是「兩邊真的用同一把尺」。
// ══════════════════════════════════════════════════════════════════
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/preview/reliability.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const fs = await page.evaluate(() => {
    const S = window.TENKI_FACE_STILLNESS;
    if (!S) return null;
    // 質心 vs bbox 中心會分岔的形狀：右半邊點特別密。
    const lm = [
      { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 },
      { x: 0.75, y: 0.75 }, { x: 0.78, y: 0.72 }, { x: 0.76, y: 0.79 },
    ];
    const box = S.faceBox(lm);
    const c = S.boxCenter(box);
    const centroid = {
      x: lm.reduce((a, p) => a + p.x, 0) / lm.length,
      y: lm.reduce((a, p) => a + p.y, 0) / lm.length,
    };
    const t = S.createTracker();
    const first = t.feed(lm, 1000);
    const second = t.feed(lm, 1180); // 完全沒動
    const moved = S.stillnessBetween({ x: 0.5, y: 0.5 }, { x: 0.5 + 0.35 * 0.18, y: 0.5 }, 180);
    return {
      ceiling: S.LANDMARK_MOTION_CEILING,
      center: [Math.round(c.x * 1e6) / 1e6, Math.round(c.y * 1e6) / 1e6],
      centroidDiffers: Math.abs(c.x - centroid.x) > 1e-6,
      first,
      second,
      movedBelowOne: moved < 1,
      emptyMean: S.createTracker().mean(),
      noBox: S.faceBox([]),
    };
  });

  check('face-stillness 有載到（前提）', fs !== null, true);
  check('位移上限是兩邊共用的 0.35', fs.ceiling, 0.35);
  // 🔴 用 bbox 中心而不是質心 —— 質心會被密集區拉偏，兩邊必須挑定同一種。
  check('🔴 中心取的是 bbox 而不是質心', fs.center, [0.5, 0.5]);
  check('這組輸入下質心確實會不一樣（不然上一條驗不到東西）', fs.centroidDiffers, true);
  // 🔴 第一幀沒有前一幀可比 —— 那是「未知」不是「完全靜止」。
  check('🔴 第一幀回 null 而不是 1（沒有位移可算 ≠ 完全靜止）', fs.first, null);
  check('沒動的第二幀 stillness 是 1', fs.second, 1);
  check('有位移時 stillness 掉下來', fs.movedBelowOne, true);
  check('🔴 一幀都沒有時平均是 null，不是 0', fs.emptyMean, null);
  check('沒有特徵點時回 null，不是一個空盒子', fs.noBox, null);

  // 🔴 分段量測的連續性：enrollment 收 neutral(3.6s) + stability(3.2s)，
  // 中間隔著 4.2 秒的轉頭。不切斷連續性的話，續接後第一幀會拿現在的位置去跟
  // 空窗前的位置相減 —— 那段根本沒在看，算出來的位移是憑空的。
  // ⚠️ 而且它不長得像壞掉：dt 很大 → 速度很小 → stillness 逼近 1 →
  // **默默灌一個假滿分進平均**。
  const cont = await page.evaluate(() => {
    const F = window.TENKI_FACE_STILLNESS;
    const lm = (x) => [{ x, y: 0.5 }, { x: x + 0.2, y: 0.7 }];
    const run = (breakIt) => {
      const t = F.createTracker();
      let ms = 1000;
      t.feed(lm(0.40), ms);
      for (let i = 0; i < 5; i += 1) { ms += 100; t.feed(lm(0.40), ms); }
      if (breakIt) t.breakContinuity();
      ms += 4200;                       // 轉頭那 4.2 秒沒有餵
      const first = t.feed(lm(0.55), ms); // 位置也變了
      return { first, mean: t.mean(), n: t.count() };
    };
    const withBreak = run(true);
    const noBreak = run(false);
    // t=0 起算也要算得到（舊版把 lastAt===0 當成「沒有前一幀」）
    const fromZero = F.createTracker();
    fromZero.feed(lm(0.4), 0); fromZero.feed(lm(0.4), 100);
    return { withBreak, noBreak, zeroCount: fromZero.count() };
  });
  check('🔴 切斷連續性後，續接的第一幀不進平均（回 null）', cont.withBreak.first, null);
  check('🔴 切斷連續性後，平均不被空窗那一幀污染', cont.withBreak.mean, 1);
  // 反向對照：不切斷時**確實**會生出一個看起來很合理的假分數，
  // 否則上面兩條是空過的。
  check('不切斷時確實會憑空生出一筆（不然上兩條驗不到東西）',
    cont.noBreak.first !== null && cont.noBreak.first > 0.8, true);
  check('🔴 breakContinuity 只忘掉位置，不清掉已累積的幀數', cont.withBreak.n, 5);
  // ⚠️ `lastAt === 0` 是 falsy —— 舊版拿它當「有沒有前一幀」的旗標，
  // 時間戳為 0 的那一幀之後那筆量測會整個消失。
  check('🔴 時間戳從 0 起算也算得到量測', cont.zeroCount, 1);

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════
// 🔴 baseline-store —— Measurement Profile 分池與計分門檻
//
// founder 2026-08-12：「不能把 2 秒臉部掃描與 60 秒深度掃描放進同一個百分位
// 池裡比較。」短窗的 stillness 平均本來就比長窗離散，混池會**系統性灌大標準差
// → 分數全體往 50 收，而且看起來完全正常** —— 比明顯壞掉危險得多，
// 所以這一段是本刀最需要被守住的東西。
// ══════════════════════════════════════════════════════════════════
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/preview/reliability.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const store = await page.evaluate(() => {
    const S = window.TENKI_BASELINE_STORE;
    const P = S.PROFILES;
    const DAILY = P.DAILY_SCAN_FRAME;      // tier B 池（founder 實走都落這裡）
    const DAILY_A = P.DAILY_SCAN_LANDMARK; // tier A 池 —— 與上面**不可比**
    const DAY = 86_400_000;
    const t0 = new Date(2026, 0, 5, 12, 0, 0).getTime();
    const reset = () => { S.clear(); localStorage.removeItem(S.LEGACY_SEED_KEY); };

    // 分池：兩種 profile 各寫一筆，各自的統計量不得看見對方。
    reset();
    S.appendSample({ profile: DAILY, composite: 0.90, ts: t0 });
    S.appendSample({ profile: P.ENROLL_NEUTRAL, composite: 0.10, ts: t0 });
    const dailyMean = S.statsFor(DAILY).mean;
    const dailyCount = S.statsFor(DAILY).sampleCount;
    const totalCount = S.allSamples().length;

    // 同 profile 同一天：後寫覆蓋，樣本數不增加。
    reset();
    S.appendSample({ profile: DAILY, composite: 0.30, ts: t0 });
    S.appendSample({ profile: DAILY, composite: 0.80, ts: t0 + 3 * 3600_000 });
    const sameDayCount = S.statsFor(DAILY).sampleCount;
    const sameDayValue = S.samplesFor(DAILY)[0].composite;

    // 門檻：樣本夠但天數不夠 → 仍然沒有分數。
    const build = (n, days) => {
      reset();
      for (let i = 0; i < n; i += 1) {
        S.appendSample({ profile: DAILY, composite: 0.5 + (i % 5) * 0.02, ts: t0 + i * DAY });
      }
      // 全部塞進 `days` 天內（覆蓋規則會讓樣本數降到 days，所以另走一條路：
      // 直接寫入不同時刻但同幾天，樣本數會等於 days）
      if (days !== undefined) {
        reset();
        for (let i = 0; i < days; i += 1) {
          S.appendSample({ profile: DAILY, composite: 0.5 + (i % 5) * 0.02, ts: t0 + i * DAY });
        }
      }
      return S.samplesFor(DAILY);
    };
    const at29 = S.personalScore(0.6, build(29));
    const at40 = S.personalScore(0.6, build(40));

    // 鏡像對照用的固定序列（下面拿去跟 domain 的答案比）。
    const fixture = [];
    for (let i = 0; i < 40; i += 1) {
      fixture.push({ ts: t0 + i * DAY, composite: 0.40 + (i % 8) * 0.02 });
    }
    const mirror = [0.30, 0.44, 0.46, 0.52, 0.90].map((v) => S.personalScore(v, fixture));

    reset();
    return {
      dailyMean, dailyCount, totalCount,
      sameDayCount, sameDayValue,
      at29, at40, mirror,
      minSamples: S.MIN_SAMPLES_FOR_SCORE, minDays: S.MIN_DAYS_FOR_SCORE,
    };
  });

  // 🔴 tier A 與 tier B 量的不是同一個東西（landmark 位移 vs 整幀 luma 差分），
  // 不得共用百分位池。founder 2026-08-12 實走三次全落 tier B 才暴露出來 ——
  // readiness-scan 的 buildEvidence 在**一次掃描之內**守住了這條，
  // 跨掃描的池卻沒有人守。
  const tiers = await page.evaluate(() => {
    const S = window.TENKI_BASELINE_STORE, P = S.PROFILES;
    const t0 = new Date(2026, 0, 5, 12, 0, 0).getTime();
    S.clear(); localStorage.removeItem(S.LEGACY_SEED_KEY);
    S.appendSample({ profile: S.dailyProfileForTier('A'), composite: 0.20, tier: 'A', ts: t0 });
    S.appendSample({ profile: S.dailyProfileForTier('B'), composite: 0.90, tier: 'B', ts: t0 });
    // ⚠️ null-safe：路由壞掉時某一池會是空的，`statsFor` 回 null。
    // 直接讀 `.mean` 會**擲錯而不是報紅** —— 那會中斷後面所有斷言，
    // 而且輸出是堆疊而不是「哪一條規則被違反」。反向驗證當場踩到。
    const meanOf = (p) => { const st = S.statsFor(p); return st === null ? 'EMPTY_POOL' : st.mean; };
    const out = {
      sameProfile: P.DAILY_SCAN_LANDMARK === P.DAILY_SCAN_FRAME,
      aMean: meanOf(P.DAILY_SCAN_LANDMARK),
      bMean: meanOf(P.DAILY_SCAN_FRAME),
      routeA: S.dailyProfileForTier('A'),
      routeB: S.dailyProfileForTier('B'),
    };
    S.clear();
    return out;
  });
  check('🔴 tier A 與 tier B 是兩個不同的池', tiers.sameProfile, false);
  check('🔴 tier A 的統計量看不到 tier B 的樣本', tiers.aMean, 0.2);
  check('🔴 tier B 的統計量看不到 tier A 的樣本', tiers.bMean, 0.9);
  check('tier 路由真的分流', tiers.routeA !== tiers.routeB, true);

  // 🔴 這一條是本刀的核心防線。混池時 dailyMean 會變成 0.5（0.9 與 0.1 的平均）。
  check('🔴 分池：日常掃描的統計量看不到 enrollment 那一池', store.dailyMean, 0.9);
  check('🔴 分池：日常掃描只算得到自己那一筆', store.dailyCount, 1);
  check('兩池的樣本都真的存進去了（不然上面兩條是空過的）', store.totalCount, 2);

  // 🔴 連掃共用姿勢、光線與狀態，當成獨立樣本會灌爆分母。
  check('🔴 同 profile 同一天只留一筆', store.sameDayCount, 1);
  check('同一天留的是後寫的那一筆', store.sameDayValue, 0.8);

  check('🔴 樣本未達門檻時沒有分數（回 null，不是一個像真的的數字）', store.at29, null);
  check('達到門檻後才給得出分數', typeof store.at40 === 'number', true);
  check('門檻本身沒有被放寬', [store.minSamples, store.minDays], [30, 7]);

  // 🔴 端到端鏡像對照：不只比 composite，連門檻、統計量與常態曲線都在比對範圍內。
  // domain/src/policies/baseline-score.ts 對同一組輸入的答案（見同名 jest 測試）。
  const { personalScore } = await import('../domain/src/policies/baseline-score.ts')
    .catch(() => ({ personalScore: null }));
  if (personalScore) {
    const DAY = 86_400_000;
    const t0 = new Date(2026, 0, 5, 12, 0, 0).getTime();
    const fixture = [];
    for (let i = 0; i < 40; i += 1) fixture.push({ ts: t0 + i * DAY, composite: 0.40 + (i % 8) * 0.02 });
    const domainAnswers = [0.30, 0.44, 0.46, 0.52, 0.90].map((v) => personalScore(v, fixture));
    check('🔴 preview 的 personalScore 鏡像與 domain 端到端一致', store.mirror, domainAnswers);
  } else {
    // Node 跑不了 .ts —— 用寫死的期望值當替身，並在 domain 的 jest 測試裡釘住同一組。
    check('🔴 preview 的 personalScore 鏡像與 domain 端到端一致',
      store.mirror, [1, 22, 33, 78, 99]);
  }

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════
// 🔴 Snapshot 示意卡 —— 動效變好時，標記要等量變重
//
// 那四張卡的數字全部由 Math.sin 產生。這一刀讓它們同步、連續、60 秒循環，
// 也就是**更有說服力** —— 所以標記必須同步加重，淨誠實度才不會掉。
// ══════════════════════════════════════════════════════════════════
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/v3/`, { waitUntil: 'load' });
  await page.waitForTimeout(4200); // ⚠️ 要等開場動畫退場，否則 elementFromPoint 讀到 splash

  const demo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#snapTrack .vcard'));
    return {
      count: cards.length,
      allHatched: cards.every((c) => c.classList.contains('demo-card')),
      allLabelled: cards.every((c) => /示意/.test(c.getAttribute('aria-label') || '')),
      noteText: document.querySelector('.vitals-demo-note')?.textContent ?? '',
      splitExists: !!document.getElementById('snsFill'),
      splitHeight: document.getElementById('snsFill')?.getBoundingClientRect().height ?? 0,
    };
  });
  check('四張示意卡都在（前提）', demo.count, 4);
  check('🔴 每一張示意卡都帶得到語意標記（不能只有第一張帶）', demo.allHatched, true);
  check('🔴 每一張示意卡都有給輔助技術的標記', demo.allLabelled, true);
  check('🔴 說明行講出「循環動畫」（動效變好，標記要跟上）',
    /循環動畫/.test(demo.noteText), true);
  // ⚠️ 長條曾經因為少了 flex:none 被 flex column 壓成 0 高 —— 存在不等於看得見。
  check('交感長條真的有高度（不是被 flex 壓成 0）', demo.splitHeight > 0, true);

  // 長條要連續移動：寬度必須每幀都在變。
  // ⚠️ 取樣窗要跨過一整秒。正弦在波峰附近是二階平緩的，取樣窗太短會剛好落在
  // 那裡而讀到幾個相同值 —— 那會變成一條偶爾紅的斷言，比沒有還糟。
  // 6 秒一息、取樣 8×140ms ≈ 1.1s，即使正對波峰，振幅也走掉約 7%。
  const widths = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 8; i += 1) {
      out.push(document.getElementById('snsFill').style.width);
      await new Promise((r) => setTimeout(r, 140));
    }
    return out;
  });
  check('🔴 交感長條每幀都在動（不是 1Hz 跳一格）', new Set(widths).size >= 4, true);

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════
// 🔴 60 秒循環：接縫必須接得回去
//
// ⚠️ 這裡不驗「t 與 t+60000 相同」—— ph 是用 `t % LOOP_MS` 算的，那個等式
// **恆成立**，連壞掉的乘數都會通過（2026-08-12 寫錯過一次）。
// 真正的性質是接縫連續：`sin(k·ph)` 走 k×10 圈，k 必須是 0.1 的倍數。
// ══════════════════════════════════════════════════════════════════
{
  const src = await readFile(resolve(repoRoot, 'apps/preview/v6/index.html'), 'utf8');
  const loopStart = src.indexOf('function loop(t){');
  const loopEnd = src.indexOf('requestAnimationFrame(loop);', loopStart + 40);
  const body = src.slice(loopStart, loopEnd);
  check('找得到 living-vitals 迴圈（前提）', loopStart > 0 && loopEnd > loopStart, true);
  check('迴圈長度是宣告出來的 60 秒', /LOOP_MS\s*=\s*60000/.test(src), true);

  // 抓出所有 `ph*<數字>` 的乘數，檢查每一個都是 0.1 的倍數。
  const multipliers = [...body.matchAll(/ph\s*\*\s*([0-9]*\.?[0-9]+)/g)].map((m) => Number(m[1]));
  const offenders = multipliers.filter((k) => Math.abs(k * 10 - Math.round(k * 10)) > 1e-9);
  check('迴圈裡真的有取到乘數（不然下一條是空過的）', multipliers.length >= 4, true);
  check('🔴 每個 ph 乘數都是 0.1 的倍數（接縫才接得回去）', offenders, []);

  check('🔴 說明行同時保留「為什麼沒有」的真原因',
    /感測器/.test(src) && /尚未接上/.test(src), true);
}

// ══════════════════════════════════════════════════════════════════
// 🔴 訊號不足那條路不得寫入基線樣本
//
// 用一次失敗的量測去定義使用者的常態，而且它會**永遠**留在分母裡。
// harness 沒有相機，跑不到 finalize()/giveUp()，所以這條驗結構：
// giveUp 的函式體裡不得出現任何寫入。
// ══════════════════════════════════════════════════════════════════
{
  const src = await readFile(resolve(repoRoot, 'apps/preview/readiness-scan.js'), 'utf8');
  const gs = src.indexOf('function giveUp()');
  const ge = src.indexOf('function tick()', gs);
  const giveUpBody = src.slice(gs, ge);
  check('找得到 giveUp（前提）', gs > 0 && ge > gs, true);
  check('🔴 giveUp 不寫入基線樣本', /saveBaselineSample|appendSample/.test(giveUpBody), false);

  const fs2 = src.indexOf('function finalize()');
  const fe2 = src.indexOf('function giveUp()', fs2);
  check('🔴 finalize（有讀數那條）才寫入',
    /saveBaselineSample\(/.test(src.slice(fs2, fe2)), true);

  // 🔴 enrollment 只收「要求靜止」的階段。arc 要求轉頭，收進來等於把
  // 「你有沒有照指示做」當成「你今天怎麼樣」。harness 沒有相機跑不到 FSM，
  // 所以驗那份白名單本身。
  const enroll = await readFile(resolve(repoRoot, 'apps/preview/soul-enroll.js'), 'utf8');
  const listed = /const STILL_TASK_STEPS = new Set\(\[([^\]]*)\]\)/.exec(enroll);
  const steps = listed ? listed[1].match(/'[^']+'/g).map((s) => s.slice(1, -1)).sort() : null;
  check('🔴 靜止段白名單就是 neutral + stability（不多不少）',
    steps, ['neutral_capture', 'stability_pass']);
  check('🔴 arc 永遠不得進基線', steps !== null && steps.some((s) => /arc/.test(s)), false);
  check('🔴 離開靜止段要切斷連續性（否則跨空窗會憑空生一筆滿分）',
    /breakContinuity\(\)/.test(enroll), true);
  // sampleConfidence 的七項加權先前只收斂成一個字，數值整個丟掉。
  check('擷取品質有被存下來（不再丟掉）', /confSum \/ state\.confN/.test(enroll), true);

  // 🔴 納入欄只能列真的有值的欄位 —— 純函式，直接餵。
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/preview/reliability.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const inputs = await page.evaluate(() => {
    const V = window.TENKI_READINESS_SCAN.verdictInputs;
    const base = { stillness: 0.8, lighting: 0.9, uniformity: 0.8, tier: 'A' };
    return {
      withBlink: V({ ...base, blinkCadence: 0.7 }),
      noBlink: V({ ...base, blinkCadence: null }),
      tierB: V({ ...base, blinkCadence: null, tier: 'B' }),
    };
  });
  check('🔴 blinkCadence 為 null 時不得列進「本次納入」',
    inputs.noBlink.included.some((s) => /眨眼/.test(s)), false);
  check('🔴 而且必須出現在「本次未納入」（是落下去，不是消失）',
    inputs.noBlink.excluded.some((s) => /眨眼/.test(s)), true);
  check('有值時才列進納入', inputs.withBlink.included.some((s) => /眨眼/.test(s)), true);
  // ⚠️ Tier B 走整幀啟發式，那條路上根本沒有臉部特徵點。
  check('🔴 Tier B 不得出現「臉部特徵點」字樣',
    inputs.tierB.included.some((s) => /臉部特徵點/.test(s)), false);
  check('🔴 量不到的東西一律在未納入（心率／HRV）',
    inputs.withBlink.excluded.some((s) => /HRV/.test(s)), true);
  check('🔴 未納入的理由不得寫成「即將開放」那種承諾',
    inputs.withBlink.excluded.some((s) => /即將|敬請期待|即將開放/.test(s)), false);
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════
// 🔴 基線未成熟時，環心不得出現任何 1-99 數字
//
// 「基線太薄」與「沒有訊號」是同一件事：兩者都代表這個數字不成立。
// 同一個大字換一行小字，使用者只會讀數字。
// ══════════════════════════════════════════════════════════════════
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const seed = (n) => `(() => {
    const S = window.TENKI_BASELINE_STORE, P = S.PROFILES;
    S.clear(); localStorage.removeItem(S.LEGACY_SEED_KEY);
    const DAY = 86400000, now = Date.now();
    for (let i = 0; i < ${n}; i++) {
      // 🔴 tier A 的樣本必須進 landmark 池；環讀的也是讀數 tier 對應的那一池。
      S.appendSample({ profile: P.DAILY_SCAN_LANDMARK, composite: 0.5 + (i % 7) * 0.02,
        quality: 0.8, tier: 'A', ts: now - (${n} - i) * DAY });
    }
    localStorage.setItem('tenki.readiness.reading.v1', JSON.stringify({
      band: 'clear', confidence: 'high', ts: now,
      evidence: { stillness: 0.86, lighting: 0.9, uniformity: 0.9, blinkCadence: null, tier: 'A' },
    }));
  })()`;

  const state = async (n) => {
    await page.goto(`${base}/v3/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(seed(n));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    return page.evaluate(() => ({
      centre: document.getElementById('edgeScoreReveal').textContent.trim(),
      line: document.getElementById('edgeTraceZone').textContent.trim(),
      gold: document.getElementById('baselineRingFill').classList.contains('mature'),
      // ⚠️ 值對不等於看得見 —— 這條環曾經整個被 `.tl-edge svg{display:none}` 關掉。
      ringVisible: document.getElementById('baselineRing').getBoundingClientRect().width > 0,
    }));
  };

  const thin = await state(12);
  check('🔴 基線未成熟時環心不得出現數字', /^\d+$/.test(thin.centre), false);
  check('未成熟時環心報的是帶位詞', /Clear|Neutral|Strain/i.test(thin.centre), true);
  check('🔴 未成熟時進度環不得上金（gold = 已校準）', thin.gold, false);
  check('狀態行報得出真實進度', /基線\s*12\s*\/\s*30/.test(thin.line), true);
  // 🔴 「值對」與「看得見」是兩件事，2026-08-12 當場被咬。
  check('🔴 進度環真的在畫面上（不是被 display:none 關掉）', thin.ringVisible, true);

  const mature = await state(40);
  check('基線成熟後環心才出現 1-99', /^\d+$/.test(mature.centre), true);
  check('成熟後那一行改講「相對你自己的基線」', /相對你自己的基線/.test(mature.line), true);
  check('成熟後進度環轉金', mature.gold, true);

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════
// 🔴 決策底座：出現與否、多高、說什麼，由 (狀態 × 分頁 × 有沒有讀數) 決定
//
// founder 2026-08-12 實走：「決策計時器好像是作一半的狀態，各功能都在而且也會
// 遮擋」。功能其實是完整的 —— 問題是**閒置時畫著正在跑的儀表**，而且它用執行中
// 的尺寸付 5 個分頁的永久租金。更深的一層：它算得出「尚無讀數」卻仍然邀請你
// 開始決策 —— App 同時在說「我不知道你的狀態」和「去做決策吧」。
// ══════════════════════════════════════════════════════════════════
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 430, height: 740 });

  const READING = JSON.stringify({
    band: 'clear', confidence: 'high', ts: Date.now(),
    evidence: { stillness: 0.8, lighting: 0.9, uniformity: 0.9, blinkCadence: null, tier: 'A' },
  });

  const dock = () => page.evaluate(() => {
    const d = document.getElementById('fdcb');
    const seen = (sel) => {
      const e = d.querySelector(sel);
      return !!e && getComputedStyle(e).display !== 'none';
    };
    return {
      visible: !d.hidden && getComputedStyle(d).display !== 'none',
      h: getComputedStyle(document.documentElement).getPropertyValue('--fdcb-h').trim(),
      copy: (document.getElementById('fdcbTime') || {}).textContent || '',
      prog: seen('.fdcb-prog'),
      evts: seen('.fdcb-evts'),
      dots: d.querySelectorAll('.fdcb-evts .dot').length,
      label: (d.querySelector('.evts-label') || {}).textContent || '',
    };
  });

  // ── 閒置 · Today · 沒有讀數 ──
  await page.goto(`${base}/v3/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('tenki.readiness.reading.v1'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4300); // ⚠️ 等開場退場，否則量到的是 splash
  const noReading = await dock();
  check('🔴 沒有讀數時底座不得說「開始決策」', /開始決策/.test(noReading.copy), false);
  check('🔴 沒有讀數時底座導向掃描', /掃/.test(noReading.copy), true);
  // ⚠️ 進度軌在 2026-08-12 之前就已經藏了（`.fdcb.state-idle .fdcb-prog`）——
  // 這條是**回歸防線**，不是新行為。我原本以為它閒置時還在畫，那個判斷是錯的：
  // 閒置時真正還在畫的只有事件群（兩顆點 + 一個假的可按 `+`）。
  check('閒置時不渲染進度軌（既有行為的回歸防線）', noReading.prog, false);
  check('🔴 閒置時不得渲染事件群（logEvent 這時直接 return，按了沒反應）',
    noReading.evts, false);
  check('閒置時底座是矮的（不是執行中的尺寸）', noReading.h, '40px');

  // 🔴 沒有讀數時，狀態行仍要報得出基線進度 —— 上一刀只接了「有讀數」那條分支，
  // 於是第一次開啟 App 的人（最需要看到進度的人）什麼都看不到。
  const zoneNoReading = await page.evaluate(
    () => document.getElementById('edgeTraceZone').textContent,
  );
  check('🔴 沒有讀數時狀態行仍報得出基線進度', /基線\s*\d+\s*\/\s*\d+/.test(zoneNoReading), true);

  // ── 閒置 · 其他分頁 → 整組不佔位 ──
  await page.evaluate(() => goTab('timeline'));
  await page.waitForTimeout(400);
  const awayTimeline = await dock();
  check('🔴 閒置切到 Timeline → 底座不在畫面上', awayTimeline.visible, false);
  check('🔴 而且高度變數歸零（視覺消失還不夠，要真的讓出空間）', awayTimeline.h, '0px');

  await page.evaluate(() => goTab('lab'));
  await page.waitForTimeout(300);
  check('🔴 Lab 同理', (await dock()).visible, false);

  // ── 閒置 · Today · 有讀數 ──
  await page.evaluate((r) => {
    localStorage.setItem('tenki.readiness.reading.v1', r);
    goTab('today');
  }, READING);
  await page.waitForTimeout(500);
  const withReading = await dock();
  check('有讀數時才出現「開始決策」', /開始決策/.test(withReading.copy), true);
  check('有讀數時底座仍是矮的', withReading.h, '40px');

  // ── 執行中 → 儀表回來，而且跟著跨分頁 ──
  await page.evaluate(() => setState('running'));
  await page.waitForTimeout(600);
  const running = await dock();
  // 🔴 沒有這兩條的話，上面「閒置不得渲染」可以用「永久刪掉」通過。
  check('🔴 執行中進度軌必須回來', running.prog, true);
  check('🔴 執行中事件群必須回來', running.evts, true);
  check('執行中底座回到完整高度', running.h, '58px');
  check('🔴 事件群帶得到「事件」標籤（先前完全沒有標籤）', running.label.trim(), '事件');
  // 🔴 計數無上限，3 顆點在第 4 筆就全亮 —— founder 實走看到 16。點的語彙不能用。
  check('🔴 不得再用固定數量的圓點表達無上限的計數', running.dots, 0);

  await page.evaluate(() => goTab('timeline'));
  await page.waitForTimeout(400);
  check('🔴 執行中切到 Timeline → 底座仍在（HUD 要跟著跑）', (await dock()).visible, true);

  // ── 遮擋：Snapshot 的線圖不得被底座蓋住 ──
  await page.evaluate(() => { setState('idle'); goTab('today'); });
  for (const h of [700, 740, 760]) {
    await page.setViewportSize({ width: 430, height: h });
    await page.waitForTimeout(600);
    const occ = await page.evaluate(() => {
      const track = document.getElementById('snapTrack');
      track.scrollLeft = track.clientWidth;
      return new Promise((r) => setTimeout(() => {
        const wave = document.querySelector('.snap-page[data-page="1"] canvas.vwave');
        const d = document.getElementById('fdcb');
        const tab = document.querySelector('.tabbar');
        const wr = wave.getBoundingClientRect();
        const dr = d.getBoundingClientRect();
        const top = dr.height > 0 ? dr.top : tab.getBoundingClientRect().top;
        // ⚠️ 圓點要**捲到底之後**再量。這一段高度的頁面本來就會捲（設計如此：
        // CLAUDE.md 鎖定「短視窗不得縮環，改成讓畫面捲動」），而 elementFromPoint
        // 對視窗外的點回 null —— 不先捲就會把「在摺線之下」誤判成「被底座蓋住」，
        // 然後往錯的方向修。這裡驗的是**可及性**：捲到底就摸得到，且沒被蓋住。
        const scr = document.querySelector('#today-screen');
        scr.scrollTop = scr.scrollHeight;
        const dots = document.getElementById('snapDots');
        const rr = dots.getBoundingClientRect();
        const hit = document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2);
        r({
          hidden: Math.max(0, Math.round(wr.bottom - top)),
          dotsVisible: !!hit && dots.contains(hit),
        });
      }, 600));
    });
    check(`🔴 ${h}px 高時 Snapshot 線圖不得被蓋住`, occ.hidden, 0);
    check(`${h}px 高時輪播圓點捲到底摸得到（沒被底座蓋住）`, occ.dotsVisible, true);
  }

  // ══════════════════════════════════════════════════════════════════
  // 🔴 環心那行的**字元預算** —— 刻意不量像素
  //
  // founder 2026-08-13 實走：「13 秒前 掃描 · 基線 2/30 · 2/7 天」撐破環心
  // （186px）換到第二行，「天」變成孤字。
  //
  // ⚠️ 而沙盒量出來是 172px、**沒有換行** —— 因為容器沒有 PingFang TC，
  // CJK 被代換成較窄的字。量像素的斷言在這裡會**沙盒綠、裝置紅**。
  // 所以改量顯示欄寬（CJK/全形 = 2 欄），那與字體無關。
  //
  // 預算推導：.tl-edge-center 186px ÷ 12px 字級 = 15.5em = 31 欄是硬上限，
  // 28 欄留約 10% 餘裕。
  // ══════════════════════════════════════════════════════════════════
  const ZONE_COLUMN_BUDGET = 28;
  const cols = (t) => [...t].reduce(
    (a, ch) => a + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1),
    0,
  );
  const zoneStates = await page.evaluate(() => {
    const S = window.TENKI_BASELINE_STORE, P = S.PROFILES;
    const DAY = 86_400_000, now = Date.now();
    const out = [];
    // 走幾個代表性的狀態，取實際渲染出來的字串（不是自己拼一個）。
    // ⚠️ 要掃過**所有措辭形狀**，不能只試一種 —— agoTextV6 有
    // 剛剛／N 秒前／N 分鐘前／N 小時前／N 天前 五種，加上過期那條，
    // 而樣本數的位數也會變。只試一種等於只量到一種字形。
    const ages = [0, 45_000, 59 * 60_000, 14 * 60_000, 23 * 3600_000, 3 * DAY];
    for (const n of [1, 12, 29]) {
      S.clear(); localStorage.removeItem(S.LEGACY_SEED_KEY);
      for (let i = 0; i < n; i += 1) {
        S.appendSample({
          profile: P.DAILY_SCAN_LANDMARK, composite: 0.5 + (i % 5) * 0.02,
          quality: 0.8, tier: 'A', ts: now - (n - i) * DAY,
        });
      }
      for (const age of ages) {
        localStorage.setItem('tenki.readiness.reading.v1', JSON.stringify({
          band: 'neutral', confidence: 'high', ts: now - age,
          evidence: { stillness: 0.6, lighting: 0.9, uniformity: 0.9, blinkCadence: null, tier: 'A' },
        }));
        renderHeroReading();
        out.push(document.getElementById('edgeTraceZone').textContent.trim());
      }
      // 沒有讀數那條分支也要量（它也接了基線進度）
      localStorage.removeItem('tenki.readiness.reading.v1');
      renderHeroReading();
      out.push(document.getElementById('edgeTraceZone').textContent.trim());
    }
    S.clear();
    return out;
  });
  const worst = zoneStates.reduce((a, t) => (cols(t) > cols(a) ? t : a), '');
  check(`🔴 環心狀態行不得超過 ${ZONE_COLUMN_BUDGET} 欄（最長：「${worst}」= ${cols(worst)}）`,
    cols(worst) <= ZONE_COLUMN_BUDGET, true);
  check('掃過所有措辭形狀（不然上一條只量到一種字形）',
    zoneStates.length === 21 && new Set(zoneStates).size >= 8, true);

  // 🔴 顯示能省掉天數的**前提**就是這個恆等式：一天一筆 → n ≡ distinctDays。
  // 哪天有人拿掉同日去重，「基線 30/30」就會變成誤導（可能只跨 2 天），
  // 這條會先紅，提醒把天數加回顯示。
  const identity = await page.evaluate(() => {
    const S = window.TENKI_BASELINE_STORE, P = S.PROFILES, DAY = 86_400_000;
    const t0 = new Date(2026, 0, 5, 12, 0, 0).getTime();
    S.clear(); localStorage.removeItem(S.LEGACY_SEED_KEY);
    const pairs = [];
    for (let d = 0; d < 9; d += 1) {
      for (let k = 0; k < 3; k += 1) {      // 同一天掃三次
        S.appendSample({
          profile: P.DAILY_SCAN_LANDMARK, composite: 0.5 + k * 0.01,
          tier: 'A', ts: t0 + d * DAY + k * 3600_000,
        });
      }
      const st = S.statsFor(P.DAILY_SCAN_LANDMARK);
      pairs.push([st.sampleCount, st.distinctDays]);
    }
    S.clear();
    return pairs;
  });
  check('🔴 一天一筆 → 樣本數恆等於跨日數（環心只顯示一個計數的前提）',
    identity.every(([n, d]) => n === d), true);
  check('恆等式真的被多次掃描考驗過（不然上一條是空過的）',
    identity.length === 9 && identity[8][0] === 9, true);

  // ── 一物一名：Session 詳情不得再出現英文 marks ──
  const sessionCopy = await page.evaluate(() => {
    const clone = document.getElementById('session-screen').cloneNode(true);
    clone.querySelectorAll('script,style').forEach((n) => n.remove());
    return clone.textContent;
  });
  check('🔴 Session 詳情不再用「marks」（與 EVENT LOG 同稱「事件」）',
    /marks/i.test(sessionCopy), false);

  await ctx.close();
}

// ══════════════════════════════════════════════════════════════════
// 🔴 自測頁：「已累積天數」必須在按開始之前就反映本機紀錄
//
// 那個數字是跨天自測唯一的事前自我檢查 —— 頁面現在明寫「開始之前先看上面那個
// 數字…如果是 0，先別掃」。若它要等掃完才更新，這句話就是在指路到一個空欄位，
// 而代價是整輪白跑（3 次掃描 + 兩段 15 秒），且那一天的跨天對照補不回來。
//
// ⚠️ 這條**必須先塞資料再驗**：markup 裡 #rl-days 的初值就寫死 `0`，
// 直接驗「等於 0」是同義反覆（renderSummary 整個拿掉也照樣綠）。
// 塞兩個不同日子進去，讀到 2 才代表 init() 真的算過。
// ══════════════════════════════════════════════════════════════════
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.error('[pageerror]', e.message); fail += 1; });

  const url = `${base}/preview/reliability.html`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const DAY = 86_400_000;
    const t = Date.now();
    // 同一天兩筆 + 前一天一筆 → 天數 2，而且證明它數的是**日子**不是筆數。
    localStorage.setItem(window.TENKI_RELIABILITY.STORE_KEY, JSON.stringify([
      { ts: t - DAY, composite: 0.51, tier: 'A', confidence: 'high' },
      { ts: t, composite: 0.55, tier: 'A', confidence: 'high' },
      { ts: t + 1000, composite: 0.57, tier: 'A', confidence: 'high' },
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);

  // 刻意**不按**「開始自測」—— 驗的就是「開始之前」讀得到。
  const daysBeforeStart = await page.evaluate(
    () => document.getElementById('rl-days').textContent.trim(),
  );
  check('🔴 「已累積天數」在按開始之前就反映本機紀錄（3 筆跨 2 天 → 2）',
    daysBeforeStart, '2');

  await ctx.close();
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);

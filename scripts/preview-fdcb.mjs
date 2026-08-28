/**
 * preview-fdcb.mjs — /v3/ 決策計時器（FDCB）的迴歸驗證。
 *
 * 為什麼需要這支：`apps/preview/**` 是 CI 盲區（PLAYBOOK §3），而底座這種
 * 「狀態機 × 版面 × 文案」交纏的東西，語法檢查一條也抓不到。
 *
 * 2026-08-12 founder 實走報的三句話，每一句底下都有實體 bug：
 *   「決策計時器好像做一半」→ 跑中換模板留下沒清掉的 interval：state 顯示
 *      ready、時鐘繼續跑，到**舊**模板的時長時彈出「完整走完」並往 store 寫
 *      一筆使用者沒跑完的幽靈紀錄。
 *   「各功能都在而且也會遮擋」→ idle 撐滿 58px 去放兩個當下沒有作用的欄位。
 *   「不知道右側的點點按的數字代表什麼意思」→ 三顆沒有名字的圓點，DOM 順序
 *      還是 dot,dot,[+],dot（第三顆亮的點在 + 的右邊），idle 按下去沒有反應，
 *      計數膠囊還亮 --good 綠。
 *
 * ⚠️ 遮擋一律用 elementFromPoint 問瀏覽器，不看 bounding rect（PLAYBOOK §「有版面
 * 不等於看得見」）。而且**在 390x700 驗**：先前那條「說明與圓點都要露出來」是在
 * 844 量出來的縫隙裡排的，founder 的 in-app 瀏覽器只有 ~700 可視高度，同一份
 * 版面在那裡是另一個結果。
 *
 * Run:  node scripts/preview-fdcb.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
// Playwright 從共用 resolver 拿：CI 走 node_modules、容器退回全域安裝。
// 這一行原本是寫死的 /opt/node22/... 絕對路徑 —— 那就是 harness 進不了 CI 的原因。
import { getChromium, checkFontCanary } from './lib/playwright.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// top-level await：ESM 可以，且必須在任何 chromium.* 之前解析完。
const chromium = await getChromium();

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

// ⚠️ 這幾條 rewrite 正式站是 vercel.json 在做，本地要照抄（含 `(.*)` 那條）。
// 靜默 404 的測試環境比沒有測試更糟 —— 犯過兩次，見 preview-strip-color.mjs 的註解。
const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
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

/** tokens：--good #34C759 是「跟著流程完成」的語意色，標記計數不得用它 */
const GOOD_GREEN = 'rgb(52, 199, 89)';

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

/** 開一頁 /v3/，種好讀數，跳過 splash，停在 Today。 */
async function openV3(height, opts) {
  // readingAgeMs：讀數有多舊。預設 2 分鐘＝新鮮；> 15 分鐘會走「已過期」那條文案。
  const options = Object.assign({ reading: true, width: 390, readingAgeMs: 120e3 }, opts || {});
  const page = await browser.newPage({
    viewport: { width: options.width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await page.addInitScript((opts) => {
    // 自訂模板：一個 6 秒（跑得完）、一個 3:30（分秒都要顯示對）
    localStorage.setItem('tenki.v6.templates.v1', JSON.stringify([
      { id: 'h6', name: '六秒', durationSec: 6, color: '#00B4D8', icon: 'heart', segLabel: 'Focus' },
      { id: 'h210', name: '三分半', durationSec: 210, color: '#00B4D8', icon: 'heart', segLabel: 'Focus' },
    ]));
    localStorage.removeItem('tenki.alert.outcomes.v1');
    localStorage.removeItem('tenki.v6.tplabels.v1');
    localStorage.removeItem('tenki.v6.decisionDiscipline.v1');  // 決策紀律模式預設關，測試隔離
    if (opts.reading) {
      localStorage.setItem('tenki.readiness.reading.v1', JSON.stringify({
        band: 'neutral', confidence: 'high', ts: Date.now() - opts.readingAgeMs,
        baselineDays: 1, baselineScans: 1,
      }));
    } else {
      localStorage.removeItem('tenki.readiness.reading.v1');
    }
  }, options);
  await page.goto(`${base}/v3/`, { waitUntil: 'networkidle' }).catch(() => {});
  // ⚠️ splash 自己在 2400ms 後 dismiss，之前它以 z-index:9999 蓋滿整頁 ——
  // 用固定 waitForTimeout 猜這個時間，遮擋斷言就會去問到 splash 而不是版面
  // （第一版實際踩到，回報 other:tenki-splash）。等它真的離開 DOM 才往下走。
  await page.waitForFunction(() => !document.getElementById('tenki-splash'), { timeout: 8000 });
  await page.evaluate(() => window.goTab('today'));
  await page.waitForTimeout(400);
  return page;
}

const dock = (page) => page.evaluate(() => {
  const f = document.getElementById('fdcb');
  const mark = document.getElementById('fdcbMark');
  const r = f.getBoundingClientRect();
  const ms = getComputedStyle(mark);
  return {
    state: f.className.replace('fdcb ', '').split(' ')[0].replace('state-', ''),
    height: Math.round(r.height),
    reserveVar: getComputedStyle(document.documentElement).getPropertyValue('--fdcb-h').trim(),
    markDisplay: ms.display,
    markLabel: mark.getAttribute('aria-label'),
    markText: mark.innerText.replace(/\s+/g, ' ').trim(),
    markBg: ms.backgroundColor,
    countBg: getComputedStyle(document.getElementById('fdcbMarkN')).backgroundColor,
    countHidden: document.getElementById('fdcbMarkN').hidden,
    chipDur: document.getElementById('fdcbDur').textContent,
    time: document.getElementById('fdcbTime').textContent,
    seg: document.getElementById('fdcbSeg').textContent,
  };
});

const pickTmpl = (page, id) => page.evaluate((tid) => {
  const el = [...document.querySelectorAll('.tmpl-item')].find((x) => x.dataset.id === tid);
  if (el) window.selectTmpl(el);
  return !!el;
}, id);

const outcomes = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem(window.TENKI_OUTCOME.STORE_KEY)) || []; }
  catch (e) { return []; }
});

// ═══════════════ 0. 字型金絲雀（必須跑在所有版面斷言之前）═══════════════
// 🔴 下面每一條「幾行 / 在不在圓內」都是文字寬度的函式，而文字寬度是字型的函式。
// 先確認這台機器的字型跟基準對得上 —— 對不上就在這裡明說，
// 不要讓它去翻掉版面斷言，害下一個人以為是版面壞了。
console.log('\n── 字型金絲雀 ──');
{
  const page = await openV3(700);
  const drift = await checkFontCanary(page);
  check('字型與基準一致（不一致就不要相信下面的版面斷言）', drift, []);
  if (drift.length) {
    console.log('   ⚠️ 這台機器的字型跟基準不同 —— 先修環境（CI 應裝 fonts-wqy-zenhei），');
    console.log('      不要去改產品的版面來迎合它。');
  }
  await page.close();
}

// ═══════════════ 1. idle：底座是單行，保留區跟著縮，標記鍵不出現 ═══════════════
console.log('\n── idle 底座（390x700）──');
{
  const page = await openV3(700);
  const d = await dock(page);
  check('idle 底座高度 = 44px（不是 58）', d.height, 44);
  check('保留區變數 --fdcb-h 與底座實高同步', d.reserveVar, '44px');
  check('idle 不出現標記鍵（沒有 session，標記無處可掛）', d.markDisplay, 'none');
  // 舊版：idle 也留著鍵，按下去 logEvent() 直接 return，靜靜地什麼都不做。
  const before = await dock(page);
  await page.evaluate(() => window.logEvent());
  const after = await dock(page);
  check('idle 呼叫 logEvent 不會偷偷長出計數', after.countHidden === before.countHidden, true);

  // 遮擋：捲到底之後，Today 最下面那兩個東西必須真的看得見
  await page.evaluate(() => {
    document.querySelectorAll('.screen.active, .snap').forEach((e) => { e.scrollTop = e.scrollHeight; });
  });
  await page.waitForTimeout(350);
  const vis = await page.evaluate(() => {
    const fdcb = document.getElementById('fdcb');
    const tabbar = document.getElementById('tabbar');
    const seen = (el) => {
      if (!el) return 'missing';
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return 'no-box';
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (!top) return 'nothing';
      if (fdcb.contains(top)) return 'fdcb';
      if (tabbar.contains(top)) return 'tabbar';
      return el.contains(top) || el === top ? 'self' : 'other:' + top.className;
    };
    const note = [...document.querySelectorAll('#today-screen *')]
      .find((e) => e.children.length === 0 && (e.textContent || '').includes('示意畫面'));
    const dots = document.querySelector('#today-screen .snap-dots, #today-screen .dots');
    return { note: seen(note), dots: dots ? seen(dots) : 'missing' };
  });
  check('捲到底時「以上四張為示意畫面」不被底座／tab bar 蓋住', vis.note, 'self');
  await page.close();
}

// ═══════════════ 2. running：標記鍵有名字、有計數、不吃語意綠 ═══════════════
console.log('\n── running 的標記鍵 ──');
{
  const page = await openV3(700);
  await page.evaluate(() => { window.nextState(); window.nextState(); });
  await page.waitForTimeout(1300);
  let d = await dock(page);
  check('running 底座長回 58px', d.height, 58);
  check('保留區同步長回', d.reserveVar, '58px');
  check('running 才出現標記鍵', d.markDisplay, 'flex');
  checkTruthy('標記鍵有中文標籤（不是裸圓點）', d.markText.includes('標記'));
  checkTruthy('標記鍵有 aria-label', (d.markLabel || '').includes('標記'));
  check('沒按之前不顯示計數', d.countHidden, true);

  await page.evaluate(() => { window.logEvent(); window.logEvent(); });
  await page.waitForTimeout(150);
  d = await dock(page);
  check('按兩下 → 計數 2', d.markText.replace(/\s/g, ''), '+標記2');
  check('計數不得用 --good 綠（綠是「跟著流程完成」的語意色）', d.countBg === GOOD_GREEN, false);
  check('標記鍵底也不得是語意綠', d.markBg === GOOD_GREEN, false);
  checkTruthy('按下去段標籤會回報記在第幾分幾秒', /^已標記 2 · \d{2}:\d{2}$/.test(d.seg));

  // 計數不得被三顆點的上限吃掉（舊版只有 3 顆 dot）
  await page.evaluate(() => { window.logEvent(); window.logEvent(); window.logEvent(); });
  await page.waitForTimeout(150);
  d = await dock(page);
  check('按到第 5 下計數照樣是 5（舊版只有 3 顆點）', d.markText.replace(/\s/g, ''), '+標記5');

  // 回報訊息過期後段標籤要自己回來。
  // ⚠️ 段標籤是每秒 tick 才重畫的，所以回報實際活 1.6~2.6 秒 —— 用固定
  // waitForTimeout(1900) 會落在兩次 tick 中間，斷言變成偶紅（第一版踩到）。
  // 等條件成立，不要等時間。
  await page.waitForFunction(
    () => document.getElementById('fdcbSeg').textContent.indexOf('已標記') === -1,
    { timeout: 4000 },
  ).catch(() => {});
  d = await dock(page);
  check('回報訊息過期後段標籤回到段名', d.seg, 'Observe');
  await page.close();
}

// ═══════════════ 3. 時長標籤不得說謊 ═══════════════
console.log('\n── 模板時長標籤 ──');
{
  const page = await openV3(700);
  checkTruthy('找得到 3:30 的自訂模板', await pickTmpl(page, 'CUSTOM_h210'));
  await page.waitForTimeout(500);
  const d = await dock(page);
  // 舊版寫死 `${Math.floor(sec/60)}:00` → 這裡會是 '3:00 ▾'，而右邊大字同時寫 3:30。
  check('3:30 的模板，膠囊就要寫 3:30', d.chipDur, '3:30 ▾');
  checkTruthy('大字時鐘與膠囊講同一個時長', d.time.includes('3:30'));
  await page.close();
}

// ═══════════════ 4. 跑中不得換模板 → 不留殭屍計時器、不寫幽靈紀錄 ═══════════════
console.log('\n── 跑中換模板（殭屍計時器 / 幽靈紀錄）──');
{
  const page = await openV3(700);
  await pickTmpl(page, 'CUSTOM_h6');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.nextState());   // ready → running
  await page.waitForTimeout(1200);
  check('六秒模板跑起來了', (await dock(page)).state, 'running');

  await page.evaluate(() => window.openSheet());
  await page.waitForTimeout(200);
  check('running 時模板選單打不開', await page.evaluate(() => document.getElementById('sheet').classList.contains('open')), false);

  await pickTmpl(page, 'WORK_FOCUS');            // 直接呼叫也不得生效
  await page.waitForTimeout(400);
  const mid = await dock(page);
  check('running 時 selectTmpl 不生效，state 仍是 running', mid.state, 'running');
  checkTruthy('跑的還是六秒模板', mid.time.includes('0:06'));
  check('running 的膠囊不掛 ▾（那當下換不了模板）', mid.chipDur.includes('▾'), false);

  // 舊版在這裡會：ready 狀態下時鐘繼續跑 → 6 秒後彈出「完整走完」
  //              → store 多出一筆使用者沒跑完的六秒紀錄。
  await page.waitForTimeout(6500);
  const end = await dock(page);
  const recs = await outcomes(page);
  check('六秒跑滿後正常收束', end.state === 'complete' || end.state === 'idle', true);
  check('store 只有這一筆，沒有幽靈紀錄', recs.length, 1);
  check('那一筆記的是真的跑完的六秒模板', recs[0] && recs[0].symbol, '六秒');
  check('收束標記的是 timed_out（跑滿）', recs[0] && recs[0].outcomeTag, 'timed_out');
  await page.close();
}

// ═══════════════ 5. 下游文案：marks 不得留英文 jargon ═══════════════
console.log('\n── 下游文案 ──');
{
  const page = await openV3(700);
  const txt = await page.evaluate(() => {
    // PLAYBOOK：要問「所有 markup 的文字，含目前沒顯示的」——
    // innerText 讀不到別的分頁，textContent 又會把 <script> 原始碼算進來。
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style').forEach((n) => n.remove());
    return clone.textContent;
  });
  check('user-facing 不再出現英文 "marks"', /\bmarks\b/i.test(txt), false);
  // 🔴 送審紅線：APP_STORE_COMPLIANCE §5.1 禁「交易 / Trade / Trading」出現在
  // 審核可見的任何位置，§6 明訂「交易模式 → 決策模式 / 紀律模式」，
  // 檢查表 #17 是送審 blocker。safe-copy.ts:29 也把 trader/trading 列入禁用。
  // ⚠️ 這裡讀的是**移除 script/style 後**的文字 —— 頁內鏡射的禁用詞清單本來就
  // 含「交易建議」，那是資料不是文案，不該被算進來。
  check('🔴 使用者看得到的文字不得出現「交易」', /交易/.test(txt), false);
  // ⚠️ 「TradingView」是第三方服務的專有名詞，不是交易詞彙 —— 而且
  // TRADINGVIEW-ALERT-SPEC.md §6 的 canonical 面板文案本來就把它當來源標示
  // （「TradingView · <strategyHint>」）。所以先把專有名詞挖掉再問，
  // 否則這條會擋掉一個規格明文允許的東西。
  const txtNoBrand = txt.replace(/TradingView/g, '');
  check('🔴 使用者看得到的文字不得出現 trader/trading（TradingView 這個專有名詞除外）',
    /trad(er|ing)/i.test(txtNoBrand), false);
  checkTruthy('Timeline strip 有解釋點大小的圖例', txt.includes('點越大'));
  await page.close();
}

// ═══════════════ 6. Turning Point 節點 ═══════════════
// founder 2026-08-14：「標記很好按，一下子從 1 按到 5，但這應該是可以快速選擇
// 或是自訂、自己記錄用 —— 這樣才能看到 ——事件節點（掃描狀態）——」。
console.log('\n── Turning Point 節點 ──');
{
  const page = await openV3(700);
  await page.evaluate(() => { window.nextState(); window.nextState(); });
  await page.waitForTimeout(1200);

  // 🔴 快路徑：不碰快選也要能連按到 5。這是 founder 唯一稱讚的地方 ——
  // 加上「選標籤」之後把它弄慢，就是拿舊的去換新的。
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.logEvent());
    await page.waitForTimeout(90);
  }
  const fast = await dock(page);
  check('不碰快選也能連按到 5（快路徑手感沒被換掉）', fast.markText.replace(/\s/g, ''), '+標記5');

  const live = await page.evaluate(() => {
    const el = document.getElementById('tpPicker');
    const fdcb = document.getElementById('fdcb');
    const tabbar = document.getElementById('tabbar');
    const chip = el.querySelector('.tp-chip');
    let hit = 'nochip';
    if (chip) {
      const b = chip.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      hit = !top ? 'nothing'
        : fdcb.contains(top) ? 'fdcb'
        : tabbar.contains(top) ? 'tabbar'
        : (el.contains(top) ? 'self' : 'other:' + top.className);
    }
    return {
      open: el.classList.contains('open'),
      chips: [...el.querySelectorAll('.tp-chip')].map((c) => c.textContent),
      chipHit: hit,
      // 同一秒的節點必須併成一顆（否則軌上一顆、計數寫 5）
      ticks: [...document.querySelectorAll('.fdcb-prog .tp-tick')].length,
    };
  });
  check('按完之後快選會滑出來', live.open, true);
  checkTruthy('快選帶的是這個模板自己的轉折點', live.chips.length >= 3);
  // ⚠️ 這一列落在 390x700 下最擠的那一段（底座頂 558）。PLAYBOOK：可視高度是變數，先驗矮的。
  check('快選晶片沒有被底座／tab bar 蓋住（390x700）', live.chipHit, 'self');
  // 🔴 五顆全落在同一秒 → 軌上必須是一顆（大小表示數量），不能是一顆卻宣稱五個
  check('同一秒的節點併成一顆（軌上不得與計數打架）', live.ticks, 1);

  // 選一個標籤 → 只補在剛剛那一顆上
  await page.evaluate(() => document.querySelectorAll('.tp-chip')[0].click());
  await page.waitForTimeout(200);
  const afterPick = await dock(page);
  checkTruthy('選完標籤，段標籤回報選了什麼', afterPick.seg.indexOf('已標記 · ') === 0);
  check('選完之後快選自己收走', await page.evaluate(() => document.getElementById('tpPicker').classList.contains('open')), false);

  await page.evaluate(() => window.nextState());
  await page.waitForTimeout(500);
  const rec = (await outcomes(page))[0] || {};
  check('節點隨 outcome 一起落地', Array.isArray(rec.events) && rec.events.length, 5);
  check('marks 仍然寫（既有持久化欄位不得改名/移除）', rec.marks, 5);
  check('沒選標籤的節點是合法的純時間點', rec.events.filter((e) => e.label === null).length, 4);
  checkTruthy('選過的那一顆帶得到標籤', typeof rec.events[4].label === 'string' && rec.events[4].label.length > 0);
  check('節點 type 沿用凍結的六個成員之一', rec.events[0].type, 'mark');
  // 🔴 反造假：節點上不得有 0-100 分
  check('節點不得帶 edgeScore 之類的數字欄位',
    Object.keys(rec.events[0]).filter((k) => /score/i.test(k)).length, 0);
  await page.close();
}

// ═══════════════ 7. 沒有讀數時不得假裝量到 ═══════════════
console.log('\n── 無讀數的誠實 ──');
{
  const page = await openV3(700, { reading: false });
  await page.evaluate(() => { window.nextState(); window.nextState(); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.logEvent());
  await page.waitForTimeout(200);
  const t = await page.evaluate(() => {
    const el = document.querySelector('.fdcb-prog .tp-tick');
    return { cls: el ? el.className : null, bg: el ? getComputedStyle(el).backgroundColor : null };
  });
  checkTruthy('沒讀數的節點是 no-reading（空心）', (t.cls || '').indexOf('no-reading') >= 0);
  check('空心節點真的沒有填色', t.bg, 'rgba(0, 0, 0, 0)');
  await page.evaluate(() => window.nextState());
  await page.waitForTimeout(500);
  const rec = (await outcomes(page))[0] || {};
  const ev = (rec.events || [])[0] || {};
  check('沒讀數就四個欄位都 null（不回填預設帶位）',
    [ev.band, ev.confidence, ev.readingTs, ev.staleAtDecision], [null, null, null, null]);
  await page.close();
}

// ═══════════════ 8. 詳情頁的決策軌跡 ═══════════════
console.log('\n── 決策軌跡（Session Detail）──');
{
  const page = await openV3(700);
  const now = Date.now();
  await page.evaluate((now) => {
    localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify([
      { symbol: 'Mancini FBD', templateId: 'MANCINI_FBD', outcomeTag: 'timed_out', contextTag: null,
        reachedReadiness: true, durationSec: 180, marks: 3, ts: now - 3600e3, source: 'v6',
        events: [
          { t: 18, type: 'mark', phase: 'Observe', labelId: 'WAITED', label: '等到了', band: 'clear', confidence: 'high', readingTs: now - 3900e3, staleAtDecision: false },
          { t: 90, type: 'mark', phase: 'Lock', labelId: null, label: null, band: null, confidence: null, readingTs: null, staleAtDecision: null },
          { t: 171, type: 'mark', phase: 'Extended', labelId: 'HOLD', label: '先不動', band: 'strain', confidence: 'low', readingTs: now - 3900e3, staleAtDecision: true },
        ] },
      // 舊紀錄：只有 marks、沒有 events（節點功能之前跑的）
      { symbol: 'Health Stress', templateId: 'HEALTH_STRESS', outcomeTag: 'stayed_disciplined', contextTag: null,
        reachedReadiness: true, durationSec: 180, marks: 3, ts: now - 7200e3, source: 'v6' },
    ]));
  }, now);
  await page.evaluate(() => window.goTab('session'));
  await page.waitForTimeout(300);

  await page.evaluate((ts) => window.openSessionDetail(ts), now - 3600e3);
  await page.waitForTimeout(400);
  const detail = await page.evaluate(() => ({
    count: document.getElementById('sdTpCount').textContent,
    nodes: [...document.querySelectorAll('.sd-tp-node')].map((n) => ({
      cls: n.className.replace('sd-tp-node ', ''), left: Math.round(parseFloat(n.style.left)),
    })),
    rows: [...document.querySelectorAll('#sdTpList .sd-evt')].length,
    // 卡片不得把最後一列裁掉（.sd-body 是 flex column，子項預設會被壓扁）
    clipped: (() => {
      const card = document.querySelector('.sd-tp-card');
      const list = document.getElementById('sdTpList');
      if (!card || !list) return 'missing';
      return list.getBoundingClientRect().bottom > card.getBoundingClientRect().bottom + 1;
    })(),
    states: [...document.querySelectorAll('#sdTpList .state')].map((s) => s.textContent),
  }));
  check('軌上畫得出 3 顆節點', detail.nodes.length, 3);
  // x = t / durationSec：18/180 = 10%、90/180 = 50%、171/180 = 95%
  check('節點位置對應 t / durationSec', detail.nodes.map((n) => n.left), [10, 50, 95]);
  check('節點顏色吃帶位，沒讀數的是空心',
    detail.nodes.map((n) => n.cls), ['band-clear', 'no-reading', 'band-strain']);
  check('逐列軌跡有 3 列', detail.rows, 3);
  check('🔴 卡片不得把最後一列裁掉（flex-shrink 壓扁 + overflow:hidden）', detail.clipped, false);
  checkTruthy('沒讀數的那一列直說「無讀數」', detail.states.some((x) => x === '無讀數'));
  checkTruthy('有讀數的那一列報得出帶位＋信心＋多久', /Clear · 信心高 · .+/.test(detail.states[0]));

  // 舊紀錄：不得說 0、不得出現否定
  await page.evaluate(() => window.closeSessionDetail());
  await page.waitForTimeout(300);
  await page.evaluate((ts) => window.openSessionDetail(ts), now - 7200e3);
  await page.waitForTimeout(300);
  const legacy = await page.evaluate(() => ({
    count: document.getElementById('sdTpCount').textContent,
    text: document.getElementById('sdTpList').textContent,
  }));
  check('🔴 舊紀錄報的是它真的有的 3 個標記，不是 0', legacy.count, '3 個標記');
  check('舊紀錄不得出現「0 個」這種否定', /0 個/.test(legacy.text), false);
  await page.close();
}

// ═══════════════ 9. 自訂標籤的禁用詞把關 ═══════════════
console.log('\n── 自訂標籤 compliance ──');
{
  const page = await openV3(700);
  await page.evaluate(() => window.openTpLabelEditor());
  await page.waitForTimeout(300);
  const tryLabel = (text) => page.evaluate((text) => {
    document.getElementById('tplText').value = text;
    document.getElementById('tplScope').value = '';
    window.saveTpLabel();
    return {
      blocked: !document.getElementById('tplWarn').hidden,
      stored: JSON.parse(localStorage.getItem('tenki.v6.tplabels.v1') || '[]').length,
    };
  }, text);
  const zh = await tryLabel('停損點到了');
  check('🔴 中文金融動作詞被擋下', zh.blocked, true);
  check('被擋下的標籤不得落地', zh.stored, 0);
  const en = await tryLabel('buy more');
  check('🔴 英文金融動作詞也被擋下', en.blocked, true);
  const ok = await tryLabel('先深呼吸');
  check('乾淨的標籤存得進去', ok.blocked, false);
  check('存進去了', ok.stored, 1);
  await page.close();
}

// ═══════════════ 10. Hero 讀數不得爆版 ═══════════════
// founder 2026-08-19 實走回報：「尚未量測」斷成「尚未量」/「測」且跑出深色圓外，
// 信心膠囊斷成「信心中 · 提」/「升精度 ›」。
//
// 🔴 這一組是**這三個 PR（#229/#231/#232）都沒有、也正是它們沒被擋下的原因**。
// 環心是環的 62%（vw 的函式，實測 121~129px），而裡面的字級是寫死的 px ——
// 390 剛好塞得下、375 就爆。PLAYBOOK 那條「把元素排進量出來的縫隙」的翻版。
//
// ⚠️ 所以這裡**掃多個寬度**，而且問的是「幾行」與「在不在圓內」這兩個看得見的事實，
// 不是去比對某個寬度下量到的 px。
console.log('\n── Hero 讀數不得爆版 ──');
{
  for (const width of [360, 375, 390, 414]) {
    for (const withReading of [false, true]) {
      const page = await openV3(700, { reading: withReading, width });
      const h = await page.evaluate(() => {
        const lines = (el) => {
          if (!el || el.hidden) return null;
          const r = document.createRange();
          r.selectNodeContents(el);
          return r.getClientRects().length;
        };
        const ctr = document.querySelector('.tl-edge-center');
        const score = document.getElementById('edgeScoreReveal');
        const cta = document.getElementById('edgeScanCta');
        const conf = document.getElementById('edgeConfidence');
        const action = (cta && !cta.hidden) ? cta : conf;
        const cr = ctr.getBoundingClientRect();
        const sr = score.getBoundingClientRect();
        return {
          text: score.textContent.trim(),
          scoreLines: lines(score),
          // 讀數的盒子必須完全落在環心的盒子裡（上下左右都不得溢出）
          insideCircle: sr.top >= cr.top - 0.5 && sr.bottom <= cr.bottom + 0.5
                     && sr.left >= cr.left - 0.5 && sr.right <= cr.right + 0.5,
          // 圓裡的內容不得高過圓本身
          contentFits: ctr.scrollHeight <= Math.ceil(cr.height) + 1,
          actionText: action ? action.textContent.trim() : null,
          actionLines: lines(action),
        };
      });
      const tag = `${width}px ${withReading ? '有讀數' : '無讀數'}`;
      check(`${tag}：讀數「${h.text}」只有 1 行`, h.scoreLines, 1);
      check(`${tag}：讀數整個在環心圓內`, h.insideCircle, true);
      check(`${tag}：環心裝得下自己的內容`, h.contentFits, true);
      check(`${tag}：動作鍵「${h.actionText}」只有 1 行`, h.actionLines, 1);
      await page.close();
    }
  }
}

// ═════════════════════════════════════════════════
// 決策計時器必須吃牆鐘，不得數 tick
//
// 交易者的常態是**下單根本不在這支手機上**（桌機或券商 APP），所以決策跑到
// 一半頁面被鎖屏／切走是常態。舊版 `elapsed += 1` 數的是 setInterval 的
// callback 次數 —— 那段時間 tick 一次都沒發生，時鐘就少算，而
// saveV6Outcome 又把它當 durationSec 寫進紀錄，於是紀錄跟著說謊。
//
// 🔴 怎麼驗（前兩種寫法都試過，都是**死斷言**）：
//   ✗ 開第二個分頁把它推到背景 —— Playwright 預設帶
//     --disable-background-timer-throttling，新舊碼同樣讀到 00:07。
//   ✗ CDP Page.setWebLifecycleState('frozen') —— 需要頁面先真的 hidden，
//     直接送同樣驗不出差別。
//   ✓ 用忙迴圈把頁面的 JS 執行緒卡住。模擬的是同一件事的本質：
//     **這段時間裡 tick 一次都沒發生**。實測差異：新碼 00:07 / 舊碼 00:03。
// ═════════════════════════════════════════════════
{
  console.log('\n── 計時器吃牆鐘（背景不得少算）──');
  const page = await openV3(700);
  await page.evaluate(() => { window.setState('ready'); window.setState('running'); });
  await page.waitForTimeout(1100);

  const BLOCK_MS = 5000;
  await page.evaluate((ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { /* 卡住 event loop，setInterval 排不進來 */ }
  }, BLOCK_MS);
  await page.waitForTimeout(1100); // 解除封鎖後的下一次 tick

  const seen = await page.evaluate(() => ({
    clockSec: (() => {
      const m = /^(\d\d):(\d\d)/.exec(document.getElementById('fdcbTime').textContent.trim());
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    })(),
    trueSec: window.elapsedNow(),
  }));
  // 卡住 5s + 前後各約 1.1s ≈ 7s。允許 ±1s 的取樣誤差，但**不允許掉掉整段封鎖時間**
  // （數 tick 的實作在這裡會是 3 秒左右）。
  checkTruthy(
    `卡住 ${BLOCK_MS}ms 後時鐘沒有少算（實際 ${seen.clockSec}s，真值 ${seen.trueSec}s）`,
    seen.clockSec !== null && Math.abs(seen.clockSec - seen.trueSec) <= 1,
  );
  await page.close();
}

// ═════════════════════════════════════════════════
// 決策期間「離開」的記錄
// 交易者在桌機或券商 APP 下單，離開是常態不是失誤 —— 記錄它是陳述事實，不是扣分。
// ═════════════════════════════════════════════════
{
  console.log('\n── 離開記錄（桌機／券商 APP 下單是常態）──');
  const page = await openV3(700);
  await page.evaluate(async () => {
    window.setState('ready'); window.setState('running');
    const fire = (v) => {
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    fire('hidden'); await new Promise((r) => setTimeout(r, 4100)); fire('visible');  // 算
    fire('hidden'); await new Promise((r) => setTimeout(r, 1000)); fire('visible');  // 不算（雜訊）
  });
  const live = await page.evaluate(() => ({ count: sess.awayCount, ms: sess.awayMs }));
  check('離開 4.1 秒記一次；1 秒的雜訊不記', live.count, 1);
  checkTruthy(`離開時長記到了（${live.ms}ms）`, live.ms >= 4000 && live.ms < 5000);

  await page.evaluate(() => window.endDecision('close'));
  await page.waitForTimeout(200);
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')).slice(-1)[0]);
  check('離開次數落進紀錄', rec.awayCount, 1);

  // 詳情頁：有欄位 → 該格出現；整排不得橫向溢出、每格 1 行
  const shown = await page.evaluate((ts) => {
    window.goTab('session'); window.openSessionDetail(ts);
    const card = document.querySelector('.sd-facts');
    const cells = [...card.querySelectorAll('.sd-fact')].filter((e) => !e.hidden);
    return {
      n: cells.length,
      overflow: card.scrollWidth > card.clientWidth + 1,
      maxLines: Math.max(...cells.map((c) => c.querySelector('.v').getClientRects().length)),
      away: (document.getElementById('sdFactAway') || {}).textContent,
    };
  }, rec.ts);
  check('詳情頁四格都在', shown.n, 4);
  check('facts 那排沒有橫向溢出', shown.overflow, false);
  check('facts 每格都只有 1 行', shown.maxLines, 1);
  check('離開格顯示次數', shown.away, '1 次');

  // 🔴 舊紀錄沒有 awayCount → 整格不顯示，且不得出現「0 次」
  const legacy = await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1'));
    const old = Object.assign({}, all[all.length - 1], { ts: Date.now() - 60e3 });
    delete old.awayCount; delete old.awayMs;
    all.push(old);
    localStorage.setItem('tenki.alert.outcomes.v1', JSON.stringify(all));
    window.openSessionDetail(old.ts);
    const card = document.querySelector('.sd-facts');
    return {
      hidden: document.getElementById('sdFactAwayCell').hidden,
      n: [...card.querySelectorAll('.sd-fact')].filter((e) => !e.hidden).length,
      text: card.textContent,
      overflow: card.scrollWidth > card.clientWidth + 1,
    };
  });
  check('舊紀錄：離開格整格不顯示', legacy.hidden, true);
  check('舊紀錄：剩下三格', legacy.n, 3);
  check('🔴 舊紀錄不得出現「0 次」（缺欄位就不准說否定）', /0\s*次/.test(legacy.text), false);
  check('舊紀錄三格也不橫向溢出', legacy.overflow, false);
  await page.close();
}

// ═════════════════════════════════════════════════
// 決策紀律模式（Settings opt-in，預設關）
// user-facing 一律「決策紀律」；內部識別字仍是 SessionMode='trader'。
// ═════════════════════════════════════════════════
{
  console.log('\n── 決策紀律模式開關 ──');
  const page = await openV3(700);
  const off = await page.evaluate(() => ({
    on: disciplineOn(), fbd: watchMode('MANCINI_FBD'),
    aria: document.getElementById('labDisciplineTile').getAttribute('aria-pressed'),
  }));
  check('預設關閉', off.on, false);
  check('關閉時交易者模板不走守望', off.fbd, false);
  check('關閉時 aria-pressed=false', off.aria, 'false');

  await page.evaluate(() => window.toggleDisciplineMode());
  const on = await page.evaluate(() => ({
    on: disciplineOn(), fbd: watchMode('MANCINI_FBD'), health: watchMode('HEALTH_STRESS'),
    onCls: document.getElementById('labDisciplineTile').classList.contains('mode-on'),
  }));
  check('開啟後 disciplineOn() 為真', on.on, true);
  check('開啟後交易者模板走守望', on.fbd, true);
  check('🔴 開啟也不影響非交易者模板（Health Stress 仍走倒數）', on.health, false);
  check('開啟後磁磚上 mode-on', on.onCls, true);

  // Lab 版面：多一格不得把格線擠爆
  const lay = await page.evaluate(() => {
    window.goTab('lab');
    const g = document.querySelector('.lab-grid');
    const t = document.getElementById('labDisciplineTile');
    return {
      overflow: g.scrollWidth > g.clientWidth + 1,
      nameLines: t.querySelector('.nm').getClientRects().length,
      fits: t.scrollHeight <= Math.ceil(t.getBoundingClientRect().height) + 1,
    };
  });
  check('Lab 格線沒有橫向溢出', lay.overflow, false);
  check('磁磚標題只有 1 行', lay.nameLines, 1);
  check('磁磚裝得下自己的內容', lay.fits, true);

  // 決策進行中不得切換（與「跑中不得換模板」同一個理由）
  await page.evaluate(() => { window.goTab('today'); window.setState('ready'); window.setState('running'); });
  const before = await page.evaluate(() => disciplineOn());
  await page.evaluate(() => window.toggleDisciplineMode());
  const after = await page.evaluate(() => disciplineOn());
  check('決策進行中切換模式會被擋下', after, before);
  await page.close();
}

// ═════════════════════════════════════════════════
// 交易者模板收在開關後面（送審檢查表 #18）
//
// `Canslim` / `Mancini FBD` 是第三方方法論的名字（O'Neil / Adam Mancini），
// 交易者腦子裡本來就在用 —— 改名等於讓他看不懂自己的流程。
// 但 docs/APP_STORE_COMPLIANCE.md 檢查表 #18 說它們不得出現在可見 UI。
// 解法不是改名，是把它們收到 opt-in 後面：預設安裝（含審核員）看不到。
//
// 🔴 讀的是**移除 script/style 後的整頁文字**，不是「有沒有顯示」——
// `display:none` 的文字仍在 DOM 裡，那樣的 gate 擋不住任何抓文字的東西。
// ═════════════════════════════════════════════════
{
  console.log('\n── 交易者模板收在開關後面 ──');
  const page = await openV3(700);
  const pageText = () => page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style').forEach((n) => n.remove());
    return clone.textContent;
  });

  const off = await pageText();
  check('🔴 模式關閉時整頁不得出現 Canslim', /canslim/i.test(off), false);
  check('🔴 模式關閉時整頁不得出現 Mancini', /mancini/i.test(off), false);
  check('🔴 模式關閉時整頁不得出現 FBD', /\bFBD\b/.test(off), false);
  check('模式關閉時模板表只剩日常情境',
    await page.evaluate(() => !document.getElementById('tmplDisciplineGroup')), true);

  await page.evaluate(() => window.toggleDisciplineMode());
  await page.waitForTimeout(200);
  const on = await pageText();
  checkTruthy('開啟後 Canslim 回來了', /canslim/i.test(on));
  checkTruthy('開啟後 Mancini FBD 回來了', /mancini/i.test(on));
  check('開啟後三個交易者模板都在',
    await page.evaluate(() => document.querySelectorAll('#tmplDisciplineGroup .tmpl-item').length), 3);

  // 關回去要真的再消失（不是只在第一次生效）
  await page.evaluate(() => window.toggleDisciplineMode());
  await page.waitForTimeout(200);
  const off2 = await pageText();
  check('關回去之後又消失（來回都要成立）', /canslim/i.test(off2), false);
  await page.close();
}

// ═════════════════════════════════════════════════
// 結構守望：決策紀律模式下，交易者模板改用判定出口而不是倒數
//
// 為什麼不是把 v3 的倒數搬去快訊，而是反過來 —— decision-alert.html:694 記著
// 已經付過的學費：「用時間當紀律指標的結果是：品質最好的 setup 被罰得最重。」
// ═════════════════════════════════════════════════
{
  console.log('\n── 結構守望模式（390x700，刻意驗矮的）──');
  const page = await openV3(700);
  // ⚠️ 走**產品自己的開關**，不要直接寫 localStorage ——
  // 交易者模板現在是開關開了才進 DOM，直接改 storage 不會觸發同步，
  // 於是 querySelector 拿到 undefined（寫這條時實際踩到）。
  // 而且走真實路徑本來就比較誠實：使用者就是這樣打開它的。
  await page.evaluate(() => {
    window.toggleDisciplineMode();
    const el = [...document.querySelectorAll('.tmpl-item')].find((x) => x.dataset.id === 'MANCINI_FBD');
    window.selectTmpl(el);
  });
  await page.waitForTimeout(450);
  await page.evaluate(() => window.setState('running'));
  await page.waitForTimeout(1500);

  const run = await page.evaluate(() => ({
    watch: sess.watch,
    time: document.getElementById('fdcbTime').textContent,
    seg: document.getElementById('fdcbSeg').textContent,
    fill: document.getElementById('fdcbFill').style.width,
    inReadiness: document.getElementById('fdcb').classList.contains('in-readiness'),
  }));
  check('交易者模板在模式開啟時走守望', run.watch, true);
  check('🔴 守望不顯示總長（沒有截止時間這回事）', /\//.test(run.time), false);
  check('🔴 守望不推進填充條', run.fill === '0' || run.fill === '0px' || run.fill === '', true);
  check('守望不進 readiness 段（那是時間判紀律的東西）', run.inReadiness, false);
  checkTruthy(`段標籤說得出這是守望（${run.seg}）`, run.seg.includes('守望'));

  // 點 core：開判定列，而不是收束
  await page.evaluate(() => window.nextState());
  await page.waitForTimeout(420);
  const opened = await page.evaluate(() => ({
    open: document.getElementById('watchJudge').classList.contains('open'),
    running: document.getElementById('fdcb').className.includes('state-running'),
  }));
  check('點 core 開判定列', opened.open, true);
  check('🔴 點 core 不會直接收束（收束必須帶著判定）', opened.running, true);

  // 遮擋：用 elementFromPoint 問瀏覽器，不看 bounding rect
  const btns = await page.evaluate(() => [...document.querySelectorAll('#watchJudge .wj-btn')].map((b) => {
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { txt: b.textContent, lines: b.getClientRects().length, self: b.contains(hit) || b === hit };
  }));
  check('兩個判定出口都在', btns.length, 2);
  btns.forEach((b) => {
    check(`判定鍵「${b.txt}」沒被底座/tabbar 蓋住`, b.self, true);
    check(`判定鍵「${b.txt}」只有 1 行`, b.lines, 1);
  });

  // 判定 → 收束，走共用模組的語意
  await page.evaluate(() => window.judgeWatch('entered'));
  await page.waitForTimeout(300);
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('tenki.alert.outcomes.v1')).slice(-1)[0]);
  check('判定成立寫成 judged_entered', rec.outcomeTag, 'judged_entered');
  check('紀錄標上語意版本', rec.judgmentSchema, 'structure_watch_v1');
  checkTruthy('判定算紀律', await page.evaluate((t) => window.TENKI_OUTCOME.isDisciplined(t), rec.outcomeTag));
  check('收束後判定列收起', await page.evaluate(() => document.getElementById('watchJudge').classList.contains('open')), false);

  // 🔴 守望沒有 readiness 這個量 → 寫 null，畫面不得說否定
  check('🔴 守望紀錄的 reachedReadiness 是 null（不是 false）', rec.reachedReadiness, null);
  const detail = await page.evaluate((ts) => {
    window.goTab('session'); window.openSessionDetail(ts);
    return {
      fact: document.getElementById('sdFactReadiness').textContent,
      headline: document.getElementById('sdOutcomeHeadline').textContent,
      negative: /未達|未進入/.test(document.querySelector('.sd-body').textContent),
    };
  }, rec.ts);
  check('🔴 詳情頁不得對守望紀錄印出否定的 readiness', detail.negative, false);
  check('readiness 欄留白', detail.fact, '—');
  checkTruthy(`收束標題說得出判定（${detail.headline}）`, detail.headline.includes('判定'));

  // 對照組：同一個模式下，非交易者模板一個字都不變
  await page.evaluate(() => {
    window.setState('idle');
    const el = [...document.querySelectorAll('.tmpl-item')].find((x) => x.dataset.id === 'HEALTH_STRESS');
    window.selectTmpl(el);
  });
  await page.waitForTimeout(450);
  await page.evaluate(() => window.setState('running'));
  await page.waitForTimeout(1500);
  const ctrl = await page.evaluate(() => ({
    watch: sess.watch,
    time: document.getElementById('fdcbTime').textContent,
    fill: document.getElementById('fdcbFill').style.width,
  }));
  check('🔴 對照組：Health Stress 仍走倒數', ctrl.watch, false);
  checkTruthy(`對照組仍顯示總長（${ctrl.time}）`, ctrl.time.includes('/'));
  checkTruthy(`對照組填充條仍在推進（${ctrl.fill}）`, ctrl.fill !== '0' && ctrl.fill !== '0px' && ctrl.fill !== '');
  await page.close();
}

// ═════════════════════════════════════════════════
// Energy 長條圖不得被截斷
//
// founder 2026-08-20 實走：「體能 長條圖被截斷」。實測 ≤880px 高時
// .bb-bars 被 flex 壓成 33px，而長條仍是 JS 算出來的 53px 絕對高度，
// 上緣整排被 overflow:hidden 削掉 —— 而且**畫面上毫無破綻**。
//
// 🔴 不要用 `card.scrollHeight > card.clientHeight` 當斷言：實測在 bug 存在時
// 它仍然回報 false（壓扁被 .bb-bars 吸收，它自己的 overflow:hidden 又把後果吞掉）。
// **一個「藏起來」的容器會讓上層的溢出偵測說謊** —— 要直接問每一根長條。
//
// 🔴 而且要在**動畫跑動時逐幀量**：待機呼吸會把長條放大到 1.16 倍，
// 靜態量到「剛好放得下」不代表波峰不會被削。
// ═════════════════════════════════════════════════
{
  console.log('\n── Energy 長條圖（不得被截斷）──');
  for (const h of [932, 844, 760, 700, 660]) {
    const page = await openV3(h);
    await page.evaluate(() => {
      const t = document.getElementById('snapTrack');
      t.scrollLeft = t.querySelector('[data-page="3"]').offsetLeft;
    });
    await page.waitForTimeout(2600); // 等進場動畫（scaleY 0.06→1）跑完，進入待機呼吸

    const m = await page.evaluate(() => new Promise((res) => {
      const host = document.getElementById('bbBars');
      let clippedFrames = 0; let maxH = 0; let frames = 0;
      (function f() {
        const hr = host.getBoundingClientRect();
        [...host.children].forEach((x) => {
          const r = x.getBoundingClientRect();
          if (r.top < hr.top - 0.5) clippedFrames++;      // 頂端被容器切掉
          if (r.height > maxH) maxH = r.height;
        });
        if (++frames < 90) requestAnimationFrame(f);
        else res({
          clippedFrames,
          maxH: +maxH.toFixed(1),
          boxH: +hr.height.toFixed(1),
          n: host.children.length,
          shortest: Math.min(...[...host.children].map((x) => x.getBoundingClientRect().height)),
          barsOverflow: host.scrollHeight > host.clientHeight + 1,
        });
      })();
    }));

    check(`${h}px：🔴 沒有任何一根長條被切（90 幀取樣，含呼吸波峰）`, m.clippedFrames, 0);
    checkTruthy(`${h}px：最高的長條放得進容器（${m.maxH} ≤ ${m.boxH}）`, m.maxH <= m.boxH + 0.5);
    check(`${h}px：長條容器自己不溢出`, m.barsOverflow, false);
    check(`${h}px：15 根長條都在`, m.n, 15);
    checkTruthy(`${h}px：最矮的長條仍看得見（${m.shortest.toFixed(1)}px）`, m.shortest >= 6);
    await page.close();
  }
}

// ═════════════════════════════════════════════════
// 環心的新鮮度那一行：可以兩行，但**不准把詞斷成孤字**
//
// founder 2026-08-25 實走截圖：過期狀態的「讀數已過期 · 重新掃一次」在環心裡
// 逐字斷行，390 寬實測 122px + 12px —— 也就是「…重新掃一」/「次」，
// 一個孤字掉到第二行。這一格在此之前**完全沒有斷言**（第三輪補了讀數與動作鍵，
// 漏了它），所以沒有任何東西會喊痛。
//
// 🔴 斷言問的是**意圖**不是行數：這一行本來就放不下一行（環心只有 121~129px），
// 所以不能要求「1 行」；要求的是**每一行都不是孤字**。
// ⚠️ 也不能改用 nowrap —— 那串比環心寬，只會推出圓外（第三輪付過的學費）。
// ═════════════════════════════════════════════════
{
  console.log('\n── 環心新鮮度那一行（過期文案不得斷成孤字）──');
  for (const width of [360, 375, 390, 414]) {
    const page = await openV3(700, { width, readingAgeMs: 40 * 60e3 });
    const m = await page.evaluate(() => {
      const z = document.getElementById('edgeTraceZone');
      const c = document.querySelector('.tl-edge-center');
      const r = document.createRange(); r.selectNodeContents(z);
      const rects = [...r.getClientRects()].map((x) => Math.round(x.width));
      const zr = z.getBoundingClientRect(); const cr = c.getBoundingClientRect();
      return {
        text: z.textContent, rects,
        inside: zr.left >= cr.left - 0.5 && zr.right <= cr.right + 0.5
          && zr.top >= cr.top - 0.5 && zr.bottom <= cr.bottom + 0.5,
      };
    });
    checkTruthy(`${width}px：過期時這一行有話說（${m.text}）`, /過期/.test(m.text));
    // 12px 字級下 3 個字約 36px —— 比這更窄的一行就是被斷出來的孤字。
    checkTruthy(`${width}px：🔴 沒有孤字（每行寬度 ${JSON.stringify(m.rects)}）`,
      m.rects.length > 0 && Math.min(...m.rects) >= 36);
    check(`${width}px：這一行整個在環心圓內`, m.inside, true);
    await page.close();
  }
}

// ═════════════════════════════════════════════════
// 「決策進行中」標記（docs/TRADINGVIEW-ALERT-SPEC.md §8）
//
// 跨頁那一半（快訊真的安靜下來）由 preview-decision-chain.mjs 驗 —— 它要開兩個
// page。這裡驗的是**這一頁自己的責任**：標記在 running 時存在、其餘 state 一律
// 消失，而且**自己起跑的決策也算「進行中」**（§8 說的是 Session，不是「快訊來的
// Session」）。⚠️ 交棒那條路會在 acceptHandoff 裡再發佈一次，所以只驗快訊鏈
// 的話，setState 這條路壞掉不會有任何東西喊痛 —— 實測過，真的全綠。
// ═════════════════════════════════════════════════
{
  console.log('\n── 決策進行中標記（自己起跑的決策也算）──');
  const page = await openV3(700);
  const KEY = 'tenki.v6.activeDecision.v1';
  const read = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

  check('idle 時沒有標記', await read(), null);
  await page.evaluate(() => { window.nextState(); window.nextState(); }); // idle→ready→running
  await page.waitForTimeout(600);
  // ⚠️ 標記不存在時**每一條都要是具名失敗**，不是 TypeError ——
  // 反向驗證時實際踩到：拿掉發佈之後前兩條紅完，第三條讀 m.expiresAtMs 直接把
  // 腳本炸掉，下一個人看到的是 stack trace 而不是「標記沒發佈」。
  const m = (await read()) || {};
  checkTruthy('🔴 自己起跑的決策也要發佈標記（不是只有快訊來的）',
    typeof m.startedAtMs === 'number');
  check('沒有標的就寫 null，不編一個', m.symbol === undefined ? '(沒有標記)' : m.symbol, null);
  checkTruthy('標記自帶到期時間（心跳在背景會說謊，所以不用心跳）',
    typeof m.expiresAtMs === 'number' && m.expiresAtMs > Date.now());
  // 倒數模式的到期＝模板時長＋寬限，**不是**守望那個 30 分鐘上限。
  const dur = await page.evaluate(() => TEMPLATES[currentTmpl].durationSec);
  const span = typeof m.expiresAtMs === 'number' ? (m.expiresAtMs - m.startedAtMs) / 1000 : null;
  checkTruthy(`到期時間貼著這個模板的時長（${span === null ? '沒有標記' : Math.round(span) + 's'} vs ${dur}s）`,
    span !== null && span <= dur + 120);

  await page.evaluate(() => window.nextState());   // running → 收束
  await page.waitForTimeout(600);
  check('🔴 收束後標記一定要消失（留著會靜默吃掉之後每一則快訊）', await read(), null);

  // 🔴 第十輪的閘門：Session 列上「標的 · 流程名」只給**快訊決策**。
  // saveV6Outcome 對自己起跑的決策寫的是 `symbol: session.name`（＝模板名），
  // 所以少了 `source === 'alert'` 這道閘門就會印出「Health Stress · Health Stress」。
  await page.evaluate(() => window.goTab('session'));
  await page.waitForTimeout(600);
  const selfRow = await page.evaluate(() => {
    const nm = document.querySelector('#sessionList .session-item .nm');
    return nm ? nm.textContent.trim() : null;
  });
  checkTruthy(`自己起跑的決策：Session 列有名字（${selfRow}）`, !!selfRow);
  check('🔴 自己起跑的決策不得被印成「模板名 · 模板名」', /(.+) · \1/.test(selfRow || ''), false);
  await page.close();
}

await browser.close();
server.close();
console.log(failed === 0 ? '\n🟢 全綠' : `\n🔴 ${failed} 條失敗`);
process.exit(failed === 0 ? 0 : 1);

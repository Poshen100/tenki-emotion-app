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
import { getChromium } from './lib/playwright.mjs';
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
  const options = Object.assign({ reading: true, width: 390 }, opts || {});
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
    if (opts.reading) {
      localStorage.setItem('tenki.readiness.reading.v1', JSON.stringify({
        band: 'neutral', confidence: 'high', ts: Date.now() - 120e3, baselineDays: 1, baselineScans: 1,
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

await browser.close();
server.close();
console.log(failed === 0 ? '\n🟢 全綠' : `\n🔴 ${failed} 條失敗`);
process.exit(failed === 0 ? 0 : 1);

/**
 * preview-today-layout.mjs — 守 /v3/ Today 版面的兩條「看得見就是壞了」規則。
 *
 * A. 環心黑圓裡那顆 chip 的長度上限。
 *
 * 為什麼需要這支：`.tl-edge-center` 是 `.tl-edge` 的 62%，在 375px 手機上只有
 * ~112px 寬。任何住在裡面的文案一旦超過那個寬度就會**斷在詞中間**（founder
 * 2026-08-29 實走截圖：「信心中 · 提／升精度 ›」），而 CI 看不到 apps/preview/**。
 * 這支把「文案長度」變成可驗證的目標：每一個會被寫進 chip 的字串，在每一種
 * 手機寬度下，都必須單行且不溢出黑圓。
 *
 * 加新文案時：把字串加進 index.html，這支會自動掃到（它從原始碼撈字面值）。
 *
 * B. 「滑動看更多」提示不得疊在任何讀數上。這條踩過兩次（先蓋波形圖、再蓋
 *    68 BPM / 49 ms），兩次都是 founder 用手機截圖抓到的 —— 所以把它變成
 *    幾何斷言：hint 的矩形不得與卡片、示意註記、圓點、FDCB dock 相交。
 *
 * Run: node scripts/preview-today-layout.mjs
 */
// ⚠️ 本分支把 Playwright 的取得集中到 scripts/lib/playwright.mjs（第四輪）——
// 寫死 /opt/node22/... 的絕對路徑在 CI runner 上不存在。
import { getChromium } from './lib/playwright.mjs';
const chromium = await getChromium();
import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const PAGE = 'apps/preview/v6/index.html';
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.mjs':'text/javascript', '.json':'application/json', '.png':'image/png',
  '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

// 從原始碼撈出所有會進 chip 的字面值，這樣新文案不必手動同步到測試裡。
// 每個字串綁到它真正住的元素上量 —— 兩顆 chip 的字級/字重/padding 不同。
const src = readFileSync(join(repoRoot, PAGE), 'utf8');
const CASES = [];
const add = (id, text) => {
  if (text && text.length < 40 && !CASES.some((c) => c.id === id && c.text === text)) {
    CASES.push({ id, text });
  }
};

for (const m of src.match(/'信心[^']*'/g) ?? []) add('edgeConfidence', m.slice(1, -1));
add('edgeConfidence', (src.match(/class="tl-edge-conf"[^>]*>([^<]+)</) ?? [])[1]);
add('edgeScanCta', (src.match(/class="tl-edge-cta"[^>]*>([^<]+)</) ?? [])[1]);

// 動態組出來的那種（'信心中' + ' · 提升 ›'）也要算進來。
const suffix = src.match(/CONFIDENCE_LABEL_V6\[r\.confidence\] \+ '([^']*)'/);
if (suffix) {
  for (const base of src.match(/'信心[高中低]'/g) ?? []) {
    add('edgeConfidence', base.slice(1, -1) + suffix[1]);
  }
}

const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  // 複刻 Vercel 的 rewrite：/preview/(.*) → apps/preview/$1
  if (clean.startsWith('/preview/')) clean = '/apps/preview/' + clean.slice('/preview/'.length);
  let file = join(repoRoot, clean);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !file.startsWith(repoRoot)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/${PAGE}`;

/** 真機字型與沙箱 fallback 的寬度落差保留量。 */
const HEADROOM_PX = 6;

// 🔴 A 的界線在這條分支上換了對象，原因不是「放寬讓它過」：
//
// main 的版本把兩顆 chip 放在**環心黑圓裡**，所以界線是黑圓寬（~112px @375）。
// 這條分支第三輪把它們**搬出環心**了 —— 實測依據寫在 index.html 的 markup 註解：
// 環心只有 121~129px，而「信心中　·　提升精度 ›」要 138px、「信心 · 中　·　提升精度 ›」
// 要 148.5px，**任何字級微調都塞不進去**；而且圓裡的內容高度在每一個寬度都 >= 圓高。
// 搬出來之後它們有整個螢幕寬。
//
// 所以拿黑圓當界線會對這條分支報 5 條假紅（它們根本不在圓裡）。
// 但 A 想守的那件事**沒有變**：founder 2026-08-29 看到的是「信心中 · 提／升精度 ›」
// **斷在詞中間**。那件事在這裡的等價界線是「單行，而且整顆 chip 在畫面內」。
// 圓**裡面**剩下的內容（讀數／狀態讀數／新鮮度）由 preview-fdcb.mjs 的
// 圓形容器斷言守著（那支問的是 hypot(角 − 圓心)，不是方框）。
const CHIP_SCREEN_MARGIN_PX = 16;

const VIEWPORTS = [
  { name: 'iPhone SE 375x667', width: 375, height: 667 },
  { name: 'iPhone 12 390x844', width: 390, height: 844 },
  { name: 'Pro Max 430x932',   width: 430, height: 932 },
];

const browser = await chromium.launch();
let pass = 0;
let fail = 0;
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(800);

  const rows = await page.evaluate((cases) => {
    const centre = document.querySelector('.tl-edge-center');
    if (!centre) return null;
    const discW = centre.getBoundingClientRect().width;
    // chip 實際住在哪：在圓裡就用圓寬，在圓外就用畫面寬。用 contains 直接問，
    // 不要用猜的 —— 哪天有人再把它搬回圓裡，這支會自己跟著改回嚴格的界線。
    const frameW = (document.querySelector('.phone') || document.documentElement)
      .getBoundingClientRect().width;
    const out = [];
    for (const c of cases) {
      const el = document.getElementById(c.id);
      if (!el) { out.push({ ...c, missing: true }); continue; }
      const was = { hidden: el.hidden, text: el.textContent };
      el.hidden = false;
      el.textContent = c.text;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const inner = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
      out.push({ ...c, lines: Math.round(inner / lh), w: +r.width.toFixed(1),
        inCircle: centre.contains(el), frameW: +frameW.toFixed(1) });
      el.hidden = was.hidden; el.textContent = was.text;
    }
    return { discW: +discW.toFixed(1), out };
  }, CASES);

  if (!rows) { console.error(`✗ ${vp.name}: 找不到黑圓`); fail++; await page.close(); continue; }
  console.log(`\n── ${vp.name} · 黑圓 ${rows.discW}px ──`);
  for (const r of rows.out) {
    // 6px 安全邊際：沙箱載不到 Inter（Google Fonts 被擋），真機字寬會略有出入。
    const limit = r.inCircle
      ? rows.discW - HEADROOM_PX
      : r.frameW - CHIP_SCREEN_MARGIN_PX * 2 - HEADROOM_PX;
    const where = r.inCircle ? '圓內' : '圓外';
    const ok = r.lines === 1 && r.w <= limit;
    if (ok) pass++; else fail++;
    console.log(`  ${ok ? '✓' : '✗'} 「${r.text}」 ${r.w}px · ${r.lines} 行 · ${where}（上限 ${limit.toFixed(1)}px）` +
      (ok || r.missing ? '' : `  ← 超出 ${(r.w - limit).toFixed(1)}px`));
  }
  await page.close();
}

// ── B. 「滑動看更多」提示不得疊在任何讀數上 ─────────────────────────────
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  // 🔴 提示只亮 **4.8 秒**（頁面的 `hideTimer=setTimeout(dismiss,4800)`），
  //    而 `waitForSelector` 是去**輪詢一個會自己消失的狀態** —— 那本來就是在賭。
  //    2026-11-15 在 runner 上三次 2 紅，而且只在最矮的 375x667；診斷印出
  //    `{"exists":true,"cls":"snap-hint",…}`：節點在、`.on` 不在 —— 也就是
  //    「它亮過又熄了，而我們沒接到」。
  //    改成在頁面腳本跑之前就掛觀察器，`.on` 一上身就把那一刻的幾何**鎖住**。
  //    守的東西一模一樣（提示不得疊到任何讀數），只是不再跟一個 4.8 秒的
  //    窗口賽跑 —— 而且量到的是它真正亮著那一瞬間的座標，比事後再問更準。
  await page.addInitScript(() => {
    const TARGETS = [
      ['可見的那張卡', '#snapTrack .vcard'],
      ['示意註記', '.vitals-demo-note'],
      ['輪播圓點', '#snapDots'],
      ['FDCB dock', '#fdcb'],
    ];
    window.__tenkiHint = null;
    const snap = () => {
      const h = document.getElementById('snapHint');
      if (!h || !h.classList.contains('on') || window.__tenkiHint) return;
      const r = h.getBoundingClientRect();
      window.__tenkiHint = {
        top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
        viewportH: window.innerHeight,
        hit: TARGETS.filter(([, sel]) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const b = el.getBoundingClientRect();
          return !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom);
        }).map(([n]) => n),
      };
    };
    // ⚠️ addInitScript 跑在**任何 DOM 之前** —— 這時候 `document.documentElement`
    //    還是 null，直接 observe 會丟例外，而那個例外會把整段觀察器吃掉
    //    （第一版就是這樣：三個 viewport 全部「沒出現」）。等 DOM 在了再掛。
    const install = () => {
      if (!document.documentElement) return false;
      new MutationObserver(snap).observe(document.documentElement, {
        subtree: true, attributes: true, attributeFilter: ['class'], childList: true,
      });
      snap(); // 掛上去之前就已經 .on 的話，觀察器不會補報
      return true;
    };
    if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
  });
  // ?hint=1 強制顯示（它平常只出現一次），這是頁面自己提供的重測開關。
  await page.goto(`${url}?hint=1`, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const sp = document.getElementById('tenki-splash');
    if (sp) { sp.setAttribute('data-hidden', 'true'); sp.style.display = 'none'; }
  });
  // 🔴 頁面只在輪播**真的在畫面上**的時候才教那個手勢：
  //      var onScreen = r.width>0 && r.top<innerHeight && r.bottom>0;
  //      if(revealed && onScreen){ setTimeout(show, …) } else setTimeout(arm,200);
  //    那是對的產品行為（看不到的東西不要教），但它讓這條斷言依賴一個**邊緣
  //    條件**：在最矮的 375x667 上，輪播剛好卡在摺線附近，幾 px 的字高差就能
  //    決定它在摺線上面還是下面。runner 上在下面、容器裡在上面 ——
  //    於是同一份程式一邊綠一邊紅（2026-11-15 main 連紅兩次都是這條）。
  //    所以先把前提**建立起來**再量，而不是碰運氣：捲到輪播可見。
  //    守的東西沒變（提示不得疊到任何讀數），只是不再賭它剛好在摺線上面。
  const trackVis = await page.evaluate(() => {
    const t = document.getElementById('snapTrack');
    if (!t) return null;
    const before = t.getBoundingClientRect();
    const wasOn = before.width > 0 && before.top < window.innerHeight && before.bottom > 0;
    if (!wasOn) t.scrollIntoView({ block: 'center' });
    return { wasOn, top: Math.round(before.top), innerH: window.innerHeight };
  });
  const appeared = await page
    .waitForFunction(() => window.__tenkiHint !== null, null, { timeout: 12_000 })
    .then(() => true, () => false);

  console.log(`\n── ${vp.name} · 滑動提示 ──`);
  if (trackVis && !trackVis.wasOn) {
    console.log(`  · 輪播本來在摺線下（top=${trackVis.top} / 視窗高 ${trackVis.innerH}），已捲進畫面再量`);
  }
  if (!appeared) {
    // 🔴 「沒出現」有三種完全不同的成因，而且修法不同 —— 不說是哪一種，
    //    下一次 CI 紅的時候還是只能猜（2026-11-15 在 runner 上就卡在這）。
    //      a. 節點不在        → 這一版的 DOM 變了
    //      b. 節點在、沒有 .on → 走到了 `if(cur!==0){…return}`（輪播已經不在第一頁），
    //                           或已經被 4800ms 的 hideTimer 關掉
    //      c. 輪播 scrollLeft 不是 0 → 就是上面那個 cur!==0 的成因本身
    const why = await page.evaluate(() => {
      const h = document.getElementById('snapHint');
      const t = document.getElementById('snapTrack');
      return {
        exists: !!h,
        cls: h ? h.className : null,
        scrollLeft: t ? Math.round(t.scrollLeft) : null,
        clientW: t ? Math.round(t.clientWidth) : null,
        seen: (() => { try { return localStorage.getItem('tenki.snapHintSeen3'); } catch (e) { return 'n/a'; } })(),
      };
    }).catch(() => null);
    console.log('  ✗ 提示沒出現（?hint=1 應該要強制顯示）');
    console.log(`     診斷：${JSON.stringify(why)}`);
    console.log(`     輪播可見性：${JSON.stringify(trackVis)}`);
    fail++; await page.close(); continue;
  }

  // 🔴 讀的是**鎖住的那一刻**，不是事後再問一次 —— 事後問到的可能是已經熄掉
  //    的提示，而那時候的座標不代表它亮著時疊到了什麼。
  const hits = await page.evaluate(() => {
    const s = window.__tenkiHint;
    return {
      hint: { top: s.top, bottom: s.bottom },
      viewportH: s.viewportH,
      hit: s.hit,
    };
  });

  const onScreen = hits.hint.top >= 0 && hits.hint.bottom <= hits.viewportH;
  if (hits.hit.length === 0 && onScreen) {
    pass++;
    console.log(`  ✓ 提示落在 y=${hits.hint.top}–${hits.hint.bottom}，沒有疊到任何讀數`);
  } else {
    fail++;
    if (hits.hit.length) console.log(`  ✗ 疊到：${hits.hit.join('、')}`);
    if (!onScreen) console.log(`  ✗ 跑出視窗（y=${hits.hint.top}–${hits.hint.bottom}, 視窗高 ${hits.viewportH}）`);
  }
  await page.close();
}

// ══════════════════════════════════════════════════════════════
// Scan 分頁：那一組要置中在**看得見的**範圍，不是置中在包含決策條的範圍
// ══════════════════════════════════════════════════════════════
// 🔴 2026-10-28 查出來：`.scan-hero` 是全 app 唯一漏掉底部保留區的容器
//    （`.snap` / session / `.timeline-body` / `.lab-body` 四個都有）。
//    `justify-content:center` 於是把那 128px（tabbar 74 + gap 10 + fdcb 44）
//    也算進置中範圍 —— 整組永遠比真正的置中低 128px，而在 SE 上
//    說明文字**整段壓進決策條 31px**。
console.log('\n── Scan 分頁：置中範圍 ──');
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await page.addInitScript(() => {
    localStorage.setItem('tenki.readiness.reading.v1', JSON.stringify({
      band: 'clear', confidence: 'high', ts: Date.now() - 44 * 60e3,
      baselineDays: 1, baselineScans: 1,
    }));
  });
  await page.goto(`${url}#scan`, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3600);   // splash AUTO_DISMISS_AT = 2400ms
  const g = await page.evaluate(() => {
    const R = (sel) => {
      const e = document.querySelector(sel);
      const r = e && e.getBoundingClientRect();
      return r && r.height > 0 ? r : null;
    };
    const hdr = R('#scan-screen .screen-header');
    const first = R('#scanLast') || R('.scan-button');
    const last = R('#scanHint') || R('#scanEvidence') || R('.scan-button');
    const bar = R('.fdcb');
    if (!hdr || !first || !last || !bar) return null;
    return { above: first.top - hdr.bottom, below: bar.top - last.bottom };
  });
  if (!g) {
    fail++; console.log(`✗ ${vp.name} 量不到 Scan 分頁的元素（前提就不成立，不是版面問題）`);
    await page.close(); continue;
  }
  // 🔴 成對的兩條。只驗「沒壓到」的話，整組往上飛出畫面也會綠。
  const overlap = g.below < 0;
  if (!overlap) { pass++; console.log(`✓ ${vp.name} 沒壓到決策條（下方 ${g.below.toFixed(0)}px）`); }
  else { fail++; console.log(`✗ ${vp.name} **壓到決策條 ${(-g.below).toFixed(0)}px**（下方 ${g.below.toFixed(0)}px）`); }
  const balanced = Math.abs(g.above - g.below) <= 2;
  if (balanced) { pass++; console.log(`✓ ${vp.name} 真正置中（上 ${g.above.toFixed(0)} / 下 ${g.below.toFixed(0)}）`); }
  else {
    fail++;
    console.log(`✗ ${vp.name} 不是置中：上 ${g.above.toFixed(0)} / 下 ${g.below.toFixed(0)}`
      + ` —— 差 ${(g.above - g.below).toFixed(0)}px`
      + `${Math.abs(g.above - g.below - 128) < 3 ? '（＝ tabbar+gap+fdcb，保留區又掉了）' : ''}`);
  }
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);

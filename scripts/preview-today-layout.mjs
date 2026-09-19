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
  // ?hint=1 強制顯示（它平常只出現一次），這是頁面自己提供的重測開關。
  await page.goto(`${url}?hint=1`, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const sp = document.getElementById('tenki-splash');
    if (sp) { sp.setAttribute('data-hidden', 'true'); sp.style.display = 'none'; }
  });
  const appeared = await page.waitForSelector('.snap-hint.on', { timeout: 12_000 }).then(() => true, () => false);

  console.log(`\n── ${vp.name} · 滑動提示 ──`);
  if (!appeared) { console.log('  ✗ 提示沒出現（?hint=1 應該要強制顯示）'); fail++; await page.close(); continue; }

  const hits = await page.evaluate(() => {
    const hint = document.getElementById('snapHint').getBoundingClientRect();
    const overlaps = (r) => !(r.right <= hint.left || r.left >= hint.right
      || r.bottom <= hint.top || r.top >= hint.bottom);
    const targets = [
      ['可見的那張卡', document.querySelector('#snapTrack .vcard')],
      ['示意註記', document.querySelector('.vitals-demo-note')],
      ['輪播圓點', document.getElementById('snapDots')],
      ['FDCB dock', document.getElementById('fdcb')],
    ];
    return {
      hint: { top: +hint.top.toFixed(1), bottom: +hint.bottom.toFixed(1) },
      viewportH: window.innerHeight,
      hit: targets.filter(([, el]) => el && overlaps(el.getBoundingClientRect())).map(([n]) => n),
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

await browser.close();
server.close();
console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);

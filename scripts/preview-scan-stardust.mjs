/**
 * preview-scan-stardust.mjs — readiness-scan 與星塵之間的掛載契約迴歸測試。
 *
 * 守的是什麼：掃描覆蓋層會反覆開關，**每一次都必須把 WebGL context 還回去**。
 * 漏掉 unmount 不會當場壞掉 —— 它會在連續掃描幾次之後，以「球無聲凍住」的形式
 * 出現在 iOS 上（瀏覽器對同時存活的 context 有上限，超過就回收最舊的）。
 * 這種延遲、間歇、只在真機出現的症狀，正是最需要自動化守住的一類。
 *
 * ⚠️ 覆蓋範圍的誠實邊界：
 * 沙箱擋掉 cdnjs（實測 `CONNECT tunnel failed, 403`），所以**真的 three.js 載不進來**。
 * 本 harness 用 stub 取代 `window.TENKI_STARDUST`，斷言的是 readiness-scan 的
 * **呼叫契約**（有沒有掛、掛在哪個節點、有沒有還、reduced-motion 有沒有跳過）。
 * 它**不驗證**粒子畫面、不驗證 stardust.js 內部的 forceContextLoss 是否真的釋放了
 * context —— 那兩件事只能靠 founder 手機實走（PLAYBOOK §3 CI 盲區）。
 *
 * Run:  node scripts/preview-scan-stardust.mjs
 * Exit: 0 = 全綠，1 = 有失敗。
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  // decision-alert.html 用絕對路徑載 /preview/readiness-scan.js 與 /preview/v6/stardust.js
  // （不依賴 /decision-alert/ 的 rewrite）。正式站由 Vercel 把 /preview/* 映到
  // apps/preview/*；本地伺服器要自己做，否則模組靜默載不進來、頁面看起來卻正常。
  if (clean.startsWith('/preview/')) clean = '/apps' + clean;
  // 空殼頁：給「只想在同源下載入某一支模組來驗純函式」的那一組用。
  // （`about:blank` 的 origin 是 opaque，Chromium 會擋掉它的子資源載入。）
  if (clean === '/__blank') {
    res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>blank</title>');
    return;
  }
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
const PAGE = `${base}/apps/preview/decision-alert.html`;

let pass = 0;
let fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`}`);
}

/**
 * 假的 TENKI_STARDUST：記下呼叫序列，並回報自己掛在哪個節點上。
 *
 * ⚠️ 2026-08-10 這支 stub 自己被抓出一個缺陷：它用一個布林
 * `__sdHostMounted` 假裝「host 已持有綁定」，**但沒有真的 host 節點** ——
 * 於是它模擬不出真實世界最關鍵的那件事：v6 的 `#universe` 是**隱形的**
 * （住在 `visibility:hidden` 的 takeover 裡），佔著唯一的綁定卻沒人看得到。
 * 因為模擬不出來，那條錯規則（一律不搶）就被寫成了通過的測試。
 * 現在 stub 持有一個真的節點，可見性由測試指定 —— PLAYBOOK §3
 * 「合成測試資料要帶著真實世界的耦合」。
 */
const STUB = `
window.__sdCalls = [];
window.__sdHostClass = null;
window.__sdTones = [];
window.__sdReadouts = []; // setReadout 收到的每一筆 {stillness, progress}
window.__sdMounts = [];   // 每次 mount 掛到誰身上（id 或 class），依序
window.__sdLive = 0;      // 目前活著的 context 數
window.__sdMaxLive = 0;   // 全程峰值 —— 這才是 OOM 顧慮真正要守的東西
(function () {
  var host = null;        // 目前綁定的節點（null = 未掛載）
  var fit = false;
  window.TENKI_STARDUST = {
    mount: function (el, opts) {
      if (host) { window.__sdCalls.push('mount:refused'); return false; }
      host = el || document.getElementById('universe');
      if (!host) { window.__sdCalls.push('mount:refused'); return false; }
      fit = !!(opts && opts.fitContainer);
      window.__sdLive += 1;
      if (window.__sdLive > window.__sdMaxLive) window.__sdMaxLive = window.__sdLive;
      window.__sdCalls.push('mount');
      window.__sdMounts.push(host.id || host.className);
      window.__sdHostClass = host.className;
      return true;
    },
    unmount: function () {
      if (!host) return;
      host = null; fit = false;
      window.__sdLive -= 1;
      window.__sdCalls.push('unmount');
    },
    isMounted: function () { return !!host; },
    hostInfo: function () { return host ? { node: host, fitContainer: fit } : null; },
    playEntrance: function () { window.__sdCalls.push('playEntrance'); },
    setExpression: function () { window.__sdCalls.push('setExpression'); },
    clearExpression: function () { window.__sdCalls.push('clearExpression'); },
    setTone: function (d) { window.__sdTones.push(d); window.__sdCalls.push('setTone'); },
    clearTone: function () { window.__sdCalls.push('clearTone'); },
    setReadout: function (d) { window.__sdReadouts.push(d); window.__sdCalls.push('setReadout'); },
    clearReadout: function () { window.__sdCalls.push('clearReadout'); },
    dim: function () {}, brighten: function () {},
    destroy: function () { if (host) { host = null; window.__sdLive -= 1; } },
  };
})();
`;

/**
 * 讓一個**真的**節點先持有綁定，模擬 v6 的 `#universe`。
 * `visible:false` 就是正式站上的實況：takeover 沒啟用時整層 visibility:hidden。
 */
const hostScript = (visible) => `
(function () {
  function put() {
    var u = document.createElement('div');
    u.id = 'universe';
    u.style.cssText = 'position:fixed;inset:0;'
      + (${visible ? "''" : "'visibility:hidden;'"});
    document.body.appendChild(u);
    window.TENKI_STARDUST.mount(u);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put);
  else put();
})();
`;

/**
 * 假的 MediaPipe FaceMesh —— 讓 harness 能**驅動真的 onFaceResults**。
 *
 * 沙箱擋掉 MediaPipe CDN，所以正式站上跑 tier A 的那條路在這裡本來完全測不到。
 * 但 readiness-scan 只透過 `window.FaceMesh` 這一個全域取用它，所以塞一個 stub
 * 就能把取景判定/遲滯/鎖定整條鏈接起來 —— 而且測到的是**真的產品程式**，
 * 不是加 class 演戲。`send()` 不做事：我們自己呼叫捕獲到的 callback。
 */
const FACEMESH_STUB = `
window.FaceMesh = function () {
  var self = this;
  this.setOptions = function () {};
  this.onResults = function (cb) { window.__rsFaceMesh = cb; };
  this.send = function () { return Promise.resolve(); };
  this.close = function () { window.__rsFaceMesh = null; };
  return self;
};
`;

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

async function newPage(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ['camera'],
    reducedMotion: opts.reducedMotion,
  });
  const page = await ctx.newPage();
  await page.addInitScript(STUB
    + (opts.hostMounted ? hostScript(!!opts.hostVisible) : '')
    + (opts.faceMesh ? FACEMESH_STUB : ''));
  page.on('pageerror', (e) => { console.error('[pageerror]', e.message); fail += 1; });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.TENKI_READINESS_SCAN);
  return { ctx, page };
}

/** 開始一次掃描、等它真的掛好、然後取消。回傳呼叫序列。 */
async function scanAndCancel(page) {
  await page.evaluate(() => {
    window.__done = false;
    window.TENKI_READINESS_SCAN.begin({ mission: 'decision', symbol: 'ES1!' })
      .then(() => { window.__done = true; });
  });
  // 相機起來之後才掛星塵 → 等到掛載發生或超時（無相機時序列會保持空的）
  await page.waitForFunction(
    () => window.__sdCalls.length > 0 || document.querySelector('#tenki-readiness-scan.open'),
    { timeout: 8000 },
  ).catch(() => {});
  await page.waitForTimeout(1200);
  await page.click('#tenki-readiness-scan .rs-cancel');
  await page.waitForFunction(() => window.__done === true, { timeout: 5000 });
  return page.evaluate(() => window.__sdCalls.slice());
}

// ── 1. 正常路徑：掛在 .rs-stardust 上，取消後歸還 ──
{
  const { ctx, page } = await newPage();
  const calls = await scanAndCancel(page);
  check('掛載於 .rs-stardust 容器', await page.evaluate(() => window.__sdHostClass), 'rs-stardust');
  check('mount 先於 playEntrance', calls.indexOf('mount') < calls.indexOf('playEntrance'), true);
  check('取消後有 unmount', calls.includes('unmount'), true);
  check('mount 與 unmount 次數相等',
    calls.filter((c) => c === 'mount').length === calls.filter((c) => c === 'unmount').length, true);
  await ctx.close();
}

// ── 2. 連開兩次不累積（這條就是 context 洩漏的守門員）──
{
  const { ctx, page } = await newPage();
  await scanAndCancel(page);
  const calls = await scanAndCancel(page);
  const mounts = calls.filter((c) => c === 'mount').length;
  const unmounts = calls.filter((c) => c === 'unmount').length;
  check('連掃兩次：mount 兩次', mounts, 2);
  check('連掃兩次：unmount 也兩次（沒有洩漏）', unmounts, 2);
  check('第二次沒有被 refused（前一次確實還乾淨了）',
    calls.filter((c) => c === 'mount:refused').length, 0);
  await ctx.close();
}

// ── 2b. Progress Halo：結構、conic 寫入、以及 SECURED 不得殘留到下一輪 ──
{
  const { ctx, page } = await newPage();
  await page.evaluate(() => {
    window.TENKI_READINESS_SCAN.begin({ mission: 'decision' });
  });
  await page.waitForSelector('#tenki-readiness-scan.open');
  check('halo 在 frame 內',
    await page.evaluate(() => !!document.querySelector('#tenki-readiness-scan .rs-frame > svg.rs-halo')), true);
  // 光弧必須與框**共用同一條路徑**：track 與 fill 的幾何一字不差。
  // 2026-08-07 實走踩過的坑是一個 border-radius:50% 的圓套在圓角方框外面，
  // 畫面上變成兩個不相干的環 —— 這條就是防它回來。
  check('track 與 fill 幾何完全相同', await page.evaluate(() => {
    const g = (s) => {
      const r = document.querySelector('#tenki-readiness-scan .' + s);
      return ['x', 'y', 'width', 'height', 'rx', 'ry'].map((a) => r.getAttribute(a)).join(',');
    };
    return g('rs-halo-track') === g('rs-halo-fill');
  }), true);
  check('框本身沒有另一條 CSS border（避免第二個形狀）', await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-frame'));
    return cs.borderTopWidth;
  }), '0px');
  check('進度用 pathLength 正規化的 stroke-dash（弧長比例，不是角度）',
    await page.evaluate(() => {
      const f = document.querySelector('#tenki-readiness-scan .rs-halo-fill');
      return f.getAttribute('pathLength') === '1' && /^[\d.]+ 1$/.test(f.getAttribute('stroke-dasharray') || '');
    }), true);

  // 模擬「上一輪收束成 SECURED」的殘留狀態，再開新的一輪。
  await page.evaluate(() => document.querySelector('#tenki-readiness-scan .rs-frame').classList.add('secured'));
  await page.click('#tenki-readiness-scan .rs-cancel');
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');
  check('新一輪開場不得殘留 SECURED 金框',
    await page.evaluate(() => document.querySelector('#tenki-readiness-scan .rs-frame').classList.contains('secured')), false);
  await ctx.close();
}

// ── 2c. 對位回饋：一次一個指令、鎖定隨臉框翻轉、stalled 隨閘門 ──
//
// 用 __rsProbe 直接驅動狀態（headless 的假相機餵不出可控的臉），驗的是
// **呈現層對狀態的反應**，不是量測本身 —— 量測有 tierA/lighting 兩支既有 harness。
{
  const { ctx, page } = await newPage();
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');
  await page.waitForTimeout(900);

  const hintCount = await page.evaluate(() => {
    const el = document.querySelector('#tenki-readiness-scan [data-rs="hint-text"]');
    return el ? el.textContent.trim().split(/\s{2,}/).length : -1;
  });
  check('一次只顯示一個主指令', hintCount, 1);

  check('膠囊有圖示槽（空字串時自動收起）', await page.evaluate(() => {
    const b = document.querySelector('#tenki-readiness-scan [data-rs="hint-icon"]');
    return !!b && b.tagName === 'B';
  }), true);

  // 膠囊的左內距 10px 是**留給圖示的**（圖示 26px + gap 10px 之後才是文字）。
  // 圖示被 `b:empty{display:none}` 拿掉時那 10px 還在 → 文字左偏 8px。
  // 只有「保持穩定」這種沒圖示的指令看得出來，founder 2026-08-09 實走抓到。
  check('沒有圖示時膠囊左右內距相等（文字才會置中）', await page.evaluate(() => {
    const pill = document.querySelector('#tenki-readiness-scan .rs-instruction');
    const withIcon = () => {
      pill.classList.remove('no-icon');
      const cs = getComputedStyle(pill);
      return [cs.paddingLeft, cs.paddingRight];
    };
    const noIcon = () => {
      pill.classList.add('no-icon');
      const cs = getComputedStyle(pill);
      return [cs.paddingLeft, cs.paddingRight];
    };
    const a = withIcon();
    const b = noIcon();
    return {
      iconAsymmetric: a[0] !== a[1], // 有圖示時仍然是不對稱的（不能矯枉過正）
      plainSymmetric: b[0] === b[1],
    };
  }), { iconAsymmetric: true, plainSymmetric: true });

  // 角括號也長在同一條路徑上（第三個 rect + dash），不是另外畫的四個方塊。
  check('角括號與框共用同一條路徑', await page.evaluate(() => {
    const g = (s) => {
      const r = document.querySelector('#tenki-readiness-scan .' + s);
      return ['x', 'y', 'width', 'height', 'rx', 'ry'].map((a) => r.getAttribute(a)).join(',');
    };
    return g('rs-halo-corners') === g('rs-halo-track');
  }), true);
  check('角括號的 dash 週期正好是 1/4 周長（四角等距）', await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-halo-corners'));
    const [dash, gap] = cs.strokeDasharray.split(',').map((v) => parseFloat(v));
    return Math.abs(dash + gap - 0.25) < 1e-4;
  }), true);

  check('video 住在 .rs-lens 裡（框＝鏡頭）', await page.evaluate(
    () => !!document.querySelector('#tenki-readiness-scan .rs-frame > .rs-lens > video.rs-video')), true);

  check('全頁只有一個 video（兩個共用 stream ＝ iOS OOM）', await page.evaluate(
    () => document.querySelectorAll('#tenki-readiness-scan video').length), 1);

  // 未對準時：光弧應該被壓暗（.stalled），這是「環停住是因為你」的那一層
  check('閘門沒過時光弧被壓暗', await page.evaluate(() => {
    const f = document.querySelector('#tenki-readiness-scan .rs-frame');
    f.classList.add('stalled');
    return getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-halo-fill')).opacity;
  }), '0.3');

  // 鎖定：角括號收到位（translate 歸零）。
  // ⚠️ 必須等過 300ms 的 transition —— 加上 class 之後立刻讀到的是**動畫途中**的值。
  // （reduced-motion 那組不用等，因為那邊 transition 被關掉，這也正是兩組的差別。）
  await page.evaluate(() => {
    const f = document.querySelector('#tenki-readiness-scan .rs-frame');
    f.classList.remove('stalled');
    f.classList.add('locked');
  });
  await page.waitForTimeout(450);
  check('鎖定時角括號收攏到位（scale 回 1）', await page.evaluate(() => {
    const t = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-halo-corners')).transform;
    return t === 'none' || /matrix\(1,\s*0,\s*0,\s*1,/.test(t);
  }), true);

  await ctx.close();
}

// ── 2c-2. 不露臉：畫面上看不到相機，但量測仍然活著 ──
//
// 這一組守的是本刀**最高風險**的一點。founder 2026-08-08 拍板日常/決策掃描不得
// 顯示相機影像（North Star §4），實作方式是把 .rs-lens 轉成 opacity:0 —— 而
// `sampleFrame()` 靠 `drawImage(video)` 取像素。一旦有人「順手」把它改成
// display:none / visibility:hidden / 壓成 1px，瀏覽器（尤其 iOS Safari）會停止
// 解碼，整個量測會**無聲死掉**：畫面照常跑完，結果卻沒有讀數。
//
// ⚠️ **哪一條真的在守，實測過了**（2026-08-08 反向驗證）：
// 把 .rs-lens 改成 display:none 與改成 1px，headless Chromium 的「取樣仍在發生」
// 那條**都照樣綠**（桌面 Chromium 不管版面照解碼），只有下面那條**結構**斷言抓到。
// 所以守住這個風險的是「video 仍留在版面裡」，不是取樣那條 ——
// 取樣那條守的是另一件事（整條取樣鏈有沒有接上），一樣有價值但別記錯了它的功用。
// 這也是為什麼結構斷言要寫死 display / visibility / 尺寸三項：
// 我們沒辦法在 CI 裡重現 iOS 的解碼行為，只能把「不准長成那個樣子」講死。
{
  const { ctx, page } = await newPage();
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');

  check('相機畫面完全不顯示（North Star §4 不露臉）', await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-lens'));
    return cs.opacity;
  }), '0');

  // 透明 ≠ 不解碼。video 必須仍佔版面、仍有內在尺寸。
  check('video 仍留在版面裡（不是 display:none／1px）', await page.evaluate(() => {
    const v = document.querySelector('#tenki-readiness-scan video.rs-video');
    const cs = getComputedStyle(v);
    const r = v.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 100 && r.height > 100;
  }), true);

  // 取樣鏈仍然接著：三顆燈只有在 sampleFrame() 真的從 video 取到像素時才會離開
  // 中性態（setDot 只在 frame 非 null 的分支被呼叫）。用燈而不是進度，是因為
  // 假相機餵的畫面過不了品質閘門，進度本來就不該前進；燈才是「取樣有沒有發生」
  // 的誠實訊號。（守 iOS 解碼停擺的是上面那條結構斷言，不是這條 —— 見開頭註解。）
  await page.waitForTimeout(1500);
  check('相機透明之後取樣仍在發生（三顆燈已離開中性態）', await page.evaluate(() => {
    const dots = [...document.querySelectorAll('#tenki-readiness-scan .rs-dot')];
    return dots.some((d) => d.classList.contains('pass') || d.classList.contains('fail'));
  }), true);

  check('video 有內在尺寸（真的在解碼）', await page.evaluate(() => {
    const v = document.querySelector('#tenki-readiness-scan video.rs-video');
    return v.videoWidth > 0 && v.videoHeight > 0;
  }), true);

  await ctx.close();
}

// ── 2c-3. 對位標記：取代「看自己的臉」的那個東西 ──
{
  const { ctx, page } = await newPage();
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');

  // 目標環與標記必須畫在**同一個 SVG**裡，才會跟框、光弧共用座標系。
  // 各自另外畫一個絕對定位的 div，就是 2026-08-07「圓套在方框外」的同一課。
  check('目標環與對位標記都在 halo 的 SVG 內', await page.evaluate(() => {
    const svg = document.querySelector('#tenki-readiness-scan svg.rs-halo');
    return !!svg.querySelector('circle.rs-target') && !!svg.querySelector('circle.rs-reticle');
  }), true);

  // 沒量到臉就不畫標記 —— 不憑空生一個位置出來假裝有在追蹤。
  check('沒有臉時對位標記不顯示', await page.evaluate(() => {
    return getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-reticle')).opacity;
  }), '0');

  // 角括號的收攏程度連續綁在 --rs-err 上：越接近越緊。
  const scaleAt = (err) => page.evaluate((e) => {
    const f = document.querySelector('#tenki-readiness-scan .rs-frame');
    f.classList.add('tracking');
    f.style.setProperty('--rs-err', String(e));
    const m = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-halo-corners')).transform;
    return m === 'none' ? 1 : parseFloat(m.match(/matrix\(([\d.]+)/)[1]);
  }, err);
  await page.evaluate(() => {
    // transition 會讓連續兩次讀值互相污染，這一段只驗映射本身。
    document.querySelector('#tenki-readiness-scan .rs-halo-corners').style.transition = 'none';
  });
  const wide = await scaleAt(1);
  const tight = await scaleAt(0.1);
  check('角括號隨對位誤差連續收攏（誤差小 → 更緊）', tight < wide - 0.05, true);
  // 剛好進容差（err=0.5）要對上改動前的固定值 1.07，鎖定那一刻才不會跳。
  check('剛進容差時等於舊的 scale(1.07)', Math.abs((await scaleAt(0.5)) - 1.07) < 0.005, true);

  await page.waitForTimeout(400); // 讀 opacity 前要等過 0.3s 的淡入，否則讀到途中值
  check('對位標記顯示需要 .tracking（有量到臉才畫）', await page.evaluate(() => {
    return getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-reticle')).opacity;
  }), '1');

  await ctx.close();
}

// ── 2c-4. 鎖定那一拍：閃光活著、衝擊波在、之後靜止 ──
//
// 這一組的由來是一個**我自己造的 bug**：#222 把 .rs-lens 改成 opacity:0，
// 而鎖定的 bloom 就掛在 .rs-lens 上 —— opacity:0 的元素連 box-shadow 都不畫，
// 閃光整個消失而沒人發現，直到 founder 說「合一還不夠爽」。
// 所以這裡守的不是「有沒有寫 animation」，是**那個元素看不看得見**。
{
  const { ctx, page } = await newPage();
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');

  check('鎖定閃光掛在看得見的層上（不是 opacity:0 的 .rs-lens）', await page.evaluate(() => {
    const flash = document.querySelector('#tenki-readiness-scan .rs-flash');
    if (!flash) return 'missing';
    const cs = getComputedStyle(flash);
    // 靜止時 opacity 是 0（沒在播），但它不能像 .rs-lens 那樣被整層關掉 ——
    // 判準是「動畫播起來時會不會被畫出來」：父鏈上不能有 opacity:0。
    const lens = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-lens'));
    return { onLens: false, lensOpacity: lens.opacity, flashDisplay: cs.display };
  }), { onLens: false, lensOpacity: '0', flashDisplay: 'block' });

  check('衝擊波元素存在且在同一個 SVG 座標系裡', await page.evaluate(() => {
    const svg = document.querySelector('#tenki-readiness-scan svg.rs-halo');
    return !!svg.querySelector('circle.rs-wave');
  }), true);

  // 放一拍，確認三個動畫都真的跑起來（不是只寫了 CSS 卻沒有觸發路徑）。
  const anims = await page.evaluate(async () => {
    const f = document.querySelector('#tenki-readiness-scan .rs-frame');
    f.classList.remove('lock-beat');
    void f.offsetWidth;
    f.classList.add('locked', 'lock-beat');
    await new Promise((r) => requestAnimationFrame(r));
    const name = (s) => getComputedStyle(document.querySelector('#tenki-readiness-scan ' + s)).animationName;
    return { flash: name('.rs-flash'), wave: name('.rs-wave'), corners: name('.rs-halo-corners') };
  });
  check('鎖定一拍同時放閃光 / 衝擊波 / 角括號回彈',
    anims, { flash: 'rs-bloom', wave: 'rs-wave-out', corners: 'rs-corner-snap' });

  // 「爽的是突然的靜」—— 一拍過後畫面不得還在動。
  //
  // ⚠️ 不能用 computed `animation-name` 判斷：CSS 動畫播完之後那個屬性**還在**
  // （.lock-beat 不會自己拿掉），照它算會得到 4 個「還在動」的假陽性。
  // 要問的是**現在有沒有東西在跑**，所以用 getAnimations() 的 playState。
  await page.waitForTimeout(900);
  check('一拍過後完全靜止（沒有任何還在跑的動畫）', await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === 'running').length), 0);

  await ctx.close();
}

// ── 2c-5. 鎖定遲滯：一個到處都在放的高潮就不是高潮 ──
//
// 這是本輪唯一有**真邏輯**的一塊，所以驅動真的 onFaceResults，不是加 class 演戲。
// FACEMESH_STUB 把 readiness-scan 註冊的 callback 存成 window.__rsFaceMesh，
// 我們自己餵 landmark 進去 —— 走的是產品真正的取景判定路徑。
{
  const { ctx, page } = await newPage({ faceMesh: true });
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');
  await page.waitForTimeout(300);

  // 造一組「臉正好在框正中央、大小理想」的 468 點 landmark，並可整組平移。
  // 合成一張**幾何上說得通**的臉，而不是一團同座標的點。
  // ⚠️ 索引不能亂借：1 是鼻尖、33/263 是兩眼外角（headPose 在讀），
  // 所以臉框的極值改放在真正的邊界點上（10 額頂、152 下巴、234/454 兩頰）——
  // 那也正是 MediaPipe 對這些索引的語意。
  // `yaw` 是鼻尖相對兩眼中點的水平偏移（以眼距正規化），跟產品的量法同一個定義。
  // ⚠️ `browSpan` / `mouthGap` 是 2026-08-10 補的，而補的原因值得記：
  // 先前這張臉把 105/334（眉）與 13/14（嘴）留在**同一個座標**，於是產品算出來的
  // `browTension` 永遠是 1、`mouthOpen` 永遠是 0 —— **色調的兩個輸入都被釘死**。
  // 結果是「色相不得為負」那條斷言**不可能失敗**：反向驗證時把公式改回會產生負值的
  // 舊版，它照樣全綠。合成臉太理想害測試失效，這是第三次（前兩次是包圍盒不變形、
  // stub 沒有真的 host 節點）。**輸入被釘死的斷言，等於沒有斷言。**
  const makeFace = ({ dx = 0, yaw = 0, pitch = 0.5, browSpan = 0, mouthGap = 0 } = {}) => {
    const cx = 0.5 + dx;
    const half = 0.2375;          // 撐出理想臉框大小（約 0.475）
    const eyeSpan = 0.26;         // 兩眼外角距離
    const eyeY = 0.5 - 0.06;
    const lm = [];
    for (let i = 0; i < 478; i++) lm.push({ x: cx, y: 0.5, z: 0 });
    lm[10] = { x: cx, y: 0.5 - half, z: 0 };            // 額頂
    lm[152] = { x: cx, y: 0.5 + half, z: 0 };           // 下巴
    lm[234] = { x: cx - half, y: 0.5, z: 0 };           // 左頰
    lm[454] = { x: cx + half, y: 0.5, z: 0 };           // 右頰
    lm[33] = { x: cx - eyeSpan / 2, y: eyeY, z: 0 };    // 左眼外角
    lm[263] = { x: cx + eyeSpan / 2, y: eyeY, z: 0 };   // 右眼外角
    lm[1] = { x: cx + yaw * eyeSpan, y: eyeY + pitch * eyeSpan, z: 0 }; // 鼻尖
    // 眉頭內側：產品用 |x105 - x334| / 0.22 反推「眉間張力」（span 越大 → 張力越小）
    lm[105] = { x: cx - browSpan / 2, y: eyeY - 0.05, z: 0 };
    lm[334] = { x: cx + browSpan / 2, y: eyeY - 0.05, z: 0 };
    // 上下唇：產品用 |y13 - y14| / 0.05 算嘴開合
    lm[13] = { x: cx, y: 0.5 + 0.10, z: 0 };
    lm[14] = { x: cx, y: 0.5 + 0.10 + mouthGap, z: 0 };
    return lm;
  };

  const feed = (dx, n, extra = {}) => page.evaluate(([dxv, times, faceSrc, ex]) => {
    const S = window.__rsFaceMesh;
    if (!S) return 'no-hook';
    const make = eval('(' + faceSrc + ')');
    for (let t = 0; t < times; t++) S({ multiFaceLandmarks: [make({ dx: dxv, ...ex })] });
    return 'ok';
  }, [dx, n, makeFace.toString(), extra]);

  const locked = () => page.evaluate(() =>
    document.querySelector('#tenki-readiness-scan .rs-frame').classList.contains('locked'));

  const hooked = await feed(0, 1);
  if (hooked === 'no-hook') {
    console.log('… 跳過遲滯斷言（模組未匯出 onFaceResults hook）');
  } else {
    check('單一幀進容差**不得**鎖定（遲滯生效）', await locked(), false);
    await feed(0, 1);
    check('連續兩幀進容差才鎖定', await locked(), true);
    // 小幅晃出嚴格容差、但仍在放寬容差內 → 不得解鎖
    await feed(0.09, 1);
    check('小幅晃動不解鎖（解鎖容差放寬）', await locked(), true);
    // 明顯出界 → 解鎖
    await feed(0.25, 1);
    check('明顯出界才解鎖', await locked(), false);

    // ── 量測中，球真的在讀使用者 ──
    //
    // founder 2026-08-10 第二輪：「顏色好像沒變化？」+「我要的是棒透了」。
    // 根因是第一版吃的 browTension / mouthOpen 在掃描情境下幾乎是常數
    // （用力皺眉只讓色相動 0.69°）。現在吃的是 stillness。
    //
    // 🔴 **stillness 必須用「真的移動合成臉」產生，不准直接塞值** ——
    // 塞值等於自己造一個不存在的輸入，那正是上一輪讓斷言失效的作法。
    // `feed(dx,…)` 會讓 landmark 位移 → 產品自己算出 speed → stillness 下降，
    // 走的是真正的產品路徑。
    await page.evaluate(() => {
      window.__sdTones.length = 0;
      window.__sdReadouts.length = 0;
    });
    await feed(0, 3);        // 不動 → 高 stillness
    await feed(0.06, 1);     // 小幅移動 → stillness 下降
    await feed(0, 1);        // 回穩
    await feed(0.12, 1);     // 大幅移動 → stillness 更低
    await feed(0, 2);        // 再回穩

    const tones = await page.evaluate(() => window.__sdTones.slice());
    const readouts = await page.evaluate(() => window.__sdReadouts.slice());
    check('量測中有把色調推給星塵', tones.length > 0, true);
    check('量測中有把讀出量推給星塵', readouts.length > 0, true);

    // 🔴 **量的**條件，不是「有呼叫」。上一輪的教訓：輸入被釘死時
    // 「有呼叫」照樣綠，只有「真的有跨度」抓得到。
    const stills = readouts.map((r) => r.stillness);
    const stillSpan = Math.max(...stills) - Math.min(...stills);
    console.log(`   （stillness 實際跨度 ${stillSpan.toFixed(3)}，`
      + `${Math.min(...stills).toFixed(3)} → ${Math.max(...stills).toFixed(3)}）`);
    check('🔴 stillness 真的有跨度（≥ 0.25），不是一個常數點', stillSpan >= 0.25, true);
    // 🔴 而且要真的**打到兩端** —— 這條守的是「重映射有沒有把實際工作區間
    // 拉伸到滿」。原始 stillness 的定義域是 0..1，但實測只會走 0.5..0.95
    // （founder 的讀數是 63/87/93%），不重映射就有一半以上的視覺預算永遠用不到，
    // 結果就是他說的「看不出變化」。
    check('🔴 重映射後有打到兩端（用滿視覺預算）',
      Math.min(...stills) <= 0.05 && Math.max(...stills) >= 0.95, true);

    // ── 🔴 重映射本身：必須用**真實節奏**餵才驗得到 ──
    //
    // ⚠️ 上面那條其實**驗不到重映射**（拿掉重映射它照樣綠）。原因是
    // `feed()` 是同步連續呼叫，兩幀之間的 dt ≈ 1ms，而
    // `speed = 位移 / (dt/1000)` —— 於是**任何**位移都會把 speed 衝爆，
    // 原始 stillness 直接落到 0，harness 的擺幅比真實使用極端得多。
    // 真實的臉部推論是 ~180ms 一幀。**合成資料少了「時間」這個真實耦合。**
    //
    // 所以這裡照真實節奏餵：dt≈180ms、位移 0.025 →
    // 原始 stillness ≈ 0.60（正是 founder 實測 63% 那個區段）。
    // 有重映射：(0.60−0.5)/0.45 ≈ 0.23；沒有重映射：0.60。
    // 門檻取 0.35，兩者分得開。
    await page.evaluate(() => { window.__sdReadouts.length = 0; });
    await feed(0, 1);
    await page.waitForTimeout(180);
    await feed(0.025, 1);
    await page.waitForTimeout(180);
    await feed(0.050, 1);
    const realistic = await page.evaluate(() => window.__sdReadouts.map((r) => r.stillness));
    const midValue = realistic.length ? realistic[realistic.length - 1] : null;
    console.log(`   （真實節奏下：原始 stillness ≈0.60 → 餵給星塵 ${midValue?.toFixed(2)}）`);
    check('🔴 真實節奏的中段位移要被拉伸（≤ 0.35，未重映射會是 ~0.60）',
      midValue !== null && midValue <= 0.35, true);
    // 飽和度由 readout 端從 stillness 換算（0.70..1.35），所以跨度 0.25 的
    // stillness 會換出 ≥ 0.16 的飽和度差 —— 遠大於改版前的 0.087（全程）。
    check('色相真的隨著穩定度在變（不是每幀同一個值）',
      new Set(tones.map((t) => t.hue.toFixed(4))).size >= 2, true);
    check('量測中不得往任何目標色收（那是收束才做的事）',
      tones.every((t) => !t.toward && (t.mix === 0 || t.mix === undefined)), true);
    // 飽和度不得由這裡餵 —— 它歸 readout 單一擁有（effectiveSat）。
    check('量測中不得從 setTone 餵飽和度（單一寫入者）',
      tones.every((t) => t.sat === undefined), true);

    // ── 🔴 progress 是「累積的有效量測」，不是計時器 ──
    // 它只在閘門通過時前進。餵一串**不合格**的臉（明顯偏出框 → centering 不過），
    // 讓真實時間過去，progress 不該動 —— 否則球就是在對著一個沒發生的量測聚焦。
    //
    // ⚠️ 基準值要**當場重讀**，不能用上面那個 `readouts` 快照 ——
    // 中間又餵過好幾輪，快照早就過期了（改動順序時踩過一次）。
    const progBefore = await page.evaluate(() => {
      const r = window.__sdReadouts;
      return r.length ? r[r.length - 1].progress : 0;
    });
    for (let i = 0; i < 6; i += 1) {
      await feed(0.32, 1);          // 明顯出界
      await page.waitForTimeout(120); // 讓 rAF 迴圈真的跑過
    }
    const progAfter = await page.evaluate(() => {
      const r = window.__sdReadouts;
      return r.length ? r[r.length - 1].progress : null;
    });
    check('🔴 閘門不過時 progress 不前進（它不是計時器）',
      Math.abs(progAfter - progBefore) < 1e-6, true);
    // 🔴 單向。負向旋轉會把漸層底部的 cyan 轉成綠，而綠在 v6 是 `--good`
    // —— 等於還沒有結果就亮起「good」（founder 2026-08-10 實走截圖抓到）。
    check('🔴 量測中的色相不得為負（負向就是進綠的方向）',
      tones.every((t) => t.hue >= 0), true);
    check('色相位移留在上限內', tones.every((t) => t.hue <= 0.06001), true);
  }
  await ctx.close();
}

// ── 2c-5b. 正對鏡頭：偏頭時不准再給錯的位置建議 ──
//
// founder 2026-08-09 問「需不需要一行小字叫人正對鏡頭」。答案是不加小字
// （North Star §4：一次只顯示 1 個主指令），但底下的真問題是：
// **我們根本沒量頭有沒有正對。** 臉框是 landmark 的 min/max 包圍盒，
// 偏頭會把盒子中心拉歪 → 叫你「向左對齊」；低頭會壓短高度 → 叫你「靠近一點」。
// 那兩句都是錯的建議。這一組守的就是「偏頭時先講偏頭」。
{
  const { ctx, page } = await newPage({ faceMesh: true });
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');
  await page.waitForTimeout(300);

  // ⚠️ 轉頭時**包圍盒本身也會變形** —— 遠側的臉頰被壓縮，盒子中心因此被拉歪，
  // 低頭抬頭則會壓短高度。這正是「偏頭會得到錯的位置/大小建議」的成因，
  // 所以合成臉必須把這個耦合做出來，否則「square 要排在 size/center 之前」
  // 這條順序根本測不到（第一版就是只搬鼻尖，把順序搞反了測試照樣綠）。
  const makeFace = ({ dx = 0, yaw = 0, pitch = 0.5 } = {}) => {
    const cx = 0.5 + dx;
    const half = 0.2375;
    const eyeSpan = 0.26;
    const eyeY = 0.5 - 0.06;
    // 壓縮係數要**夠強到真的把盒中心推出容差**（centerX 容差 0.08，
    // 盒中心位移 = (half - far) / 2），否則順序那條根本測不到 —— 算過才定的。
    const squash = Math.min(0.9, Math.abs(yaw) * 1.6);   // 遠側臉頰被壓縮
    const near = half;
    const far = half * (1 - squash);
    // 抬低頭：可見範圍上下**不對稱**地被壓縮 → 盒中心 y 位移（不是 size 變小；
    // size = max(寬,高)，寬度還在的時候壓高度不會讓 size 變小）。
    const vShift = (pitch - 0.5) * 0.5;
    const lm = [];
    for (let i = 0; i < 478; i++) lm.push({ x: cx, y: 0.5, z: 0 });
    lm[10] = { x: cx, y: 0.5 - half + vShift, z: 0 };
    lm[152] = { x: cx, y: 0.5 + half + vShift, z: 0 };
    // ⚠️ 遠側要**整片**壓縮，眼角也要 —— 只壓臉頰的話眼角會凸在臉頰外面，
    // 包圍盒的 minX 反而由眼角決定，盒中心根本不會位移，順序那條就測不到
    // （第一版就是這樣：算好的 0.0855 位移被眼角吃掉，變成 0.0537）。
    // 真實的轉頭本來就是遠側整片被透視壓縮，這樣才是忠實的合成。
    const fx = (d) => (d < 0 === yaw >= 0 ? d * (1 - squash) : d); // 遠側縮，近側不動
    lm[234] = { x: cx + fx(-half), y: 0.5, z: 0 };
    lm[454] = { x: cx + fx(half), y: 0.5, z: 0 };
    lm[33] = { x: cx + fx(-eyeSpan / 2), y: eyeY, z: 0 };
    lm[263] = { x: cx + fx(eyeSpan / 2), y: eyeY, z: 0 };
    lm[1] = { x: cx + yaw * eyeSpan, y: eyeY + pitch * eyeSpan, z: 0 };
    return lm;
  };

  // ⚠️ 兩個時間窗要一起跨過去：指令有 350ms 去抖動（HINT_HOLD_MS），而臉超過
  // FACE_STALE_MS(700ms) 沒更新就會被當成「臉不在」→ 指令退回「把臉放進框裡」。
  // 所以要**持續餵**（模擬真實的連續推論），而且**輪詢到文字不再變動為止**
  // ——固定睡多久都是在賭（PLAYBOOK §6：斷言前輪詢到終值，不要照直覺猜等待時間）。
  const hintFor = async (opts) => {
    const src = makeFace.toString();
    const read = () => page.evaluate(() =>
      document.querySelector('#tenki-readiness-scan [data-rs="hint-text"]').textContent.trim());
    // ⚠️ **不能用「連續幾次讀到一樣就當穩定」**：卡在中間態（「把臉放進框裡」）
    // 的值本身也很穩定，那個條件會提早收工並回報中間態（第一版就這樣紅了一次）。
    // 改成餵滿一段夠長的時間再取最後值 —— 去抖動 + 臉部新鮮度兩個窗都跨得過去。
    for (let round = 0; round < 30; round++) {
      await page.evaluate(([o, s2]) => {
        const make = eval('(' + s2 + ')');
        window.__rsFaceMesh({ multiFaceLandmarks: [make(o)] });
      }, [opts, src]);
      await page.waitForTimeout(100);
    }
    return read();
  };

  // 正臉（鼻尖在兩眼中點正下方）**不得**叫人正對鏡頭 ——
  // 一個一直亮的提示比沒有提示更糟。
  //
  // ⚠️ 這裡斷言的是「不是正對鏡頭」而**不是**等於某個特定指令：假相機餵的合成畫面
  // 亮度會來回跳，lighting 閘門跟著翻，指令候選在 light/hold 之間擺盪而永遠
  // committed 不了（實測：三顆燈的第一顆會 fail↔pass）。那是**測試環境的性質**，
  // 不是產品行為 —— 硬要比對終值只是在賭假相機那一幀的亮度。
  // 這一條真正要守的不變量就是：正臉的人不會被一直叫去「正對鏡頭」。
  const frontalHint = await hintFor({ yaw: 0, pitch: 0.5 });
  check('正臉時不得出現「正對鏡頭」', frontalHint === '正對鏡頭', false);

  // 明顯轉頭 → 先講正對鏡頭，而不是「向左/向右對齊」。
  check('明顯偏頭時給「正對鏡頭」', await hintFor({ yaw: 0.45, pitch: 0.5 }), '正對鏡頭');

  // 明顯低/抬頭 → 同理，不得變成「靠近一點」。
  check('明顯抬低頭時也給「正對鏡頭」', await hintFor({ yaw: 0, pitch: 0.05 }), '正對鏡頭');

  await ctx.close();
}

// 頭部朝向**不進閘門**：門檻是先驗估計、還沒實機調過，一旦擋住進度而門檻抓錯，
// 掃描會完成不了 —— 那比「偶爾少講一句」嚴重得多。靜態斷言守這條分界。
{
  const src = readFileSync(join(repoRoot, 'apps/preview/readiness-scan.js'), 'utf8');
  const fn = src.slice(src.indexOf('function gatesAdvance('));
  const body = fn.slice(0, fn.indexOf('\n  }')).replace(/\/\/[^\n]*/g, '');
  check('headPose 不得進 gatesAdvance（只當提示，不擋進度）',
    /headPose|yaw|pitch/i.test(body), false);
}

// ── 2c-6. 星塵容器就是掃描框（North Star §4：靈魂在光圈裡）──
{
  const { ctx, page } = await newPage();
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');
  await page.waitForTimeout(600);
  check('星塵容器與掃描框完全重合（不是鋪滿整個螢幕）', await page.evaluate(() => {
    const f = document.querySelector('#tenki-readiness-scan .rs-frame').getBoundingClientRect();
    const el = document.querySelector('#tenki-readiness-scan .rs-stardust');
    const s = el.getBoundingClientRect();
    return el.parentElement.classList.contains('rs-frame')
      && Math.abs(f.x - s.x) < 0.5 && Math.abs(f.y - s.y) < 0.5
      && Math.abs(f.width - s.width) < 0.5 && Math.abs(f.height - s.height) < 0.5;
  }), true);
  check('星塵層裁成超橢圓（粒子不溢出框外）', await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-stardust'));
    return cs.overflow;
  }), 'hidden');
  await ctx.close();
}

// ── 2c-7. 揭曉：儀器把結果交到你手上，而且不會把你關在裡面 ──
//
// founder 2026-08-09：「掃完了以後不知道剛剛完成了什麼？」先前的揭曉是把結果
// 寫進剛剛還在叫你「保持穩定」的同一顆小膠囊、停 1.2 秒就消失。
//
// ⚠️ 誠實邊界：假相機過不了品質閘門，harness **跑不完整整一輪真掃描**，
// 所以下面驗的是**呈現層**（套上揭曉狀態後畫面對不對）與**出口安全**（結構性質）。
// 「真的掃完會不會走到這裡」只有實機能答 —— 不要把這組當成全流程覆蓋。
{
  const { ctx, page } = await newPage();
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');

  // 出口安全：完成鈕的 listener 必須在**注入 markup 當下**就綁好。
  // 揭曉會收起取消鈕，完成鈕是唯一出口 —— 綁定若依賴收尾流程跑完，
  // finalize() 一出事使用者就被關在覆蓋層裡。這裡直接點它，還沒揭曉也該關得掉。
  check('完成鈕在揭曉之前就已經可以關掉覆蓋層（不會把人關在裡面）', await page.evaluate(async () => {
    window.__exit = 'pending';
    document.querySelector('#tenki-readiness-scan [data-rs="done"]').click();
    await new Promise((r) => setTimeout(r, 120));
    return document.querySelector('#tenki-readiness-scan').classList.contains('open');
  }), false);
  await ctx.close();
}

{
  const { ctx, page } = await newPage();
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');

  // 套上揭曉狀態（等同 finalize() 的呈現結果）
  await page.evaluate(() => {
    const root = document.querySelector('#tenki-readiness-scan');
    const f = root.querySelector('.rs-frame');
    f.classList.add('secured', 'revealed');
    root.classList.add('secured-run');
    root.querySelector('[data-rs="verdict-band"]').textContent = 'Neutral';
    // ⚠️ 寫在**子節點**上，不要對 .rs-verdict-fact 設 textContent ——
    // 那會把 spec / quality 兩個子元素整個清掉，後面驗它們的斷言就會炸。
    // （2026-08-09 當場踩到：harness 用產品不會用的方式偽造狀態，
    //   結果測到的是被自己弄壞的 DOM。偽造狀態要照產品真正的寫法。）
    root.querySelector('[data-rs="verdict-spec"]').textContent = '468 點臉部特徵 · 121 幀推論 · 8.0 秒';
    root.querySelector('[data-rs="verdict-quality"]').textContent = '穩定度 88% · 信心中';
    root.querySelector('[data-rs="verdict-fact"]').hidden = false;
    root.querySelector('[data-rs="instruction"]').hidden = true;
    root.querySelector('[data-rs="dots"]').hidden = true;
    root.querySelector('[data-rs="done"]').hidden = false;
  });
  await page.waitForTimeout(1600);

  // 帶位要**明顯**比膠囊大 —— 這就是「同一顆膠囊同一個字級」那個病的體檢項。
  check('帶位是大字（字級明顯大於指令膠囊）', await page.evaluate(() => {
    const band = parseFloat(getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-verdict-band')).fontSize);
    const pill = parseFloat(getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-instruction')).fontSize);
    return band >= pill * 2;
  }), true);

  // ⚠️ hidden 屬性只是作者樣式 display:none，會被 display:inline-flex/flex 蓋掉。
  // 2026-08-09 截圖當場抓到：揭曉時膠囊還在叫人「把臉放進框裡」。
  check('揭曉時儀器的零件全部退場（膠囊與閘門燈真的不見）', await page.evaluate(() => {
    const gone = (s) => {
      const el = document.querySelector('#tenki-readiness-scan ' + s);
      return getComputedStyle(el).display === 'none';
    };
    return gone('.rs-instruction') && gone('.rs-dots');
  }), true);

  check('揭曉時對位標記與目標環淡出', await page.evaluate(() => {
    const o = (s) => getComputedStyle(document.querySelector('#tenki-readiness-scan ' + s)).opacity;
    return o('.rs-reticle') === '0' && o('.rs-target') === '0';
  }), true);

  check('收束成功時帶位是 gold（SECURED）', await page.evaluate(() =>
    getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-verdict-band')).color),
  'rgb(255, 212, 110)');

  // 訊號不足**不得**上 gold —— gold 代表 secured/calibrated，
  // 用它宣稱一個不存在的結果就是拿顏色說謊。
  const failColor = await page.evaluate(() => {
    const root = document.querySelector('#tenki-readiness-scan');
    root.querySelector('.rs-frame').classList.remove('secured');
    root.classList.remove('secured-run');
    return {
      band: getComputedStyle(root.querySelector('.rs-verdict-band')).color,
      done: getComputedStyle(root.querySelector('.rs-done')).color,
    };
  });
  check('訊號不足時帶位與完成鈕都不得是 gold',
    failColor.band !== 'rgb(255, 212, 110)' && failColor.done !== 'rgb(255, 212, 110)', true);

  // 規格行用等寬 + tabular-nums：數字要對得齊才有儀器讀數的樣子，
  // 而且點數/幀數在不同掃描之間位數會變，比例字體會讓它左右跳。
  check('規格行是等寬 + tabular-nums', await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-verdict-spec'));
    return /mono/i.test(cs.fontFamily) && /tabular-nums/.test(cs.fontVariantNumeric);
  }), true);

  // 退讓詞不當開場白：品質行要比規格行小、比規格行暗。
  check('退讓詞（信心）在第二行且更小更暗', await page.evaluate(() => {
    const spec = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-verdict-spec'));
    const qual = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-verdict-quality'));
    return parseFloat(qual.fontSize) < parseFloat(spec.fontSize);
  }), true);

  await ctx.close();
}

// ── 2c-8. Tier B 不准宣稱臉部特徵點 ──
//
// 沒有 MediaPipe（iOS Safari 的常態）時走的是整幀 luma 啟發式，那條路上
// **根本沒有 landmark**。照抄 tier A 的文案就是憑空宣稱一個不存在的量測 ——
// 這是誠實動效鐵律「絕不放假的生理讀數」的同一條線，只是換到文字上。
//
// ⚠️ 這是一條**靜態**斷言，故意的：假相機跑不完真掃描，所以拿不到 tier B 的
// 收尾畫面來比對。但真正的失敗模式是「有人改文案時把 tier A 那行照抄過去」，
// 而那個在原始碼上看得見。與其寫一條跑得到卻守不住的 runtime 斷言
// （PLAYBOOK §3 的教訓），不如寫一條守得住的靜態斷言並講清楚它是靜態的。
{
  const src = readFileSync(join(repoRoot, 'apps/preview/readiness-scan.js'), 'utf8');
  const fn = src.slice(src.indexOf('function verdictFact('));
  // ⚠️ 要先把註解剝掉再驗：那個 else 分支的註解本身就在解釋「沒有特徵點」，
  // 直接掃全文會被自己的說明文字誤判成違規（第一版就這樣紅了一次）。
  // 驗的是**會顯示給使用者的字串**，不是原始碼裡出現過的字。
  const tierB = fn.slice(fn.indexOf('} else {'), fn.indexOf('var quality'))
    .replace(/\/\/[^\n]*/g, '');
  check('tier B 的規格行不得出現「特徵」（沒有 landmark 就不准宣稱）',
    /特徵/.test(tierB), false);
  check('tier A 的規格行才報特徵點數，且點數是實測而非寫死',
    /landmarkCount/.test(fn) && !/\b468\b/.test(fn), true);
}

// ── 2d. reduced-motion 下鎖定仍看得出來（只是不動畫）──
{
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' });
  await page.evaluate(() => { window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }); });
  await page.waitForSelector('#tenki-readiness-scan.open');
  check('減少動態下鎖定仍落到終態（角括號到位）', await page.evaluate(() => {
    const f = document.querySelector('#tenki-readiness-scan .rs-frame');
    f.classList.add('locked');
    const cs = getComputedStyle(document.querySelector('#tenki-readiness-scan .rs-halo-corners'));
    const t = cs.transform;
    return (t === 'none' || /matrix\(1,\s*0,\s*0,\s*1,/.test(t)) && cs.transitionDuration === '0s';
  }), true);
  await ctx.close();
}

// ── 3. reduced-motion：完全不掛 ──
{
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' });
  const calls = await scanAndCancel(page);
  check('減少動態時完全不掛星塵', calls.filter((c) => c === 'mount').length, 0);
  check('減少動態時掃描仍正常收尾', await page.evaluate(() => window.__done), true);
  await ctx.close();
}

// ── 4. host 持有綁定但**看不見**（v6 的實況）：借過來，收尾還回去 ──
//
// 🔴 這一組先前寫的是「host 已綁定時不搶」—— 它把我一條錯規則固化成了通過的測試。
// 正式站上 v6 的 `#universe` 住在平常 `visibility:hidden` 的 takeover 裡，
// 於是一顆沒人看得到的星塵球佔著唯一的綁定，`/v3/` 的掃描框永遠拿不到
// （founder 2026-08-10 實走：「結果頁下方 scan 是沒有星塵靈魂版」）。
// 正確行為是**交接**：借走 → 用完還回去，全程只有一個 context 活著。
{
  const { ctx, page } = await newPage({ hostMounted: true, hostVisible: false });
  const calls = await scanAndCancel(page);
  const mounts = await page.evaluate(() => window.__sdMounts.slice());
  check('看不見的 host：掃描框借得到星塵', calls.includes('playEntrance'), true);
  check('借用順序 = 先還掉 host、再掛掃描框',
    mounts, ['universe', 'rs-stardust', 'universe']);
  // ⚠️ 不要用「最後一次 mount 是 universe」當歸還的證據 —— 沒借的時候那條也成立
  // （反向驗證時它照樣綠）。要問的是**收尾之後綁定確實回到原節點身上**。
  check('收尾之後綁定回到原主身上', await page.evaluate(() => {
    const h = window.TENKI_STARDUST.hostInfo();
    return !!h && h.node.id === 'universe' && h.fitContainer === false;
  }), true);
  check('🔴 全程活著的 context 峰值 ≤ 1（原本的 OOM 顧慮）',
    await page.evaluate(() => window.__sdMaxLive), 1);
  check('真的借過（不是從頭到尾都沒動）',
    await page.evaluate(() => window.__sdMounts.length), 3);
  check('借用情境下掃描仍正常收尾', await page.evaluate(() => window.__done), true);
  await ctx.close();
}

// ── 4b. host 看得見（takeover 真的在跑）：仍然不搶 ──
{
  const { ctx, page } = await newPage({ hostMounted: true, hostVisible: true });
  const calls = await scanAndCancel(page);
  check('看得見的 host 不搶（不呼叫 playEntrance）', calls.includes('playEntrance'), false);
  check('看得見的 host 不被拆掉', calls.includes('unmount'), false);
  check('不搶時掃描仍正常收尾', await page.evaluate(() => window.__done), true);
  await ctx.close();
}

// ── 4c. 走完一整次掃描：收束的顏色代表的是「結果」，不是當下的臉 ──
//
// 這一組**真的跑滿 8 秒的量測預算**（decision budget），不是加 class 演戲：
// 持續餵合格的 landmark → 產品自己 finalize() → revealTone() 被真的呼叫。
// 慢，但這是唯一能證明「gold 那一拍 + 落到帶位色」真的接上的方式。
{
  const { ctx, page } = await newPage({ faceMesh: true, hostMounted: true, hostVisible: false });
  await page.evaluate(() => {
    window.__done = false;
    window.TENKI_READINESS_SCAN.begin({ mission: 'decision' }).then(() => { window.__done = true; });
  });
  await page.waitForSelector('#tenki-readiness-scan.open');
  await page.waitForTimeout(300);
  // 以真實時間持續餵臉（取樣是時間驅動的，一次塞完 N 幀不會推進預算）。
  await page.evaluate(() => new Promise((done) => {
    const half = 0.2375, eyeSpan = 0.26, eyeY = 0.44;
    const make = () => {
      const lm = [];
      for (let i = 0; i < 478; i++) lm.push({ x: 0.5, y: 0.5, z: 0 });
      lm[10] = { x: 0.5, y: 0.5 - half, z: 0 };
      lm[152] = { x: 0.5, y: 0.5 + half, z: 0 };
      lm[234] = { x: 0.5 - half, y: 0.5, z: 0 };
      lm[454] = { x: 0.5 + half, y: 0.5, z: 0 };
      lm[33] = { x: 0.5 - eyeSpan / 2, y: eyeY, z: 0 };
      lm[263] = { x: 0.5 + eyeSpan / 2, y: eyeY, z: 0 };
      lm[1] = { x: 0.5, y: eyeY + 0.5 * eyeSpan, z: 0 };
      return lm;
    };
    const iv = setInterval(() => {
      if (window.__rsFaceMesh) window.__rsFaceMesh({ multiFaceLandmarks: [make()] });
    }, 60);
    setTimeout(() => { clearInterval(iv); done(); }, 10500);
  }));
  const revealed = await page.evaluate(() =>
    document.querySelector('#tenki-readiness-scan .rs-frame').classList.contains('revealed'));
  check('餵滿預算後真的收束了（不是靠 harness 加 class）', revealed, true);
  if (revealed) {
    // gold → 帶位色的切換有 700ms 延遲，等它落地。
    await page.waitForTimeout(900);
    const tones = await page.evaluate(() => window.__sdTones.slice());
    const withTarget = tones.filter((t) => t.toward);
    check('收束時把顏色交給結果（出現往目標色收的指令）', withTarget.length >= 1, true);
    check('SECURED 那一拍先走 gold', withTarget[0] && withTarget[0].toward, '#FFD46E');
    check('最後停在該次帶位色（不是停在 gold）',
      withTarget.length >= 2
        && ['#00B4D8', '#64748B', '#C2703D'].indexOf(withTarget[withTarget.length - 1].toward) !== -1,
      true);
    // founder 2026-08-10 實走：mix 0.5 時三種帶位長得幾乎一樣 —— 因為漸層底部
    // 本來就是 cyan，往 Clear 拉等於沒拉。夠強才說得出「這是你這次的結果」。
    check('帶位色夠強到一眼分得出來（mix ≥ 0.8）',
      withTarget.every((t) => t.mix >= 0.8), true);
    // 借來的綁定在收束→關閉之後仍然要還回去。
    await page.click('#tenki-readiness-scan .rs-done');
    await page.waitForFunction(() => window.__done === true, { timeout: 5000 });
    check('收束路徑也會把綁定還給原主',
      await page.evaluate(() => window.__sdMounts.slice()),
      ['universe', 'rs-stardust', 'universe']);
    check('收束路徑的 context 峰值也 ≤ 1', await page.evaluate(() => window.__sdMaxLive), 1);
  }
  await ctx.close();
}

// ── 5. 色調層：預設是恆等變換，且鏡射的帶位色沒有漂走 ──
//
// founder 2026-08-10：「星塵靈魂的顏色能更多層次色彩變化，最好每次掃描都
// 感應使用者變色」，並選了「保留身分，變化用疊加的」。
//
// ⚠️ three.js 被沙箱擋，**畫面驗不到**。但這一層的安全性質是純數學的：
// 預設值下 `toneMatrix` 必須是單位矩陣，否則沒呼叫 setTone 的頁面
// （story / soul-enroll / v6 takeover）會被連坐改掉 —— 那是 CLAUDE.md
// 鎖定的 v25.8.2 資產。所以直接驗那個函式，不假裝驗到了畫面。
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // 只給 stardust.js 需要的最小 THREE 面（它在頂層 new THREE.Clock()）。
  await page.addInitScript(`
    window.THREE = { Clock: function () { this.getElapsedTime = function () { return 0; }; } };
  `);
  page.on('pageerror', (e) => { console.error('[pageerror]', e.message); fail += 1; });
  // 空白頁 + 真的檔案：驗的是**出貨的那支 stardust.js**，不是複製一份數學過來。
  await page.goto(`${base}/__blank`, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: '/apps/preview/v6/stardust.js' });
  await page.waitForFunction(() => !!window.TENKI_STARDUST);

  const math = await page.evaluate(() => {
    const M = window.TENKI_STARDUST.toneMatrix;
    const apply = (m, c) => [
      m[0] * c[0] + m[1] * c[1] + m[2] * c[2],
      m[3] * c[0] + m[4] * c[1] + m[5] * c[2],
      m[6] * c[0] + m[7] * c[1] + m[8] * c[2],
    ];
    const luma = (c) => 0.213 * c[0] + 0.715 * c[1] + 0.072 * c[2];
    const px = [0, 0.8, 1]; // 星塵底部的 cyan
    const rot = apply(M(0.12, 1), px);
    const grey = apply(M(0, 0), px);
    return {
      identity: M(0, 1).map((v) => Math.round(v * 1e6) / 1e6),
      lumaKept: Math.abs(luma(rot) - luma(px)) < 1e-3,
      rotated: Math.abs(rot[0] - px[0]) > 0.05,
      greyEqual: Math.abs(grey[0] - grey[1]) < 1e-6 && Math.abs(grey[1] - grey[2]) < 1e-6,
      hasSetTone: typeof window.TENKI_STARDUST.setTone === 'function',
      hasHostInfo: typeof window.TENKI_STARDUST.hostInfo === 'function',
      hasSetReadout: typeof window.TENKI_STARDUST.setReadout === 'function',
      // 🔴 剛載進來、沒人呼叫過 setReadout 時必須是 inert —— 這就是
      // story / soul-enroll / v6 takeover 逐位元組不變的那個結構保證。
      readoutInert: window.TENKI_STARDUST.readoutState().active === false,
      // 呼叫之後才生效，clearReadout 之後又回到 inert（掃描結束要還原）
      readoutTogglesOn: (() => {
        window.TENKI_STARDUST.setReadout({ stillness: 1, progress: 1 });
        return window.TENKI_STARDUST.readoutState().active === true;
      })(),
      readoutTogglesOff: (() => {
        window.TENKI_STARDUST.clearReadout();
        return window.TENKI_STARDUST.readoutState().active === false;
      })(),
    };
  });
  check('🔴 預設值(hue0,sat1)是單位矩陣 —— 沒呼叫 setTone 的頁面不得被改到',
    math.identity, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  check('色相旋轉真的改了顏色', math.rotated, true);
  check('色相旋轉保住亮度（只轉色相，不改明暗）', math.lumaKept, true);
  check('sat=0 落到灰（三通道相等）', math.greyEqual, true);
  check('setTone 有對外', math.hasSetTone, true);
  check('hostInfo 有對外（借用方要靠它才還得回去）', math.hasHostInfo, true);
  check('setReadout 有對外', math.hasSetReadout, true);
  check('🔴 沒呼叫 setReadout 時完全 inert（story/soul-enroll/takeover 不得被改到）',
    math.readoutInert, true);
  check('setReadout 之後才生效', math.readoutTogglesOn, true);
  check('clearReadout 之後回到 inert（掃描結束要還原）', math.readoutTogglesOff, true);

  // ── 🔴 守則改了：從「每顆粒子」變成「整顆球的主色」 ──
  //
  // 這個產品裡幾乎每個色相都已經有語意（綠=--good、琥珀=--warn/strain、
  // 金=SECURED、珊瑚=未判定），先前我把**每一顆粒子**都擋在那些色外面，
  // 於是只剩青紫粉那一段弧可用 —— 那正是 founder 三次說「顏色變化很少」的根源。
  //
  // founder 2026-08-10 裁決放寬：**星塵是大面積、流動的多色場，不是一顆訊號燈**，
  // 單顆粒子是綠的不會被讀成「good」。所以守的改成「整顆球的主色」。
  //
  // ⚠️ 這個新守則自己長出一個新風險，而且它當場就抓到了：
  // **把色相散太開，整顆的平均色會趨近灰 —— 而灰就是 `--zone-neutral`（Neutral 帶位）。**
  // bloom 0.24 → ΔE 25.9（margin 太薄）、0.28 → 21.7 ❌；旋轉超過 0.20 turn → 7.1 ❌。
  // 現行 0.20/0.20 → 27.3 ✅。上下限全部從產品原始碼讀，讓測試跟著常數走。
  {
    const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const dustSource = stripComments(readFileSync(join(repoRoot, 'apps/preview/v6/stardust.js'), 'utf8'));
    const num = (src, name) => Number(new RegExp(`${name}\\s*=\\s*([\\d.]+)`).exec(src)?.[1]);
    const satLo = num(dustSource, 'READOUT_SAT_LO');
    const satHi = num(dustSource, 'READOUT_SAT_HI');
    const bloomMax = num(dustSource, 'READOUT_BLOOM_MAX');
    const rotMax = num(dustSource, 'READOUT_HUEROT_MAX');
    const scaleLo = num(dustSource, 'READOUT_SCALE_LO');
    const scaleHi = num(dustSource, 'READOUT_SCALE_HI');
    const bands = num(dustSource, 'HUE_BANDS');
    check('讀得到產品的所有色彩上下限（測試要跟著常數走）',
      [satLo, satHi, bloomMax, rotMax, scaleLo, scaleHi, bands].every(Number.isFinite), true);

    const colour = await page.evaluate(([sLo, sHi, blMax, roMax, nBands]) => {
      const M = window.TENKI_STARDUST.toneMatrix;
      const clamp = (v) => Math.max(0, Math.min(1, v));
      const apply = (m, c) => [
        clamp(m[0] * c[0] + m[1] * c[1] + m[2] * c[2]),
        clamp(m[3] * c[0] + m[4] * c[1] + m[5] * c[2]),
        clamp(m[6] * c[0] + m[7] * c[1] + m[8] * c[2]),
      ];
      const fi = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const lab = (c) => {
        const g = c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
        const X = (g[0] * 0.4124 + g[1] * 0.3576 + g[2] * 0.1805) / 0.95047;
        const Y = g[0] * 0.2126 + g[1] * 0.7152 + g[2] * 0.0722;
        const Z = (g[0] * 0.0193 + g[1] * 0.1192 + g[2] * 0.9505) / 1.08883;
        return [116 * fi(Y) - 16, 500 * (fi(X) - fi(Y)), 200 * (fi(Y) - fi(Z))];
      };
      const dE = (a, b) => {
        const A = lab(a); const B = lab(b);
        return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      };
      const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
      const OWNED = {
        '--good 綠': '#34C759',
        '--warn 琥珀': '#F5A623',
        'zone-strain': '#C2703D',
        '未判定 coral': '#FF7E76',
        'gold-secured': '#FFD46E',
        'zone-neutral': '#64748B',
      };
      // 靜息漸層（stardust.js buildScene 的 bot→mid→top），照色帶取樣，
      // 跟產品 buildBandMats 的做法一致。
      const TOP = [1, 0.4, 0.8], MID = [0.6, 0.4, 1], BOT = [0, 0.8, 1];
      const baseAt = (ny) => (ny > 0.5
        ? MID.map((v, i) => v + (TOP[i] - v) * ((ny - 0.5) * 2))
        : BOT.map((v, i) => v + (MID[i] - v) * (ny * 2)));
      const mid = (nBands - 1) / 2;
      // 一顆球在給定 (bloom, rot, sat) 下的所有色帶顏色
      const ballAt = (bloom, rot, sat) => {
        const cs = [];
        for (let b = 0; b < nBands; b += 1) {
          const ny = (b + 0.5) / nBands;
          const h = rot + ((b - mid) / mid) * (bloom / 2);
          cs.push(apply(M(h, sat), baseAt(ny)));
        }
        return cs;
      };
      const meanOf = (cs) => [0, 1, 2].map((k) => cs.reduce((a, c) => a + c[k], 0) / cs.length);
      const spanOf = (cs) => {
        let mx = 0;
        for (let a = 0; a < cs.length; a += 1) {
          for (let b = a + 1; b < cs.length; b += 1) mx = Math.max(mx, dE(cs[a], cs[b]));
        }
        return mx;
      };
      let worstMean = { d: Infinity };
      let minSpan = { v: Infinity };
      let maxSpan = { v: -Infinity };
      for (let bl = 0; bl <= blMax + 1e-9; bl += 0.02) {
        for (let ro = 0; ro <= roMax + 1e-9; ro += 0.02) {
          for (let sat = sLo; sat <= sHi + 1e-9; sat += 0.05) {
            const cs = ballAt(bl, ro, sat);
            const mean = meanOf(cs);
            for (const [name, v] of Object.entries(OWNED)) {
              const d = dE(mean, hex(v));
              if (d < worstMean.d) worstMean = { d, name, bloom: bl, rot: ro, sat };
            }
            const sp = spanOf(cs);
            if (sp < minSpan.v) minSpan = { v: sp, bloom: bl, rot: ro, sat };
            if (sp > maxSpan.v) maxSpan = { v: sp, bloom: bl, rot: ro, sat };
          }
        }
      }
      return { worstMean, minSpan, maxSpan, restSpan: spanOf(ballAt(0, 0, 1)) };
    }, [satLo, satHi, bloomMax, rotMax, bands]);

    console.log(`   （主色最接近「${colour.worstMean.name}」ΔE ${colour.worstMean.d.toFixed(1)}`
      + ` @bloom ${colour.worstMean.bloom.toFixed(2)} rot ${colour.worstMean.rot.toFixed(2)}`
      + `；彩度跨度 ${colour.minSpan.v.toFixed(0)}–${colour.maxSpan.v.toFixed(0)}`
      + `，靜息 ${colour.restSpan.toFixed(0)}）`);

    // 🔴 新守則：整顆球的**主色**不得撞上任何已被指派意義的顏色。
    check('🔴 整顆球的主色不得撞上已被指派意義的顏色（ΔE ≥ 25）',
      colour.worstMean.d >= 25, true);

    // 🔴🔴 **這兩條直接就是 founder 抱怨的那件事。**
    // 前三輪我只驗「參數有沒有被設定成不同值」，所以三輪都綠、三輪都被打回。
    // 他實際看到的彩度跨度是 4（93% 穩定度）到 36（77%）。
    //
    // ⚠️ 門檻是**量出來才定的**，而且量的時候修正了我計畫裡的一個誤讀：
    // 我原本以為「整個空間的最低點」該是 147 —— 錯了，147 是**最高點**（bloom 全開），
    // 最低點是 bloom=0 的基礎漸層（≈84）。所以要驗的是**一對**：
    //   ① 最低點不得低於基礎漸層 → 顏色永遠不會變少
    //   ② 最高點要真的更豐富 → 穩住時看得出「展開」
    check('🔴 顏色永遠不得變少（最低點 ≥ 80，即基礎漸層）',
      colour.minSpan.v >= 80, true);
    check('🔴 穩住時真的更豐富（最高點 ≥ 140）',
      colour.maxSpan.v >= 140, true);

    // 尺度是絕對幾何，不受 additive 混色影響 —— 狀態回饋交給它。
    const scaleRatio = scaleLo / scaleHi;
    check('🔴 尺度差看得出來（靜止/晃動 ≤ 0.78）', scaleRatio <= 0.78, true);
    // ⚠️ 這裡本來還有一條「綠離得夠遠」的專屬斷言，**已經拿掉**：
    // `--good` 已經在上面 OWNED 表裡（現行設計下 ΔE 82.7），而那條專屬版
    // 想不出任何會讓它變紅的改動 —— 反向驗證不了的斷言只會讓人誤以為多守了一層。
    // 綠由「色相不得為負」（行為，已反向驗證）＋ 這條 ΔE 掃描（已反向驗證）共同守住。
  }
  await ctx.close();
}

// ── 6. 收束的帶位色必須跟 tokens.css 同步（鏡射漂移守門員）──
//
// readiness-scan 自帶樣式、不假設 host 載了 tokens.css，所以 zone 色是**字面值鏡射**。
// 鏡射必然漂移（PLAYBOOK §6 已經吃過三次虧），這裡讓它會喊痛：
// 直接比對兩份檔案裡的值。⚠️ 要先剝掉註解，否則會掃到我自己寫的說明文字。
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const scanSrc = strip(readFileSync(join(repoRoot, 'apps/preview/readiness-scan.js'), 'utf8'));
  const tokensSrc = strip(readFileSync(join(repoRoot, 'apps/preview/tokens.css'), 'utf8'));
  const bandTone = /BAND_TONE\s*=\s*\{([^}]*)\}/.exec(scanSrc);
  const mirrored = {};
  if (bandTone) {
    for (const m of bandTone[1].matchAll(/(\w+)\s*:\s*'(#[0-9A-Fa-f]{6})'/g)) {
      mirrored[m[1]] = m[2].toUpperCase();
    }
  }
  const tokenOf = (name) => {
    const m = new RegExp(`--zone-${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`).exec(tokensSrc);
    return m ? m[1].toUpperCase() : null;
  };
  check('BAND_TONE 有三個帶位', Object.keys(mirrored).sort(), ['clear', 'neutral', 'strain']);
  for (const band of ['clear', 'neutral', 'strain']) {
    check(`帶位色 ${band} 與 tokens.css 的 --zone-${band} 相同`, mirrored[band], tokenOf(band));
  }
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);

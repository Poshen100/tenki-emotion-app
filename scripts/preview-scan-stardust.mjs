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

/** 假的 TENKI_STARDUST：記下呼叫序列，並回報自己掛在哪個節點上。 */
const STUB = `
window.__sdCalls = [];
window.__sdHostClass = null;
window.__sdHostMounted = false;   // 模擬 host 頁面（v6）已持有綁定
(function () {
  var mounted = false;
  window.TENKI_STARDUST = {
    mount: function (el) {
      if (window.__sdHostMounted || mounted) { window.__sdCalls.push('mount:refused'); return false; }
      mounted = true;
      window.__sdCalls.push('mount');
      window.__sdHostClass = el && el.className;
      return true;
    },
    unmount: function () { mounted = false; window.__sdCalls.push('unmount'); },
    isMounted: function () { return window.__sdHostMounted || mounted; },
    playEntrance: function () { window.__sdCalls.push('playEntrance'); },
    setExpression: function () { window.__sdCalls.push('setExpression'); },
    clearExpression: function () { window.__sdCalls.push('clearExpression'); },
    dim: function () {}, brighten: function () {}, destroy: function () { mounted = false; },
  };
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
    + (opts.hostMounted ? '\nwindow.__sdHostMounted = true;' : '')
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
  const makeFace = ({ dx = 0, yaw = 0, pitch = 0.5 } = {}) => {
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
    return lm;
  };

  const feed = (dx, n) => page.evaluate(([dxv, times, faceSrc]) => {
    const S = window.__rsFaceMesh;
    if (!S) return 'no-hook';
    const make = eval('(' + faceSrc + ')');
    for (let t = 0; t < times; t++) S({ multiFaceLandmarks: [make({ dx: dxv })] });
    return 'ok';
  }, [dx, n, makeFace.toString()]);

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

// ── 4. host 已持有綁定（v6 的 #universe）：不搶，也不炸 ──
{
  const { ctx, page } = await newPage({ hostMounted: true });
  const calls = await scanAndCancel(page);
  check('host 已綁定時不搶（不呼叫 playEntrance）', calls.includes('playEntrance'), false);
  check('host 已綁定時掃描仍正常收尾', await page.evaluate(() => window.__done), true);
  await ctx.close();
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);

/**
 * preview-scan-lens-offset.mjs — 驗「掃描儀器離鏡頭夠近」。
 *
 * 為什麼需要這支：founder 2026-10-14 實走掃描說「我覺得臉跟眼睛還是沒有對正螢幕」
 * —— 而且是在 #274 把 squareness 接上收散**之後**再說一次，所以不是回饋強度的問題。
 *
 * 成因是幾何。前鏡頭在手機最上緣，覆蓋層卻把整個 stage 置中，框心落在 0.43–0.47H。
 * 盯著星塵球看 → 視線落在螢幕中段 → 相機從上方俯看 → 臉落在畫面下半部。
 * 同一條幾何同時產生兩個症狀：**視線偏離約 10°**（視訊研究裡超過約 5° 就讀得出
 * 沒有眼神接觸），以及 `resolveHint` 的「向上對齊」一直跳
 * （10° 換算成 `box.centerY ≈ 0.67`，遠在 `FACE_CENTER_Y_TOL = 0.09` 的容許帶外）。
 *
 * 這支鎖住四件事：
 *
 *   1. 🔴 **算式真的用那三個具名常數** —— 比對「從常數推導的框心」與「真的 render
 *      出來的框心」。harness 自己抄一份數字的話，常數被改掉時它不會紅。
 *   2. 🔴 **`STAGE_TOP_TO_FRAME_PX` 是誠實的** —— 它宣稱 stage 頂到框心是 151px，
 *      那是量出來的（mission 15 + gap 18 + 半框 118）。字級或 gap 一改它就過期，
 *      而過期的常數會讓上面那條「推導」靜靜地算錯。
 *   3. 矮螢幕不出界、揭曉狀態不爆底、取消鈕不壓到 mission 標籤。
 *   4. 🔴 **反向斷言**：把 CSS 改回置中，框心比例必須回到 0.44 附近。
 *      沒紅過的閘門不是閘門 —— 這條同時證明上面量的就是這次改動動到的那個量。
 *
 * ⚠️ 這支**不**把視線角度當閘門。角度要知道手持距離，而那量不到（沙箱、CI 都一樣）。
 *    角度只印出來給人看，假設值寫在 DEVICES 裡，是假設就說它是假設。
 *
 * Run: node scripts/preview-scan-lens-offset.mjs
 */
import { getChromium } from './lib/playwright.mjs';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  if (clean.startsWith('/preview/')) clean = '/apps/preview/' + clean.slice('/preview/'.length);
  const file = join(repoRoot, clean);
  if (!existsSync(file) || statSync(file).isDirectory() || !file.startsWith(repoRoot)) {
    res.writeHead(404).end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

/**
 * 三個真實視窗高度，外加**只拿來印角度**的機身假設。
 *
 * ⚠️ `screenMm` / `holdMm` / `cameraPx` 是假設，不是量測 —— 所以它們只進
 * 印出來的那行字，不進任何斷言。沙箱跟 CI 都量不到使用者把手機拿多遠。
 */
const DEVICES = [
  { h: 667, label: 'SE 4.7"', screenMm: 104.1, holdMm: 300, cameraPx: 25 },
  { h: 852, label: '15/16  ', screenMm: 149.4, holdMm: 325, cameraPx: 55 },
  { h: 932, label: 'Max    ', screenMm: 163.4, holdMm: 340, cameraPx: 58 },
];

/**
 * 框心比例的上限。
 *
 * 推導而不是憑感覺：5° 的眼神接觸門檻在 H=852 上換算成框心 ≤ 217px ≈ **0.255H**。
 * 高螢幕（852 / 932）就用這個數。
 *
 * SE 放寬到 0.32：667px 的視窗要塞 118px 的半框 + decision mission 多一列 symbol，
 * 版面上就是擠不進 0.255 —— 但 SE 機身短、手也拿得更近，實際角度反而沒有變差多少
 * （印出來的角度會說明這件事）。**這是已知的最差組合，寫在這裡而不是藏起來。**
 */
const RATIO_CEIL = { 667: 0.32, 852: 0.255, 932: 0.255 };

const chromium = await getChromium();
const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

let pass = 0;
let fail = 0;
function check(name, actual, expected, tol) {
  const ok = tol === undefined
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : Math.abs(actual - expected) <= tol;
  if (ok) { pass += 1; console.log(`✓ ${name}`); } else {
    fail += 1;
    console.log(`✗ ${name}\n    得到 ${JSON.stringify(actual)}，預期 ${JSON.stringify(expected)}`
      + (tol === undefined ? '' : ` ±${tol}`));
  }
}

/** 開一個指定高度與 mission 的掃描覆蓋層，回傳量到的幾何。 */
async function measure(h, mission, symbol) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: h },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera'],
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/apps/preview/v6/index.html`, { waitUntil: 'domcontentloaded' })
    .catch(() => {});
  await page.waitForFunction(() => !!(window.TENKI_READINESS_SCAN
    && window.TENKI_READINESS_SCAN.__layout), null, { timeout: 15_000 });
  await page.evaluate(([mi, sy]) => {
    window.TENKI_READINESS_SCAN.begin({ mission: mi, symbol: sy });
  }, [mission, symbol]);
  await page.waitForSelector('#tenki-readiness-scan.open');
  await page.waitForTimeout(350);

  const geom = await page.evaluate(() => {
    const R = (s) => {
      const e = document.querySelector('#tenki-readiness-scan ' + s);
      return e ? e.getBoundingClientRect() : null;
    };
    const stage = R('.rs-stage');
    const frame = R('.rs-frame');
    const mis = R('.rs-mission');
    const cancel = R('.rs-cancel');
    const padTop = parseFloat(getComputedStyle(
      document.querySelector('#tenki-readiness-scan .rs-stage')).paddingTop);
    return {
      H: window.innerHeight,
      constants: window.TENKI_READINESS_SCAN.__layout.constants,
      stageTop: stage.top, stageBottom: stage.bottom,
      padTop: padTop,
      frameCY: frame.top + frame.height / 2,
      frameH: frame.height,
      // ⚠️ **content-box 起算**：`stage.top` 是 border box 的頂端，padding 在它裡面。
      // 用 `frame.top - stage.top` 會把 padding 算進去，於是下面「padding + 標籤區
      // + 半框」那條等號兩邊各含一次 padding —— 第一版就是這樣紅的。
      aboveFrame: frame.top - (stage.top + padTop),
      mission: { left: mis.left, right: mis.right, top: mis.top, bottom: mis.bottom },
      cancel: { left: cancel.left, right: cancel.right, top: cancel.top, bottom: cancel.bottom },
    };
  });

  // 反向斷言用：把版面改回「置中、沒有鏡頭 padding」，框心必須回到 0.44 附近。
  // ⚠️ **一定要在揭曉狀態之前量** —— 揭曉會把 stage 撐高約 120px，置中的版面
  // 就會把框心往上拉到 0.37H，於是這條反向斷言會以「產品沒壞」的樣子紅掉。
  // 量完立刻還原，不讓它汙染後面的量測。
  geom.centredCY = await page.evaluate(() => {
    const ov = document.getElementById('tenki-readiness-scan');
    ov.style.justifyContent = 'center';
    ov.style.setProperty('--rs-lens-pad', '0px');
    const f = ov.querySelector('.rs-frame').getBoundingClientRect();
    const cy = f.top + f.height / 2;
    ov.style.justifyContent = '';
    ov.style.removeProperty('--rs-lens-pad');
    return cy;
  });

  // 揭曉狀態：規格行與完成鈕都掀開，看最高的那個版面會不會爆底。
  geom.revealBottom = await page.evaluate(() => {
    const q = (s) => document.querySelector('#tenki-readiness-scan ' + s);
    q('[data-rs="verdict-fact"]').hidden = false;
    q('[data-rs="verdict-spec"]').textContent = '468 點臉部特徵 · 10.0 秒 · 眨眼 16/分';
    q('[data-rs="verdict-quality"]').textContent = '擷取品質 moderate';
    q('[data-rs="done"]').hidden = false;
    return q('.rs-stage').getBoundingClientRect().bottom;
  });

  await ctx.close();
  return geom;
}

const C = (await measure(852, 'daily', null)).constants;
console.log(`框心目標 ${C.LENS_TARGET_VH}vh · stage 頂→框心 ${C.STAGE_TOP_TO_FRAME_PX}px`
  + ` · padding 下限 ${C.LENS_PAD_FLOOR_PX}px\n`);

for (const dev of DEVICES) {
  for (const [mission, symbol] of [['daily', null], ['decision', 'ES1!']]) {
    const g = await measure(dev.h, mission, symbol);
    const ratio = g.frameCY / g.H;

    // 角度只印不驗（見 DEVICES 的註解）。
    const mmPerPx = dev.screenMm / dev.h;
    const deg = Math.atan(((g.frameCY - dev.cameraPx) * mmPerPx) / dev.holdMm) * 180 / Math.PI;
    const tag = `${dev.label} ${mission.padEnd(8)}`;
    console.log(`\n── ${tag} frameCY=${g.frameCY.toFixed(1)} (${ratio.toFixed(3)}H)`
      + ` · 視線約 ${deg.toFixed(1)}°（假設手持 ${dev.holdMm}mm）`);

    // 1. 算式真的用那三個具名常數：從常數推導 padding，必須對上 render 出來的。
    const expectPad = Math.max(C.LENS_PAD_FLOOR_PX,
      (C.LENS_TARGET_VH / 100) * g.H - C.STAGE_TOP_TO_FRAME_PX);
    check(`${tag} padding-top 等於常數推導值`, g.padTop, expectPad, 0.6);

    // 2. 推導的框心對上量到的框心（padding + stage 頂到框心）。
    check(`${tag} 框心 = padding + 標籤區 + 半框`,
      g.frameCY, g.stageTop + g.padTop + g.aboveFrame + g.frameH / 2, 0.6);

    // 3. 比例在上限內 —— 這條是「這次改動到底有沒有效」的那條。
    const ceil = RATIO_CEIL[dev.h];
    check(`${tag} 框心比例 ${ratio.toFixed(3)} ≤ ${ceil}`, ratio <= ceil, true);

    // 4. 不出界：頂端不被切、揭曉狀態不爆底。
    check(`${tag} stage 頂端沒被推出視窗`, g.stageTop >= -0.5, true);
    check(`${tag} 揭曉狀態 ${g.revealBottom.toFixed(0)}px 沒爆底 (H=${g.H})`,
      g.revealBottom <= g.H, true);

    // 5. 取消鈕與 mission 標籤的 bounding box 不重疊（上移之後兩者同高）。
    const overlap = g.mission.right > g.cancel.left && g.mission.left < g.cancel.right
      && g.mission.bottom > g.cancel.top && g.mission.top < g.cancel.bottom;
    check(`${tag} 取消鈕沒壓到 mission 標籤`, overlap, false);

    // 6. 🔴 反向斷言：改回置中就必須退回 0.44 附近。
    //    它跟第 3 條成對 —— 少了這條，把量測掏空也能讓第 3 條變綠。
    const centredRatio = g.centredCY / g.H;
    check(`${tag} 🔴 改回置中會退回 ~0.44H（量的就是這個量）`,
      centredRatio > 0.40 && centredRatio < 0.50, true);
  }
}

// 7. 🔴 `STAGE_TOP_TO_FRAME_PX` 是誠實的：daily mission 下，stage 頂到框心的
//    實測值必須等於那個常數。字級或 gap 一改它就過期，而過期的常數會讓上面
//    「從常數推導」那兩條靜靜地算錯 —— 錯得一致，所以還是綠的。
const ref = await measure(852, 'daily', null);
check('🔴 STAGE_TOP_TO_FRAME_PX 仍與實測相符（常數沒過期）',
  ref.aboveFrame + ref.frameH / 2, C.STAGE_TOP_TO_FRAME_PX, 0.6);

console.log(`\n${fail === 0 ? '🟢' : '🔴'} pass=${pass} fail=${fail}`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);

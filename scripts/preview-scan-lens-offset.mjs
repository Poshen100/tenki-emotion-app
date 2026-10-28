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
 * 框心比例的上限 —— **從 8° 的角度預算推出來的**，每台機型各自換算。
 *
 * 🔴 **8° 是一個取捨，不是一個推導**（founder 2026-10-28 拍板「掃描框要再往下」）。
 *    先前這裡寫 5°，那是視訊通話研究的門檻（「對面那個人讀不讀得出你沒在看他」）
 *    —— 而這個產品沒有「對面那個人」。這條線上**唯一實測過的事實**是：
 *      · 10° → `resolveHint` 的「向上對齊」一直亂跳（2026-10 的原始症狀）
 *      · 6.5° → 不會（founder 近期掃描全部閘門綠、信心高）
 *    8° 取在兩者之間、離已知會壞的那點還有 2°。中間沒有人測過。
 *
 * ⚠️ **這不是「把標準放寬到剛好能過」**：8° 是在跑那張掃描表**之前**定的，
 *    然後才從它挑出 `LENS_TARGET_VH = 32`（預算內的最大值）。
 *    順序反過來就是搬龍門。
 */
const RATIO_CEIL = { 667: 0.442, 852: 0.370, 932: 0.355 };

/**
 * 各機型直式的 `safe-area-inset-top`（standalone PWA）。
 *
 * 🔴 **這些數字不是裝飾，它們在決定框心的那個 `max()` 裡面。**
 * Playwright 的 `env(safe-area-inset-top)` 永遠是 0，所以在補上這一組之前，
 * 這支 harness 量到的是一台**沒有人擁有的機器**。
 * ⚠️ SE 沒有瀏海 —— 它只有 20px 狀態列，拿 59 套它是假的。
 */
const SAFE_TOP = { 667: 20, 852: 59, 932: 59 };

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
async function measure(h, mission, symbol, safeTop) {
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
  // 🔴 **模擬瀏海。** Playwright 的 `env(safe-area-inset-top)` 永遠是 0，而真機是
  //    ~59px —— 那一項就在決定框心的那個 `max()` 裡面。不模擬它，這整支 harness
  //    驗的是一台沒有人擁有的機器（2026-10-28 查出來的，見產品端註解）。
  //    ⚠️ 只覆寫**輸入**（inset），`max()` 仍然由產品那條 CSS 算 ——
  //    在 harness 裡重算一次就會養出一份會自己腐爛的複製品。
  if (typeof safeTop === 'number') {
    await page.evaluate((v) => {
      document.getElementById('tenki-readiness-scan')
        .style.setProperty('--rs-safe-top', v + 'px');
    }, safeTop);
  }
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
      privacyBottom: R('.rs-privacy').bottom,
      dotsTop: R('.rs-dots').top,
      dotsBottom: R('.rs-dots').bottom,
      instructionBottom: R('.rs-instruction').bottom,
      cancel: { left: cancel.left, right: cancel.right, top: cancel.top, bottom: cancel.bottom },
    };
  });

  // 反向斷言用：把 --rs-lens-pad 推開 120px，框心必須**剛好**跟著走 120px。
  //
  // 為什麼是這個形式而不是「把版面改回置中再量一次」：後者要在 harness 裡重建
  // 一份舊版面（justify-content + flex + margin 全都要還原），而那份複製品
  // 會自己腐爛 —— 第一版就是這樣，`.rs-stage` 改成 `flex:1` 之後它整組紅掉，
  // 紅的是 harness 的仿造品，不是產品。
  //
  // 「推旋鈕、看框心跟著走」不需要知道版面長什麼樣，只證明一件事：
  // **這支量到的就是這次改動在動的那個量**。量完立刻還原。
  //
  // ⚠️ 一定要在揭曉狀態之前量 —— 揭曉會把版面撐高，污染這一次的位移。
  geom.padProbe = await page.evaluate(() => {
    const ov = document.getElementById('tenki-readiness-scan');
    const frame = () => {
      const f = ov.querySelector('.rs-frame').getBoundingClientRect();
      return f.top + f.height / 2;
    };
    const before = frame();
    const pad = parseFloat(getComputedStyle(ov.querySelector('.rs-stage')).paddingTop);
    ov.style.setProperty('--rs-lens-pad', (pad + 120) + 'px');
    const after = frame();
    ov.style.removeProperty('--rs-lens-pad');
    return { delta: after - before };
  });

  // 揭曉狀態：規格行與完成鈕都掀開，看最高的那個版面會不會爆底。
  //
  // ⚠️ 量的是**最後一個看得見的元素**，不是 `.rs-stage` 的 bottom。stage 是
  // `flex:1`（撐滿覆蓋層好讓隱私註腳靠底），它的 bottom 恆等於 H ——
  // 拿它來驗「有沒有爆底」會是一條**永遠綠的死斷言**。
  geom.reveal = await page.evaluate(() => {
    const q = (s) => document.querySelector('#tenki-readiness-scan ' + s);
    q('[data-rs="verdict-fact"]').hidden = false;
    q('[data-rs="verdict-spec"]').textContent = '468 點臉部特徵 · 10.0 秒 · 眨眼 16/分';
    q('[data-rs="verdict-quality"]').textContent = '擷取品質 moderate';
    q('[data-rs="done"]').hidden = false;
    return {
      max: Math.max(...['.rs-privacy', '.rs-dots', '[data-rs="done"]', '[data-rs="verdict-fact"]']
        .map((sel) => q(sel).getBoundingClientRect().bottom)),
      // 🔴 上面那組最低的點。`revealBottom <= H` **抓不到上下兩組互相穿透**
      //    —— 兩組都還在視窗內，只是疊在一起。所以另外回報這個量。
      topGroupBottom: q('[data-rs="done"]').getBoundingClientRect().bottom,
      dotsTop: q('.rs-dots').getBoundingClientRect().top,
    };
  });

  await ctx.close();
  return geom;
}

const C = (await measure(852, 'daily', null, 0)).constants;
console.log(`框心目標 ${C.LENS_TARGET_VH}vh · stage 頂→框心 ${C.STAGE_TOP_TO_FRAME_PX}px`
  + ` · padding 下限 ${C.LENS_PAD_FLOOR_PX}px\n`);

for (const dev of DEVICES) {
  for (const [mission, symbol, safeTop] of [
    ['daily', null, 0], ['decision', 'ES1!', 0],
    // 🔴 真機那一組。59px 是 iPhone 15/16 直式的 safe-area-inset-top。
    ['daily', null, SAFE_TOP[dev.h]], ['decision', 'ES1!', SAFE_TOP[dev.h]],
  ]) {
    const g = await measure(dev.h, mission, symbol, safeTop);
    const ratio = g.frameCY / g.H;

    // 角度只印不驗（見 DEVICES 的註解）。
    const mmPerPx = dev.screenMm / dev.h;
    const deg = Math.atan(((g.frameCY - dev.cameraPx) * mmPerPx) / dev.holdMm) * 180 / Math.PI;
    const tag = `${dev.label} ${mission.padEnd(8)} ${safeTop ? 'inset' + safeTop : '無inset '}`;
    console.log(`\n── ${tag} frameCY=${g.frameCY.toFixed(1)} (${ratio.toFixed(3)}H)`
      + ` · 視線約 ${deg.toFixed(1)}°（假設手持 ${dev.holdMm}mm）`);

    // 1. 算式真的用那三個具名常數：從常數推導 padding，必須對上 render 出來的。
    const expectPad = Math.max(safeTop + C.LENS_PAD_FLOOR_PX,
      (C.LENS_TARGET_VH / 100) * g.H - C.STAGE_TOP_TO_FRAME_PX);
    check(`${tag} padding-top 等於常數推導值`, g.padTop, expectPad, 0.6);

    // 2. 推導的框心對上量到的框心（padding + stage 頂到框心）。
    check(`${tag} 框心 = padding + 標籤區 + 半框`,
      g.frameCY, g.stageTop + g.padTop + g.aboveFrame + g.frameH / 2, 0.6);

    // 3. 比例在上限內 —— 這條是「這次改動到底有沒有效」的那條。
    const ceil = RATIO_CEIL[dev.h];
    if (!safeTop) {
      check(`${tag} 框心比例 ${ratio.toFixed(3)} ≤ ${ceil}`, ratio <= ceil, true);
    } else {
      // 🔴 **拍板了，所以這條從「印出來」升級成真的紅燈。**
      //    2026-10-28 之前它只印不驗，因為當時「框要放多低」是一個開著的
      //    產品問題，用紅燈假裝它已經決定完是不誠實的。founder 現在定了
      //    （「掃描框要再往下」＋ 8° 預算），於是它變成一條守得住的線。
      check(`${tag} 🔴 真機框心比例 ${ratio.toFixed(3)} ≤ ${ceil}（8° 預算）`,
        ratio <= ceil, true);
      // 可以驗、而且現在就該釘住的是**這一句事實**：瀏海機上動 LENS_TARGET_VH
      // 沒有用，贏的是下限那一項。文件裡「太高就把它調大」那句建議因此是錯的。
      // 🔴 **這條 2026-10-28 整個反過來了，而反過來正是這次的重點。**
      //    先前：下限贏 → `LENS_TARGET_VH` 在任何有瀏海的 iPhone 上都是死的，
      //    而它的註解卻寫著「實機覺得太高就把它調大」。
      //    現在：vh 項在**每一台**都贏，那個常數的名字才等於它做的事。
      //    哪天有人把它調回 30 以下，這條會紅 —— 而那正是我們要被喊住的時候。
      const floorTerm = safeTop + C.LENS_PAD_FLOOR_PX;
      const vhTerm = (C.LENS_TARGET_VH / 100) * g.H - C.STAGE_TOP_TO_FRAME_PX;
      check(`${tag} 🔴 位置由 LENS_TARGET_VH 決定（旋鈕活著）`
        + `（vh ${vhTerm.toFixed(0)} > 下限 ${floorTerm}）`, vhTerm > floorTerm, true);
      check(`${tag} 而且 padding 真的等於 vh 項`, g.padTop, vhTerm, 0.6);
    }

    // 4. 不出界：頂端不被切、揭曉狀態不爆底。
    check(`${tag} stage 頂端沒被推出視窗`, g.stageTop >= -0.5, true);
    check(`${tag} 揭曉狀態 ${g.reveal.max.toFixed(0)}px 沒爆底 (H=${g.H})`,
      g.reveal.max <= g.H, true);
    // 🔴 揭曉時上面那組會長高，而底部那組是釘死的 —— 兩者可以在**都還在視窗內**
    //    的情況下互相穿透，上一條完全抓不到。
    check(`${tag} 揭曉時完成鈕沒壓到底部那組（${g.reveal.topGroupBottom.toFixed(0)}`
      + ` vs 閘門頂 ${g.reveal.dotsTop.toFixed(0)}）`,
      g.reveal.topGroupBottom <= g.reveal.dotsTop, true);

    // 隱私註腳要真的吸在底緣 —— 儀器上移之後底下空出約半個螢幕，靠底的註腳
    // 是讓版面讀起來「刻意」而不是「沒做完」的那一件事。
    // 和上一條成對：margin-top:auto 被拿掉時註腳會跟著指示燈往上跑，這條紅；
    // flex:1 被拿掉時 stage 不再撐滿，註腳也靠不了底，一樣紅。
    check(`${tag} 隱私註腳吸在底緣（距底 ${(g.H - g.privacyBottom).toFixed(0)}px）`,
      g.H - g.privacyBottom <= 40, true);

    // 🔴 **閘門要跟註腳在同一組、一起吸在底部**（2026-10-28）。
    // 上一輪的解法是只把註腳釘底，而 founder 實機走完說版面還是「掃描在上面」：
    // 下緣只有一條 11px 的灰字，太輕，撐不住上面那片空白。
    // 這條驗的是「底部那組真的在底部」，破壞 `.rs-dots` 的 margin-top:auto 會紅。
    check(`${tag} 閘門跟著吸在底部（距底 ${(g.H - g.dotsBottom).toFixed(0)}px）`,
      g.H - g.dotsBottom <= 70, true);
    // 成對的另一半：閘門**離開了**上面那組 —— 只驗「靠底」的話，
    // 版面矮到整頁沒有空白時它也會綠，而那時這條改動等於沒發生。
    check(`${tag} 閘門與指示列之間真的留出空白（${(g.dotsTop - g.instructionBottom).toFixed(0)}px）`,
      g.dotsTop - g.instructionBottom >= 60, true);

    // 5. 取消鈕與 mission 標籤的 bounding box 不重疊（上移之後兩者同高）。
    const overlap = g.mission.right > g.cancel.left && g.mission.left < g.cancel.right
      && g.mission.bottom > g.cancel.top && g.mission.top < g.cancel.bottom;
    check(`${tag} 取消鈕沒壓到 mission 標籤`, overlap, false);

    // 6. 🔴 反向斷言：把 padding 推開 120px，框心必須剛好跟著走 120px。
    //    它跟第 3 條成對 —— 少了這條，把量測掏空也能讓第 3 條變綠。
    check(`${tag} 🔴 padding 推 120px → 框心跟著走 120px（量的就是這個量）`,
      g.padProbe.delta, 120, 0.6);
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

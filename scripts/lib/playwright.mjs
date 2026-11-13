/**
 * playwright.mjs — 讓 harness 在**兩種環境**都拿得到 Playwright。
 *
 * 為什麼需要這一層：六支 harness 原本都寫死
 * `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`
 * —— 那是這個開發容器的全域安裝路徑，GitHub runner 上不存在。
 * **這就是 preview harness 一直進不了 CI 的唯一硬阻礙**（不是什麼架構問題），
 * 而那個盲區已經咬人兩次：
 *   1. #231 改了 Hero 無讀數文案沒改斷言 → preview-strip-color 在 main 上
 *      紅著 44/45 好幾天沒人發現。
 *   2. #229/#231/#232 讓 Hero 讀數爆版三次都沒紅，最後是 founder 用手機發現的。
 *
 * 解法刻意是「先試套件、再退回絕對路徑」而不是二選一：
 * CI 走 devDependency（版本釘在 package.json），容器沒有 node_modules 時
 * 仍然照舊跑得動。**兩條路都要能走**，否則等於為了 CI 把現在的用法弄壞。
 */

/** 容器全域安裝的位置（GitHub runner 上不存在，所以只能當 fallback）。 */
const CONTAINER_PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright/index.mjs';

/**
 * 取得 chromium。優先用 node_modules 裡的（CI／`npm ci` 之後的本機），
 * 找不到才退回容器的全域安裝。
 *
 * @returns {Promise<import('playwright').BrowserType>}
 */
export async function getChromium() {
  try {
    const pw = await import('playwright');
    return (pw.default ?? pw).chromium;
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    const pw = await import(CONTAINER_PLAYWRIGHT);
    return (pw.default ?? pw).chromium;
  }
}

// ═══════════════════════════════════════════════════
// 字型金絲雀
//
// 🔴 這幾支 harness 量的是文字寬度與行數，而**文字寬度是字型的函式**。
// 實測同一組字串在不同字型下（390px 視窗、頁面實際字級）：
//
//   字型              尚未量測@30px   Neutral@36px
//   容器預設 sans        120            124
//   WenQuanYi Zen Hei    120            114
//   DejaVu Sans          120            152   ← 環心只有 ~128px
//
// 中文是穩的（漢字天生 1em/字，任何字型都一樣），**英文差到 33%**。
// 所以 CI 不釘字型就把 harness 丟進去，第一次跑就會紅 —— 而且是假紅。
//
// CI 裝 fonts-wqy-zenhei 讓兩邊一致（founder 2026-08-19 拍板）。但「釘住」只
// 保證**現在**一致，擋不住哪天 runner image 換字型。所以先量一組已知字串：
// 對不上就**以字型不符失敗**，而不是讓它去翻掉「讀數不在圓內」那條 ——
// 否則下一個人看到的是一個看起來像版面 bug、其實是環境問題的紅燈。
//
// 斷言守的是「結構上有沒有溢出」，不是像素級的真實裝置外觀
// （真實裝置是 SF Pro，Linux 永遠拿不到）。
// ═══════════════════════════════════════════════════

/**
 * 頁面實際用的字型堆疊 —— **兩份，因為兩種頁面真的用不同的字**（2026-11-13）。
 *
 *   system：`/decision-alert/` 等沒換字的頁面。看環境（CI 124、Inter 的容器 127）。
 *   geist ：`/v3/`（tokens.css `--font-sans`，自架 Geist）。**不看環境** ——
 *           字型檔跟著 repo 走，容器與 CI 量到同一個數字。
 *
 * 🔴 第一版只留一份、整個換成 Geist。結果 `preview-strip-color` 的金絲雀跑在
 *    `/decision-alert/` 上（那一頁沒用 Geist → 字型檔根本沒被要求下載 → 量到的是
 *    後面的系統字）：CI 量到 124、基準寫 128 → **CI 紅**；而這個容器的系統字是
 *    Inter（127），剛好落在 128±2 裡，所以本地是綠的。
 *    一個基準只能描述一種字。頁面用哪一種，就拿哪一種的基準去比。
 *
 * ⚠️ geist 那一串要跟 tokens.css 的 `--font-sans` 逐字一致。
 */
const FONT_STACKS = {
  system: "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',sans-serif",
  geist: "Geist,-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',sans-serif",
};

/**
 * 基準值。
 *
 * 🔴 **容差是從版面的餘裕推導的，不是憑感覺訂的。**
 * 2026-10-10 之前英文那一欄是 ±8px，而那比版面能承受的還寬 ——
 * 容器換 image 之後 `sans-serif` 變成 Inter，「Neutral」從 124 → 127px（+3），
 * 金絲雀照樣放行，然後 **9 條版面斷言紅**（fdcb 8 條 + strip-color 1 條），
 * 每一條都長得像產品壞了。那正是這支金絲雀存在要擋的事。
 *
 * 推導：環心那條（`OUTSIDE_CIRCLE_TOL`）容差 4px，而通過時最差的一組是 2.9px
 * —— 只剩 **1.1px 的角落餘裕**。字串變寬 W px，左右各外推約 W/2，
 * 所以可容忍的字寬偏差約 **2.2px** → 取 **±2**，跟中文那一組同級。
 *
 * 佐證（兩邊都實測過，不是推測）：
 *   CI runner（GitHub Actions）    「Neutral」@36px = **124px** ← 正中基準
 *   2026-10-10 的開發容器            「Neutral」@36px = **127px** ← 已經會翻掉版面
 *
 * ⚠️ 哪天 runner 又飄了，這裡會**先**紅，而且訊息直接說是字型 ——
 *    那比讓它去翻掉九條「讀數不在環心圓內」好得多。**那時候要修的是環境，
 *    不是去改產品的版面來迎合它。**
 */
const FONT_BASELINE = {
  system: [
    { text: '尚未量測', px: 30, expect: 120, tol: 2 },
    { text: 'Neutral', px: 36, expect: 124, tol: 2 },
  ],
  // Geist 實測 128.3px（2026-11-13）。產品端用字距把它補回原本驗過的寬度，
  // 見 v6 `.tl-edge-score.band`；這裡量的是**沒有字距**的字型本身。
  geist: [
    { text: '尚未量測', px: 30, expect: 120, tol: 2 },
    { text: 'Neutral', px: 36, expect: 128, tol: 2 },
  ],
};

/**
 * 在給定的 page 上量基準字串，回傳不符的項目（空陣列 = 環境對得上）。
 *
 * 🔴 **一律把量到的數字回報出去，不只回報通過與否。**
 * 2026-10-10 踩到：容器重啟換了 image，`sans-serif` 從原本的字型變成 **Inter**，
 * 「Neutral」@36px 從 124px 變成 **127.4px** —— 偏 3.4px，在 ±8 的容差內，
 * 所以金絲雀放行了。但環心那條版面斷言的容差只有 4px，而通過時本來就只剩
 * 約 1px 餘裕，於是 **8 條「讀數不在環心圓內」當場紅**。
 *
 * 那正是這支函式的註解自己說它存在要擋的事：
 * 「對不上就以字型不符失敗，而不是讓它去翻掉『讀數不在圓內』那條」。
 * 它擋不住，因為**容差比版面的餘裕還寬**。
 *
 * 要訂一個對的容差得先知道各個環境實際量到多少 —— 所以先讓它每次都把數字
 * 印出來（CI 的 log 裡就會有 runner 的真值），**不要憑感覺縮容差**。
 *
 * @param {import('playwright').Page} page
 * @param {'system'|'geist'} [face] - 這一頁的介面字是哪一種（預設 system）。
 * @returns {Promise<{drift: string[], measured: string[]}>}
 *   `drift` 空陣列 ＝ 環境對得上；`measured` 一律有值，給人看的實測數字。
 */
export async function checkFontCanary(page, face = 'system') {
  const stack = FONT_STACKS[face];
  const baseline = FONT_BASELINE[face];
  // web font 是「有人用到才下載」。先明確請它載，量到的才是它而不是後面的 fallback；
  // 載不到就照樣往下量 —— 量到 fallback 的寬度正是金絲雀該喊的事。
  if (face === 'geist') await page.evaluate(() => document.fonts.load('600 36px Geist').catch(() => []));
  const measured = await page.evaluate(([stack, samples]) => {
    const el = document.createElement('div');
    el.style.cssText =
      `position:absolute;left:-9999px;top:0;white-space:nowrap;font-family:${stack};font-weight:600`;
    document.body.appendChild(el);
    const out = samples.map((s) => {
      el.style.fontSize = `${s.px}px`;
      el.textContent = s.text;
      return Math.round(el.getBoundingClientRect().width);
    });
    el.remove();
    return out;
  }, [stack, baseline]);

  return {
    drift: baseline.flatMap((s, i) => {
      const got = measured[i];
      if (Math.abs(got - s.expect) <= s.tol) return [];
      return [`「${s.text}」@${s.px}px 量到 ${got}px，基準是 ${s.expect}±${s.tol}px`];
    }),
    measured: baseline.map((s, i) =>
      `「${s.text}」@${s.px}px = ${measured[i]}px（基準 ${s.expect}±${s.tol}）`),
  };
}
